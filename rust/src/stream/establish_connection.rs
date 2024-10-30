use super::{Stats, StreamError, WebSocketConnection};

use crate::{
    auth::generate_auth_headers,
    config::{Config, WebSocketHighAvailability},
    endpoints::API_V1_WS,
    feed::ID,
};

use std::{
    sync::{atomic::Ordering, Arc},
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::{
    net::TcpStream,
    time::{sleep, timeout, Duration},
};
use tokio_tungstenite::{
    connect_async, tungstenite::client::IntoClientRequest, MaybeTlsStream,
    WebSocketStream as TungsteniteWebSocketStream,
};
use tracing::{error, info};

const DEFAULT_WS_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const MIN_WS_RECONNECT_INTERVAL: Duration = Duration::from_millis(1000);
const MAX_WS_RECONNECT_INTERVAL: Duration = Duration::from_millis(10000);

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

    let headers = generate_auth_headers(
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

    let connect_future = connect_async(request);

    let (ws_stream, ws_response) = timeout(DEFAULT_WS_CONNECT_TIMEOUT, connect_future)
        .await
        .map_err(|_| StreamError::ConnectionError("WebSocket connection timed out".to_string()))?
        .map_err(|e| StreamError::ConnectionError(format!("Failed to connect: {}", e)))?;

    info!("Connected to WebSocket: {:#?}", ws_response);

    Ok(ws_stream)
}

pub(crate) async fn connect(
    config: &Config,
    feed_ids: &[ID],
    stats: Arc<Stats>,
) -> Result<WebSocketConnection, StreamError> {
    let origins = parse_origins(&config.ws_url);

    if config.ws_ha == WebSocketHighAvailability::Enabled && origins.len() > 1 {
        let mut streams = Vec::new();

        for origin in origins {
            match connect_to_origin(config, &origin, feed_ids).await {
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

        let stream = connect_to_origin(config, origin, feed_ids).await?;
        stats.configured_connections.fetch_add(1, Ordering::SeqCst);
        stats.active_connections.fetch_add(1, Ordering::SeqCst);

        Ok(WebSocketConnection::Single(stream))
    }
}

pub(crate) async fn try_to_reconnect(
    stats: Arc<Stats>,
    config: &Config,
    feed_ids: &[ID],
) -> Result<TungsteniteWebSocketStream<MaybeTlsStream<TcpStream>>, StreamError> {
    let mut reconnect_attempts = 0;
    let max_reconnect_attempts = config.ws_max_reconnect;
    let origin = config.ws_url.split(',').next().unwrap();
    let mut backoff = MIN_WS_RECONNECT_INTERVAL;

    loop {
        info!("Attempting to reconnect to origin: {}", origin);
        reconnect_attempts += 1;
        match connect_to_origin(config, origin, feed_ids).await {
            Ok(new_stream) => {
                stats.active_connections.fetch_add(1, Ordering::SeqCst);
                return Ok(new_stream);
            }
            Err(e) => {
                error!(
                    "Reconnection attempt {} failed: {:?}.",
                    reconnect_attempts, e
                );

                if reconnect_attempts >= max_reconnect_attempts {
                    error!("Max reconnect attempts reached. Exiting.");
                    return Err(StreamError::ConnectionError(
                        "Max reconnect attempts reached".to_string(),
                    ));
                }

                error!("Retrying in {:?}.", backoff);

                sleep(backoff).await;
                backoff = (backoff * 2).min(MAX_WS_RECONNECT_INTERVAL);
            }
        }
    }
}
