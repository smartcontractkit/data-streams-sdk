mod establish_connection;
mod monitor_connection;

use establish_connection::connect;
use monitor_connection::run_stream;

use crate::{config::Config, feed::ID, report::Report};

use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};
use tokio::{
    net::TcpStream,
    sync::{broadcast, mpsc, Mutex},
    time::{sleep, Duration},
};
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream as TungsteniteWebSocketStream};
use tracing::{error, info};

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

        let conn = connect(config, &feed_ids, stats.clone()).await?;

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
                let config = self.config.clone();
                let feed_ids = self.feed_ids.clone();

                tokio::spawn(run_stream(
                    stream,
                    report_sender,
                    shutdown_receiver,
                    stats,
                    water_mark,
                    config,
                    feed_ids,
                ));
            }
            WebSocketConnection::Multiple(streams) => {
                for stream in streams {
                    let report_sender = self.report_sender.clone();
                    let shutdown_receiver = self.shutdown_sender.subscribe();
                    let stats = self.stats.clone();
                    let water_mark = self.water_mark.clone();
                    let config = self.config.clone();
                    let feed_ids = self.feed_ids.clone();

                    tokio::spawn(run_stream(
                        stream,
                        report_sender,
                        shutdown_receiver,
                        stats,
                        water_mark,
                        config,
                        feed_ids,
                    ));
                }
            }
        }

        Ok(())
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
