#[path = "utils/mock_websocket_server.rs"]
mod mock_websocket_server;
use mock_websocket_server::MockWebSocketServer;

use chainlink_data_streams_sdk::config::{Config, WebSocketHighAvailability};
use chainlink_data_streams_sdk::stream::{
    Stream, MAX_WS_RECONNECT_INTERVAL, MIN_WS_RECONNECT_INTERVAL,
};

use std::iter::repeat;
use tokio::time::{sleep, Duration};
use tracing_subscriber::fmt::time::UtcTime;

// DEV: Modify these values to test different scenarios.
const NUMBER_OF_CONNECTIONS: usize = 5;
const MAX_RECONNECT_ATTEMPTS: usize = 10;

async fn prepare_scenario() -> (MockWebSocketServer, Stream, Vec<u8>) {
    let mock_server_address = "127.0.0.1:0";
    let mock_server = MockWebSocketServer::new(mock_server_address).await;

    let origins = repeat(format!("ws://{}", mock_server.address()))
        .take(NUMBER_OF_CONNECTIONS)
        .collect::<Vec<String>>();

    let ws_url = origins.join(",");

    let config = Config::new(
        "mock_key".to_string(),
        "mock_secret".to_string(),
        "mock_rest_url".to_string(),
        ws_url,
    )
    .with_ws_ha(WebSocketHighAvailability::Enabled)
    .with_ws_max_reconnect(MAX_RECONNECT_ATTEMPTS)
    .build()
    .expect("Failed to build config");

    let mut stream = Stream::new(&config, vec![])
        .await
        .expect("Failed to create stream");

    stream.listen().await.expect("Failed to start listening");

    // Allow some time for the client to establish the connection.
    sleep(Duration::from_millis(500)).await;

    let stats = stream.get_stats();
    assert_eq!(stats.configured_connections, NUMBER_OF_CONNECTIONS);
    assert_eq!(stats.active_connections, NUMBER_OF_CONNECTIONS);

    let mock_report_v3_data = vec![
        123, 34, 114, 101, 112, 111, 114, 116, 34, 58, 123, 34, 102, 101, 101, 100, 73, 68, 34, 58,
        34, 48, 120, 48, 48, 48, 51, 55, 100, 97, 48, 54, 100, 53, 54, 100, 48, 56, 51, 102, 101,
        53, 57, 57, 51, 57, 55, 97, 52, 55, 54, 57, 97, 48, 52, 50, 100, 54, 51, 97, 97, 55, 51,
        100, 99, 52, 101, 102, 53, 55, 55, 48, 57, 100, 51, 49, 101, 57, 57, 55, 49, 97, 53, 98,
        52, 51, 57, 34, 44, 34, 102, 117, 108, 108, 82, 101, 112, 111, 114, 116, 34, 58, 34, 48,
        120, 48, 48, 48, 54, 50, 101, 57, 100, 57, 101, 56, 49, 53, 102, 50, 52, 100, 56, 100, 50,
        51, 99, 102, 53, 49, 99, 56, 100, 55, 102, 99, 101, 100, 53, 49, 50, 54, 50, 49, 53, 51,
        99, 97, 101, 57, 101, 53, 101, 101, 97, 54, 99, 55, 100, 53, 48, 51, 54, 56, 56, 97, 49,
        48, 49, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 52, 53, 50, 53, 99, 100, 48, 51, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 101, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 50, 50, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 50,
        56, 48, 48, 49, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 49, 50, 48, 48, 48, 48, 51, 55, 100, 97,
        48, 54, 100, 53, 54, 100, 48, 56, 51, 102, 101, 53, 57, 57, 51, 57, 55, 97, 52, 55, 54, 57,
        97, 48, 52, 50, 100, 54, 51, 97, 97, 55, 51, 100, 99, 52, 101, 102, 53, 55, 55, 48, 57,
        100, 51, 49, 101, 57, 57, 55, 49, 97, 53, 98, 52, 51, 57, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 54, 55, 50, 101, 51, 98, 55, 53, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 54, 55,
        50, 101, 51, 98, 55, 53, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 49, 102, 48, 54, 56, 51, 50, 53, 57,
        49, 100, 99, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 49, 97, 98, 51, 51, 53, 48, 49, 99, 97, 48, 57, 51, 99, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 54, 55, 50, 102, 56, 99, 102, 53, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 49, 48, 50, 57, 97, 102,
        48, 102, 54, 51, 56, 56, 99, 56, 101, 49, 54, 50, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 49, 48, 50, 57, 97, 97, 50, 51, 50, 56,
        48, 102, 54, 97, 100, 97, 99, 52, 56, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 49, 48, 50, 57, 98, 53, 101, 56, 55, 99, 102, 100, 55,
        55, 55, 98, 51, 102, 56, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 50, 101, 98, 48, 99, 50, 97, 102, 55, 56, 100, 102, 97, 56, 97, 51, 52, 54, 51, 49,
        102, 98, 51, 56, 53, 97, 98, 55, 50, 57, 56, 50, 48, 97, 98, 55, 98, 53, 48, 56, 99, 54,
        52, 99, 53, 52, 56, 57, 97, 54, 97, 100, 49, 97, 48, 57, 51, 100, 102, 102, 51, 53, 98, 99,
        52, 53, 49, 51, 54, 54, 49, 97, 101, 101, 50, 54, 99, 55, 99, 57, 56, 97, 49, 56, 50, 56,
        52, 51, 102, 54, 49, 98, 53, 48, 53, 49, 51, 51, 102, 54, 99, 49, 50, 100, 55, 50, 101, 50,
        49, 54, 53, 56, 54, 99, 102, 56, 52, 99, 101, 100, 102, 99, 57, 52, 48, 98, 48, 49, 100,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
        48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 50, 55, 98, 56, 52, 56,
        53, 57, 50, 57, 99, 54, 97, 49, 101, 51, 57, 55, 53, 100, 102, 97, 101, 101, 55, 56, 50,
        53, 102, 54, 49, 53, 100, 101, 48, 100, 52, 53, 48, 100, 57, 53, 57, 52, 51, 98, 98, 100,
        56, 49, 55, 102, 54, 98, 97, 101, 101, 100, 49, 57, 97, 55, 52, 55, 100, 50, 97, 99, 100,
        55, 49, 98, 52, 56, 101, 97, 102, 55, 99, 51, 53, 55, 57, 50, 101, 98, 98, 53, 54, 98, 54,
        50, 99, 52, 97, 101, 100, 49, 54, 48, 49, 56, 99, 53, 101, 98, 48, 100, 52, 55, 50, 51, 49,
        100, 98, 57, 97, 102, 48, 99, 53, 56, 99, 54, 57, 98, 55, 53, 51, 34, 44, 34, 118, 97, 108,
        105, 100, 70, 114, 111, 109, 84, 105, 109, 101, 115, 116, 97, 109, 112, 34, 58, 49, 55, 51,
        49, 48, 56, 51, 49, 50, 53, 44, 34, 111, 98, 115, 101, 114, 118, 97, 116, 105, 111, 110,
        115, 84, 105, 109, 101, 115, 116, 97, 109, 112, 34, 58, 49, 55, 51, 49, 48, 56, 51, 49, 50,
        53, 125, 125,
    ];

    (mock_server, stream, mock_report_v3_data)
}

#[tokio::test]
async fn test_stream_ha_read_report() {
    let (mock_server, mut stream, mock_report_v3_data) = prepare_scenario().await;

    mock_server.send_binary(mock_report_v3_data).await;

    // Allow some time for the client to receive all reports.
    sleep(Duration::from_millis(500)).await;

    tokio::select! {
        result = stream.read() => {
            match result {
                Ok(response) => {
                    let report = response.report;
                    let feed_version = report.feed_id.to_hex_string()[..6].to_string();
                    assert_eq!(feed_version, "0x0003");
                }
                Err(_) => {}
            }
        }
    }

    stream.close().await.expect("Failed to close stream");
}

#[tokio::test]
async fn test_stream_ha_graceful_shutdown() {
    let (_, mut stream, _) = prepare_scenario().await;

    stream.close().await.expect("Failed to close stream");
    let mut stats = stream.get_stats();
    assert_eq!(stats.configured_connections, NUMBER_OF_CONNECTIONS);
    assert_eq!(stats.active_connections, 0);

    stream.close().await.expect("Failed to close stream"); // Attemting to close the stream again should not cause an error.
    stats = stream.get_stats();
    assert_eq!(stats.configured_connections, NUMBER_OF_CONNECTIONS);
    assert_eq!(stats.active_connections, 0);
}

#[tokio::test]
async fn test_stream_ha_reconnect() {
    let (mock_server, stream, _) = prepare_scenario().await;

    mock_server.drop_connections().await;

    // Allow some time for the client to try to reconnect.
    sleep(Duration::from_millis(500)).await;

    let expected_full_reconnects = 1;
    let expected_partial_reconnects = NUMBER_OF_CONNECTIONS - expected_full_reconnects;

    let stats = stream.get_stats();

    assert_eq!(stats.full_reconnects, expected_full_reconnects);
    assert_eq!(stats.partial_reconnects, expected_partial_reconnects);
}

#[tokio::test]
async fn test_stream_ha_filter_duplicate_reports() {
    let (mock_server, mut stream, mock_report_v3_data) = prepare_scenario().await;

    mock_server.send_binary(mock_report_v3_data).await;

    // Allow some time for the client to receive all reports.
    sleep(Duration::from_millis(500)).await;

    tokio::select! {
        result = stream.read() => {
            result.expect("Failed to read report");
        }
    }

    stream.close().await.expect("Failed to close stream");

    let expected_total_received = NUMBER_OF_CONNECTIONS;
    let expected_accepted = 1;
    let expected_deduplicated = NUMBER_OF_CONNECTIONS - expected_accepted;

    let stats = stream.get_stats();

    assert_eq!(stats.total_received, expected_total_received);
    assert_eq!(stats.accepted, expected_accepted);
    assert_eq!(stats.deduplicated, expected_deduplicated);
}

#[tokio::test]
async fn test_stream_ha_reconnect_merge() {
    let (mock_server, mut stream, mock_report_v3_data) = prepare_scenario().await;
    let same_report_data = mock_report_v3_data.clone();

    // Send report data before dropping connections.
    mock_server.send_binary(mock_report_v3_data).await;

    // Allow some time for the client to receive all reports.
    sleep(Duration::from_millis(500)).await;

    // Drop all connections.
    mock_server.drop_connections().await;

    // Allow some time for the client to try to reconnect.
    sleep(Duration::from_millis(500)).await;

    // Send the same report data after reconnection to test for duplicates filtering.
    mock_server.send_binary(same_report_data).await;

    // Allow some time for the client to receive all reports.
    sleep(Duration::from_millis(500)).await;

    // Attempt to read reports after reconnection.
    tokio::select! {
        result = stream.read() => {
            result.expect("Failed to read report");
        }
    }

    stream.close().await.expect("Failed to close stream");

    let expected_total_received = NUMBER_OF_CONNECTIONS * 2; // Because the same report was sent twice.
    let expected_accepted = 1;
    let expected_deduplicated = expected_total_received - expected_accepted;

    let stats = stream.get_stats();

    assert_eq!(stats.total_received, expected_total_received);
    assert_eq!(stats.accepted, expected_accepted);
    assert_eq!(stats.deduplicated, expected_deduplicated);
}

#[tokio::test]
#[ignore] // Ignored because it takes a while to complete. To run it, use this command: cargo test -- --ignored
async fn test_stream_ha_max_reconnection_attempts() {
    // Monitor client behavior.
    tracing_subscriber::fmt()
        .with_timer(UtcTime::rfc_3339())
        .with_max_level(tracing::Level::DEBUG)
        .init();

    let (mock_server, stream, _) = prepare_scenario().await;

    mock_server.shutdown().await;

    // Allow enough time for clients to perform all reconnection attempts.
    let mut backoff = MIN_WS_RECONNECT_INTERVAL;
    let mut total_sleep = Duration::ZERO;

    for _ in 0..MAX_RECONNECT_ATTEMPTS {
        total_sleep += backoff;
        backoff = (backoff * 2).min(MAX_WS_RECONNECT_INTERVAL);
    }

    sleep(total_sleep).await;

    let stats = stream.get_stats();
    assert_eq!(stats.active_connections, 0);
}
