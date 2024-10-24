use crate::auth::generate_auth_headers;
use crate::config::Config;
use crate::endpoints::API_V1_WS;
use crate::feed::ID;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::{
    net::TcpStream,
    sync::{broadcast, mpsc},
};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, http::HeaderMap, Message},
    MaybeTlsStream, WebSocketStream as TungsteniteWebSocketStream,
};

#[derive(Debug, thiserror::Error)]
pub enum StreamError {
    #[error("WebSocket error: {0}")]
    WebSocketError(#[from] tokio_tungstenite::tungstenite::Error),

    #[error("Connection error: {0}")]
    ConnectionError(String),

    #[error("Authentication error: {0}")]
    AuthError(#[from] crate::auth::HmacError),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("Stream closed")]
    StreamClosed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WebSocketReport {
    pub report: ReportDetails,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReportDetails {
    #[serde(rename = "feedID")]
    pub feed_id: ID,
    #[serde(rename = "fullReport")]
    pub full_report: String,
}

pub enum WebSocketConnection {
    Single(TungsteniteWebSocketStream<MaybeTlsStream<TcpStream>>),
    Multiple(Vec<TungsteniteWebSocketStream<MaybeTlsStream<TcpStream>>>),
}

pub struct Stream {
    conn: Option<WebSocketConnection>,
    report_sender: mpsc::Sender<WebSocketReport>,
    report_receiver: mpsc::Receiver<WebSocketReport>,
    shutdown_sender: broadcast::Sender<()>,
}

impl Stream {
    pub async fn new(config: &Config, feed_ids: Vec<ID>) -> Result<Stream, StreamError> {
        let (report_sender, report_receiver) = mpsc::channel(100);
        let (shutdown_sender, _) = broadcast::channel(1);

        let origins = Self::parse_origins(&config.ws_url);

        if config.ws_ha && origins.len() > 1 {
            let mut streams = Vec::new();

            for origin in origins {
                match Self::connect_to_origin(&config, &origin, &feed_ids).await {
                    Ok(stream) => streams.push(stream),
                    Err(e) => {
                        eprintln!("Failed to connect to origin {}: {:?}", origin, e);
                    }
                }
            }

            if streams.is_empty() {
                return Err(StreamError::ConnectionError(
                    "Failed to connect to any WebSocket origins".into(),
                ));
            }

            Ok(Stream {
                conn: Some(WebSocketConnection::Multiple(streams)),
                report_sender,
                report_receiver,
                shutdown_sender,
            })
        } else {
            let origin = origins.first().ok_or_else(|| {
                StreamError::ConnectionError("No WebSocket origin found in config".into())
            })?;

            let stream = Self::connect_to_origin(&config, origin, &feed_ids).await?;
            Ok(Stream {
                conn: Some(WebSocketConnection::Single(stream)),
                report_sender,
                report_receiver,
                shutdown_sender,
            })
        }
    }

    fn parse_origins(ws_url: &str) -> Vec<String> {
        ws_url
            .split(',')
            .map(|url| url.trim().to_string())
            .collect()
    }

    async fn connect_to_origin(
        config: &Config,
        origin: &str,
        feed_ids: &[ID],
    ) -> Result<TungsteniteWebSocketStream<MaybeTlsStream<TcpStream>>, StreamError> {
        let feed_ids: Vec<String> = feed_ids.iter().map(|id| id.to_hex_string()).collect();
        let feed_ids_joined = feed_ids.join(",");

        let method = "GET";
        let path = format!("{}?feedIDs={}", API_V1_WS, feed_ids_joined.as_str());
        let body = b"";
        let client_id = &config.api_key;
        let user_secret = &config.api_secret;
        let request_timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("System time error")
            .as_millis()
            .try_into()
            .unwrap();

        let mut headers = HeaderMap::new();
        generate_auth_headers(
            &mut headers,
            method,
            &path,
            body,
            client_id,
            user_secret,
            request_timestamp,
        )?;

        let url = format!("{}{}", origin, path);
        let mut request = url.into_client_request().map_err(|e| {
            StreamError::ConnectionError(format!("Failed to create client request: {}", e))
        })?;
        request.headers_mut().extend(headers);

        let (ws_stream, ws_response) = connect_async(request)
            .await
            .map_err(|e| StreamError::ConnectionError(format!("Failed to connect: {}", e)))?;

        println!("Connected to WebSocket: {:?}", ws_response);

        Ok(ws_stream)
    }

    pub async fn listen(&mut self) -> Result<(), StreamError> {
        let conn = self
            .conn
            .take()
            .ok_or_else(|| StreamError::ConnectionError("No connection".into()))?;
        match conn {
            WebSocketConnection::Single(stream) => {
                let report_sender = self.report_sender.clone();
                let mut shutdown_receiver = self.shutdown_sender.subscribe();
                tokio::spawn(Self::run_stream(stream, report_sender, shutdown_receiver));
            }
            WebSocketConnection::Multiple(streams) => {
                for stream in streams {
                    let report_sender = self.report_sender.clone();
                    let mut shutdown_receiver = self.shutdown_sender.subscribe();
                    tokio::spawn(Self::run_stream(stream, report_sender, shutdown_receiver));
                }
            }
        }
        Ok(())
    }

    async fn run_stream(
        mut stream: TungsteniteWebSocketStream<MaybeTlsStream<TcpStream>>,
        report_sender: mpsc::Sender<WebSocketReport>,
        mut shutdown_receiver: broadcast::Receiver<()>,
    ) {
        loop {
            tokio::select! {
                message = stream.next() => {
                    match message {
                        Some(Ok(msg)) => {
                            if let Err(e) = Self::handle_message(report_sender.clone(), msg).await {
                                println!("Error handling message: {:?}", e);
                            }
                        }
                        Some(Err(e)) => {
                            println!("Error receiving message: {:?}", e);
                            break;
                        }
                        None => {
                            // Stream closed
                            break;
                        }
                    }
                }
                _ = shutdown_receiver.recv() => {
                    // Received shutdown signal
                    if let Err(e) = stream.close(None).await {
                        println!("Error closing stream: {:?}", e);
                    }
                    break;
                }
            }
        }
        println!("Stream processing task terminated.");
    }

    async fn handle_message(
        report_sender: mpsc::Sender<WebSocketReport>,
        message: Message,
    ) -> Result<(), StreamError> {
        match message {
            Message::Text(text) => {
                println!("Received text message: {}", text);
            }
            Message::Binary(data) => {
                if let Ok(report) = serde_json::from_slice::<WebSocketReport>(&data) {
                    report_sender.send(report).await.map_err(|e| {
                        StreamError::ConnectionError(format!("Failed to send report: {}", e))
                    })?;
                    println!("Received report.");
                } else {
                    println!("Failed to parse binary message.");
                }
            }
            Message::Ping(payload) => {
                println!("Received ping: {:?}", payload);
            }
            Message::Pong(payload) => {
                println!("Received pong: {:?}", payload);
            }
            Message::Close(close_frame) => {
                if let Some(cf) = close_frame {
                    println!("Connection closed: code={}, reason={}", cf.code, cf.reason);
                } else {
                    println!("Connection closed");
                }
            }
            _ => {
                println!("Received unhandled message.");
            }
        }
        Ok(())
    }

    pub async fn read(&mut self) -> Result<WebSocketReport, StreamError> {
        self.report_receiver
            .recv()
            .await
            .ok_or(StreamError::StreamClosed)
    }

    pub async fn close(&mut self) -> Result<(), StreamError> {
        println!("Closing stream...");

        // Send shutdown signal
        if let Err(e) = self.shutdown_sender.send(()) {
            println!("Error sending shutdown signal: {:?}", e);
        }

        // Allow tasks to shut down gracefully
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        Ok(())
    }
}
