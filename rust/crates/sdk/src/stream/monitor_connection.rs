use super::{dedup::{FeedDeduplicator, Verdict}, Stats, StreamError, WebSocketReport};

use crate::{config::Config, stream::establish_connection::try_to_reconnect};

use chainlink_data_streams_report::feed_id::ID;

use futures::SinkExt;
use futures_util::StreamExt;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tokio::{
    net::TcpStream,
    sync::{broadcast, mpsc, Mutex},
};
use tokio_tungstenite::{
    tungstenite::Message, MaybeTlsStream, WebSocketStream as TungsteniteWebSocketStream,
};
use tracing::{error, info, warn};

pub(crate) async fn run_stream(
    mut stream: TungsteniteWebSocketStream<MaybeTlsStream<TcpStream>>,
    origin: String,   // X-Cll-Origin value for this connection; empty = non-HA
    report_sender: mpsc::Sender<WebSocketReport>,
    mut shutdown_receiver: broadcast::Receiver<()>,
    stats: Arc<Stats>,
    dedup: Arc<Mutex<FeedDeduplicator>>,
    config: Config,
    feed_ids: Vec<ID>,
) -> Result<(), StreamError> {
    let shutdown_flag = Arc::new(AtomicBool::new(false));

    loop {
        tokio::select! {
            message = stream.next() => {
                match message {
                    Some(Ok(msg)) => {
                        match msg {
                            Message::Text(text) => {
                                info!("Received text message: {}", text);
                            }
                            Message::Binary(data) => {
                                info!("Received new report from Data Streams Endpoint.");
                                if let Ok(report) = serde_json::from_slice::<WebSocketReport>(&data) {
                                    let feed_id = report.report.feed_id.to_hex_string();
                                    let ts = report.report.observations_timestamp as u64;

                                    let verdict = dedup.lock().await.check(&feed_id, ts);

                                    match verdict {
                                        Verdict::Duplicate => {
                                            stats.deduplicated.fetch_add(1, Ordering::SeqCst);
                                            continue;
                                        }
                                        Verdict::OutOfOrder => {
                                            stats.out_of_order.fetch_add(1, Ordering::SeqCst);
                                            if !config.ws_allow_out_of_order {
                                                stats.deduplicated.fetch_add(1, Ordering::SeqCst);
                                                continue;
                                            }
                                        }
                                        Verdict::Accept => {}
                                    }

                                    report_sender.send(report).await.map_err(|e| {
                                        StreamError::ConnectionError(format!("Failed to send report: {}", e))
                                    })?;

                                    stats.accepted.fetch_add(1, Ordering::SeqCst);
                                } else {
                                    error!("Failed to parse binary message.");
                                }
                            }
                            Message::Ping(payload) => {
                                info!("Received ping: {:?}", payload);
                                info!("Responding with pong: {:?}", payload);
                                stream.send(Message::Pong(payload)).await.map_err(|e| {
                                    StreamError::ConnectionError(format!("Failed to send pong: {}", e))
                                })?;

                            }
                            Message::Pong(payload) => {
                                info!("Received pong: {:?}", payload);
                            }
                            Message::Close(close_frame) => {
                                if let Some(cf) = close_frame {
                                    info!("Connection closed: code={}, reason={}", cf.code, cf.reason);
                                } else {
                                    info!("Connection closed");
                                }
                            }
                            _ => {
                                warn!("Received unhandled message.");
                            }
                        }
                    }
                    Some(Err(e)) => {
                        error!("Error receiving message: {:?}", e);
                        stats.active_connections.fetch_sub(1, Ordering::SeqCst);

                        stream = handle_reconnection(stats.clone(), &config, &origin, &feed_ids).await?;
                    }
                    None => {
                        info!("WebSocket stream closed.");
                        stats.active_connections.fetch_sub(1, Ordering::SeqCst);

                        if shutdown_flag.load(Ordering::SeqCst) {
                            info!("Stream closed gracefully after shutdown signal.");
                            return Ok(());
                        } else {
                            stream = handle_reconnection(stats.clone(), &config, &origin, &feed_ids).await?;
                        }
                    }
                }
            }
            _ = shutdown_receiver.recv() => {
                // Received shutdown signal
                shutdown_flag.store(true, Ordering::SeqCst);

                if let Err(e) = stream.close(None).await {
                    error!("Error closing stream: {:?}", e);
                    return Err(StreamError::WebSocketError(e));
                }
                stats.active_connections.fetch_sub(1, Ordering::SeqCst);
                info!("Stream closed gracefully after shutdown signal.");
                return Ok(());
            }
        }
    }
}

async fn handle_reconnection(
    stats: Arc<Stats>,
    config: &Config,
    origin: &str,    // X-Cll-Origin value; passed through to try_to_reconnect
    feed_ids: &[ID],
) -> Result<TungsteniteWebSocketStream<MaybeTlsStream<TcpStream>>, StreamError> {
    if stats.active_connections.load(Ordering::SeqCst) == 0 {
        stats.full_reconnects.fetch_add(1, Ordering::SeqCst);
    } else {
        stats.partial_reconnects.fetch_add(1, Ordering::SeqCst);
    }

    let new_stream = try_to_reconnect(stats.clone(), config, origin, feed_ids).await?;
    Ok(new_stream)
}
