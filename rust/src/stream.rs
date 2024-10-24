use crate::auth::generate_auth_headers;
use crate::config::Config;
use crate::endpoints::API_V1_WS;
use crate::feed::ID;

use futures_util::{StreamExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::net::TcpStream;
use tokio::time::timeout;
use tokio_tungstenite::{
    connect_async,
    tungstenite::{
        client::IntoClientRequest,
        handshake::client::generate_key,
        http::{HeaderMap, Request},
        protocol::{frame::coding::CloseCode, CloseFrame},
        Message,
    },
    MaybeTlsStream, WebSocketStream as TungsteniteWebSocketStream,
};
use tracing::{debug, error, info, warn};

const DEFAULT_WS_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const MIN_WS_RECONNECT_INTERVAL: Duration = Duration::from_millis(1000);
const MAX_WS_RECONNECT_INTERVAL: Duration = Duration::from_millis(10000);

// /// Represents a report that will be returned from the Data Streams DON via WSS.
// ///
// /// The `Report` struct contains the following fields:
// /// * `feed_id`: The hex encoded feedId.
// /// * `full_report`: A blob containing the report context + body, can be passed unmodified to the contract for verification.
// ///
// /// # Examples
// ///
// /// ```rust
// /// use data_streams_sdk::stream::WebSocketReport;
// /// use data_streams_sdk::feed::ID;
// ///
// /// let id = ID::from_hex_str("0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472").unwrap();
// /// let report = WebSocketReport {
// ///    feed_id: id,
// ///    full_report: "00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b84720000000000000000000000000000000000000000000000000000000066741d8c00000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000064000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000640000070407020401522602090605060802080505a335ef7fae696b663f1b840100000000000000000000000000000000000000000000000000000000000bbbda0000000000000000000000000000000000000000000000000000000066741d8c".to_string(),
// /// };
// /// ```
// #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
// pub struct WebSocketReport {
//     #[serde(rename = "feedID")]
//     pub feed_id: ID,
//     #[serde(rename = "fullReport")]
//     pub full_report: String,
// }

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

/// Represents the WebSocket connection(s).
pub enum WebSocketConnection {
    Single(TungsteniteWebSocketStream<MaybeTlsStream<TcpStream>>),
    Multiple(Vec<TungsteniteWebSocketStream<MaybeTlsStream<TcpStream>>>),
}

/// Represents the WebSocket stream.
pub struct Stream {
    // Underlying WebSocket connection.
    conn: WebSocketConnection,
}

impl Stream {
    /// Creates a new WebSocket connection to one or more servers, depending on the HA configuration.
    ///
    /// # Arguments
    /// * `config` - Client configuration containing the WebSocket URL(s) and authentication details.
    /// * `feed_ids` - List of feed IDs to subscribe to.
    ///
    /// # Returns
    /// A Stream instance with multiple connections (if HA enabled) or a single connection.
    pub async fn new(config: &Config, feed_ids: Vec<ID>) -> Result<Stream, Box<dyn Error>> {
        let origins = Self::parse_origins(&config.ws_url);

        if config.ws_ha && origins.len() > 1 {
            // High Availability: Connect to multiple WebSocket origins
            let mut streams = Vec::new();

            for origin in origins {
                match Self::connect_to_origin(&config, &origin, &feed_ids).await {
                    Ok(stream) => streams.push(stream),
                    Err(e) => {
                        error!("Failed to connect to origin {}: {:?}", origin, e);
                        // Continue trying to connect to other origins
                    }
                }
            }

            if streams.is_empty() {
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::NotConnected,
                    "Failed to connect to any WebSocket origins",
                )));
            }

            Ok(Stream {
                conn: WebSocketConnection::Multiple(streams),
            })
        } else {
            // Single origin: Standard connection
            let origin = origins
                .first()
                .ok_or("No WebSocket origin found in config")?;

            let stream: TungsteniteWebSocketStream<MaybeTlsStream<TcpStream>> =
                Self::connect_to_origin(&config, origin, &feed_ids).await?;
            Ok(Stream {
                conn: WebSocketConnection::Single(stream),
            })
        }
    }

    /// Parses a comma-separated list of WebSocket origins into a vector.
    fn parse_origins(ws_url: &str) -> Vec<String> {
        ws_url
            .split(',')
            .map(|url| url.trim().to_string())
            .collect()
    }

    /// Establishes a connection to a single WebSocket origin.
    async fn connect_to_origin(
        config: &Config,
        origin: &str,
        feed_ids: &[ID],
    ) -> Result<TungsteniteWebSocketStream<MaybeTlsStream<TcpStream>>, Box<dyn std::error::Error>>
    {
        let feed_ids: Vec<String> = feed_ids.iter().map(|id| id.to_hex_string()).collect();
        let feed_ids_joined = feed_ids.join(",");

        let method = "GET";
        let path = format!("{}?feedIDs={}", API_V1_WS, feed_ids_joined.as_str());
        let body = b"";
        let client_id = &config.api_key;
        let user_secret = &config.api_secret;
        let request_timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Error: Timestamp in the past")
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
        let mut request = url.into_client_request().unwrap();
        request.headers_mut().extend(headers);

        let (ws_stream, ws_response) = connect_async(request).await.unwrap();

        println!("Connected to WebSocket: {:?}", ws_response);

        Ok(ws_stream)
    }

    /// Starts listening for incoming WebSocket messages.
    pub async fn listen(&mut self) -> Result<(), Box<dyn Error>> {
        match &mut self.conn {
            WebSocketConnection::Single(stream) => {
                // Single connection: listen to messages from the WebSocket
                while let Some(message) = stream.try_next().await? {
                    Self::handle_message(message).await?;
                }
            }
            WebSocketConnection::Multiple(streams) => {
                // Multiple connections: listen to messages from each WebSocket
                for stream in streams.iter_mut() {
                    while let Some(message) = stream.try_next().await? {
                        Self::handle_message(message).await?;
                    }
                }
            }
        }
        Ok(())
    }

    /// Handles the incoming WebSocket message.
    async fn handle_message(message: Message) -> Result<(), Box<dyn Error>> {
        match message {
            Message::Text(text) => {
                println!("Received text message: {}", text);
            }
            Message::Binary(data) => {
                if let Ok(report) = serde_json::from_slice::<WebSocketReport>(&data) {
                    println!("Received report: {:?}", report);
                } else {
                    println!("Received binary message: {:?}", data);
                }
            }
            Message::Ping(ping) => {
                println!("Received ping: {:?}", ping);
            }
            Message::Pong(pong) => {
                println!("Received pong: {:?}", pong);
            }
            Message::Close(close_frame) => {
                if let Some(cf) = close_frame {
                    println!("Connection closed: code={}, reason={}", cf.code, cf.reason);
                } else {
                    println!("Connection closed");
                }
            }
            _ => {
                println!("Received unhandled message: {:?}", message);
            }
        }
        Ok(())
    }

    /// Closes the Stream. Is the caller responsibility to call close when the stream is no longer needed.
    pub async fn close(&mut self) -> Result<(), tokio_tungstenite::tungstenite::Error> {
        let close_frame = Some(CloseFrame {
            code: CloseCode::Normal,
            reason: "Graceful shutdown".into(),
        });

        match &mut self.conn {
            WebSocketConnection::Single(ws) => {
                if let Err(_) = timeout(DEFAULT_WS_CONNECT_TIMEOUT, ws.close(close_frame)).await {
                    println!("Timeout: Close frame not acknowledged within 5 seconds");
                }
                ws.close(None).await
            }
            WebSocketConnection::Multiple(wss) => {
                for ws in wss {
                    if let Err(_) =
                        timeout(DEFAULT_WS_CONNECT_TIMEOUT, ws.close(close_frame.clone())).await
                    {
                        println!("Timeout: Close frame not acknowledged within 5 seconds");
                    }
                    ws.close(None).await?;
                }
                Ok(())
            }
        }
    }
}
