use crate::{
    auth::generate_auth_headers, config::Config, endpoints::API_V1_WS, feed::ID, report::Report,
};

use futures::SinkExt;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::{
    net::TcpStream,
    sync::{broadcast, mpsc, Mutex},
    time::{sleep, Duration},
};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, http::HeaderMap, Message},
    MaybeTlsStream, WebSocketStream as TungsteniteWebSocketStream,
};
use tracing::{error, info, warn};

// const DEFAULT_WS_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
// const MIN_WS_RECONNECT_INTERVAL: Duration = Duration::from_millis(1000);
// const MAX_WS_RECONNECT_INTERVAL: Duration = Duration::from_millis(10000);

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
    pub report: Report,
}

struct Stats {
    /// Total number of accepted reports
    accepted: AtomicU64,
    /// Total number of deduplicated reports when in HA           
    deduplicated: AtomicU64,
    /// Total number of partial reconnects when in HA        
    partial_reconnects: AtomicU64,
    /// Total number of full reconnects    
    full_reconnects: AtomicU64,
    /// Number of configured connections if in HA      
    configured_connections: AtomicU64,
    /// Current number of active connections     
    active_connections: AtomicU64,
}

#[derive(Debug)]
pub enum WebSocketConnection {
    Single(TungsteniteWebSocketStream<MaybeTlsStream<TcpStream>>),
    Multiple(Vec<TungsteniteWebSocketStream<MaybeTlsStream<TcpStream>>>),
}

/// Stream represents a realtime report stream.
/// Safe for concurrent usage.
/// When HA mode is enabled and at least 2 origins are provided, the Stream will maintain at least 2 concurrent connections to different instances
/// to ensure high availability, fault tolerance and minimize the risk of report gaps.
pub struct Stream {
    config: Config,
    feed_ids: Vec<ID>,
    conn: Option<WebSocketConnection>,
    report_sender: mpsc::Sender<WebSocketReport>,
    report_receiver: mpsc::Receiver<WebSocketReport>,
    shutdown_sender: broadcast::Sender<()>,
    stats: Arc<Stats>,
    water_mark: Arc<Mutex<HashMap<String, usize>>>,
}

impl Stream {
    /// Establishes a streaming WebSocket connection that sends reports for the given feedID(s) after they are verified.
    ///
    /// # Arguments
    ///
    /// * `config` - A validated `Config` instance.
    /// * `feedIDs` - A comma-separated list of Data Streams feed IDs.
    ///
    /// # Endpoint:
    /// ```bash
    /// /api/v1/ws
    /// ```
    ///
    /// # Type:
    /// * WebSocket
    ///
    /// # Sample Request:
    /// ```bash
    /// GET /api/v1/ws?feedIDs=<feedID1>,<feedID2>,...
    /// ```
    ///
    /// # Sample Response:
    /// ```json
    /// {
    ///     "report": {
    ///         "feedID": "Hex encoded feedId.",
    ///         "fullReport": "A blob containing the report context and body. Encode the fee token into the payload before passing it to the contract for verification.",
    ///         "validFromTimestamp": "Report's earliest applicable timestamp (in seconds).",
    ///         "observationsTimestamp": "Report's latest applicable timestamp (in seconds)."
    ///     }
    /// }
    /// ```
    ///
    /// # Error Response Codes
    ///
    /// | Status Code | Description |
    /// |-------------|-------------|
    /// | **400 Bad Request** | This error is triggered when:<br>- There is any missing/malformed query argument.<br>- Required headers are missing or provided with incorrect values. |
    /// | **401 Unauthorized User** | This error is triggered when:<br>- Authentication fails, typically because the HMAC signature provided by the client doesn't match the one expected by the server.<br>- A user requests access to a feed without the appropriate permission or that does not exist. |
    /// | **500 Internal Server** | Indicates an unexpected condition encountered by the server, preventing it from fulfilling the request. This error typically points to issues on the server side. |
    pub async fn new(config: &Config, feed_ids: Vec<ID>) -> Result<Stream, StreamError> {
        let (report_sender, report_receiver) = mpsc::channel(100);
        let (shutdown_sender, _) = broadcast::channel(1);

        let stats = Arc::new(Stats {
            accepted: AtomicU64::new(0),
            deduplicated: AtomicU64::new(0),
            partial_reconnects: AtomicU64::new(0),
            full_reconnects: AtomicU64::new(0),
            configured_connections: AtomicU64::new(0),
            active_connections: AtomicU64::new(0),
        });

        let conn = Self::connect(&config, &feed_ids, stats.clone()).await?;

        let water_mark = Arc::new(Mutex::new(HashMap::new()));

        Ok(Stream {
            config: config.clone(),
            feed_ids,
            conn: Some(conn),
            report_sender,
            report_receiver,
            shutdown_sender,
            stats,
            water_mark,
        })
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
            .as_millis();

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

        info!("Connected to WebSocket: {:#?}", ws_response);

        Ok(ws_stream)
    }

    async fn connect(
        config: &Config,
        feed_ids: &[ID],
        stats: Arc<Stats>,
    ) -> Result<WebSocketConnection, StreamError> {
        let origins = Self::parse_origins(&config.ws_url);

        if config.ws_ha && origins.len() > 1 {
            let mut streams = Vec::new();

            for origin in origins {
                match Self::connect_to_origin(&config, &origin, &feed_ids).await {
                    Ok(stream) => {
                        streams.push(stream);
                        stats.configured_connections.fetch_add(1, Ordering::SeqCst);
                        stats.active_connections.fetch_add(1, Ordering::SeqCst);
                    }
                    Err(e) => {
                        error!("Failed to reconnect to origin {}: {:?}", origin, e);
                    }
                }
            }

            if streams.is_empty() {
                return Err(StreamError::ConnectionError(
                    "Failed to reconnect to any WebSocket origins".into(),
                ));
            }

            Ok(WebSocketConnection::Multiple(streams))
        } else {
            let origin = origins.first().ok_or_else(|| {
                StreamError::ConnectionError("No WebSocket origin found in config".into())
            })?;

            let stream = Self::connect_to_origin(&config, origin, &feed_ids).await?;
            stats.configured_connections.fetch_add(1, Ordering::SeqCst);
            stats.active_connections.fetch_add(1, Ordering::SeqCst);

            Ok(WebSocketConnection::Single(stream))
        }
    }

    /// Starts listening for reports on the Stream.
    /// This method will spawn a new task for each WebSocket connection.
    pub async fn listen(&mut self) -> Result<(), StreamError> {
        let conn = self
            .conn
            .take()
            .ok_or_else(|| StreamError::ConnectionError("No connection".into()))?;

        match conn {
            WebSocketConnection::Single(stream) => {
                let report_sender = self.report_sender.clone();
                let shutdown_receiver = self.shutdown_sender.subscribe();
                let stats = self.stats.clone();
                let water_mark = self.water_mark.clone();

                tokio::spawn(Self::run_stream(
                    stream,
                    report_sender,
                    shutdown_receiver,
                    stats,
                    water_mark,
                ));
            }
            WebSocketConnection::Multiple(streams) => {
                for stream in streams {
                    let report_sender = self.report_sender.clone();
                    let shutdown_receiver = self.shutdown_sender.subscribe();
                    let stats = self.stats.clone();
                    let water_mark = self.water_mark.clone();

                    tokio::spawn(Self::run_stream(
                        stream,
                        report_sender,
                        shutdown_receiver,
                        stats,
                        water_mark,
                    ));
                }
            }
        }

        Ok(())
    }

    async fn run_stream(
        mut stream: TungsteniteWebSocketStream<MaybeTlsStream<TcpStream>>,
        report_sender: mpsc::Sender<WebSocketReport>,
        mut shutdown_receiver: broadcast::Receiver<()>,
        stats: Arc<Stats>,
        water_mark: Arc<Mutex<HashMap<String, usize>>>,
    ) -> Result<(), StreamError> {
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
                                        let observations_timestamp = report.report.observations_timestamp;

                                        if water_mark.lock().await.contains_key(&feed_id) && water_mark.lock().await[&feed_id] >= observations_timestamp {
                                            stats.deduplicated.fetch_add(1, Ordering::SeqCst);
                                            continue;
                                        }

                                        report_sender.send(report).await.map_err(|e| {
                                            StreamError::ConnectionError(format!("Failed to send report: {}", e))
                                        })?;

                                        water_mark.lock().await.insert(feed_id, observations_timestamp);
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
                                    stats.active_connections.fetch_sub(1, Ordering::SeqCst);
                                }
                                _ => {
                                    warn!("Received unhandled message.");
                                }
                            }
                        }
                        Some(Err(e)) => {
                            error!("Error receiving message: {:?}", e);
                            stats.active_connections.fetch_sub(1, Ordering::SeqCst);
                            return Err(StreamError::WebSocketError(e));
                        }
                        None => {
                            info!("WebSocket stream closed.");
                            stats.active_connections.fetch_sub(1, Ordering::SeqCst);
                            return Err(StreamError::StreamClosed);
                        }
                    }
                }
                _ = shutdown_receiver.recv() => {
                    // Received shutdown signal
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

    /// Reads the next available report on the Stream.
    /// Reads blocks until a report is received, the context is canceled or all underlying connections are in a error state.
    ///
    /// # Returns
    ///
    /// * `WebSocketReport` - The next available report.
    pub async fn read(&mut self) -> Result<WebSocketReport, StreamError> {
        self.report_receiver
            .recv()
            .await
            .ok_or(StreamError::StreamClosed)
    }

    /// Closes the Stream.
    /// It is the caller's responsibility to call close when the stream is no longer needed.
    pub async fn close(&mut self) -> Result<(), StreamError> {
        info!("Closing stream...");

        // Send shutdown signal
        if let Err(e) = self.shutdown_sender.send(()) {
            error!("Error sending shutdown signal: {:?}", e);
        }

        // Allow tasks to shut down gracefully
        sleep(Duration::from_millis(100)).await;

        Ok(())
    }

    /// Returns basic stats about the Stream.
    ///
    /// # Returns
    ///
    /// * `StatsSnapshot` - A snapshot of the current Stream statistics.
    ///     * `accepted` - Total number of accepted reports.
    ///     * `deduplicated` - Total number of deduplicated reports when in HA.
    ///     * `total_received` - Total number of received reports.
    ///     * `partial_reconnects` - Total number of partial reconnects when in HA.
    ///     * `full_reconnects` - Total number of full reconnects.
    ///     * `configured_connections` - Number of configured connections if in HA.
    ///     * `active_connections` - Current number of active connections.
    pub fn get_stats(&self) -> StatsSnapshot {
        let accepted = self.stats.accepted.load(Ordering::SeqCst);
        let deduplicated = self.stats.deduplicated.load(Ordering::SeqCst);

        StatsSnapshot {
            accepted,
            deduplicated,
            total_received: accepted + deduplicated,
            partial_reconnects: self.stats.partial_reconnects.load(Ordering::SeqCst),
            full_reconnects: self.stats.full_reconnects.load(Ordering::SeqCst),
            configured_connections: self.stats.configured_connections.load(Ordering::SeqCst),
            active_connections: self.stats.active_connections.load(Ordering::SeqCst),
        }
    }
}

/// Snapshot of statistics for external consumption.
#[derive(Debug, Clone)]
pub struct StatsSnapshot {
    /// Total number of accepted reports
    pub accepted: u64,
    /// Total number of deduplicated reports when in HA
    pub deduplicated: u64,
    /// Total number of received reports
    pub total_received: u64,
    /// Total number of partial reconnects when in HA
    pub partial_reconnects: u64,
    /// Total number of full reconnects
    pub full_reconnects: u64,
    /// Number of configured connections if in HA
    pub configured_connections: u64,
    /// Current number of active connections
    pub active_connections: u64,
}
