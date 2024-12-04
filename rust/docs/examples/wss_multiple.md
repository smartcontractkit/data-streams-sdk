# WSS: Multiple Streams in HA mode

This example demonstrates how to connect to the Data Streams WebSocket server and subscribe to 2 streams of ETH/USD and BTC/USD Feed Reports on Arbitrum Sepolia.

The Chainlink Data Streams SDK use the `tracing` crate for logging. It is optional. If you want to enable it, install the `tracing-subscriber` crate, and include the following code in your project:

```rust
use tracing_subscriber::fmt::time::UtcTime;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_timer(UtcTime::rfc_3339())
        .with_max_level(tracing::Level::DEBUG)
        .init();
}
```

## HA (High Availability) mode

This example is safe for concurrent usage. When HA (High Availablity) mode is enabled and at least 2 origins are provided, the Stream will maintain at least 2 concurrent connections to different instances to ensure high availability, fault tolerance and minimize the risk of report gaps.

To enable HA mode, set the `ws_ha` parameter to `true` in the `Config` struct and provide the list of Web Socket origins as the comma-separated string in the `ws_url` parameter.

```rust
    let ws_url = "wss://ws.testnet-dataengine.chain.link,wss://ws.testnet-dataengine.chain.link";

    // Initialize the configuration
    let config = Config::new(
        api_key.to_string(),
        user_secret.to_string(),
        rest_url.to_string(),
        ws_url.to_string(),
    )
    .with_ws_ha(WebSocketHighAvailability::Enabled) // Enable WebSocket High Availability Mode
    .build()?;
```

## Running the example

Make sure you git cloned the [https://github.com/smartcontractkit/data-streams-sdk](https://github.com/smartcontractkit/data-streams-sdk) repository and navigated to the `rust` directory.

```bash
cargo run --example wss_multiple
```

## Examine the code

The code for this example can be found in the `wss_multiple.rs` file in the `crates/sdk/examples` directory of the `data-streams-sdk` repository. It will subscribe to the ETH/USD and BTC/USD feeds on Arbitrum Sepolia Stream and start reading reports. For each report it will log the feed ID, valid from timestamp, obesrvations timestamp and decode the report data to V3 Report, for 10 runs. After 5th run it will log current statistics. After 10th run it will exit the loop and gracefully close all streams. After that it will log the final statistics.

```rust
use data_streams_report::feed_id::ID;
use data_streams_report::report::decode_full_report;
use data_streams_report::report::v3::ReportDataV3;
use data_streams_sdk::config::{Config, WebSocketHighAvailability};
use data_streams_sdk::stream::Stream;
use tracing_subscriber::fmt::time::UtcTime;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_timer(UtcTime::rfc_3339())
        .with_max_level(tracing::Level::DEBUG)
        .init();

    let api_key = "YOUR_API_KEY_GOES_HERE";
    let user_secret = "YOUR_USER_SECRET_GOES_HERE";
    let rest_url = "https://api.testnet-dataengine.chain.link";
    let ws_url = "wss://ws.testnet-dataengine.chain.link,wss://ws.testnet-dataengine.chain.link";

    let eth_usd_feed_id =
        ID::from_hex_str("0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782")
            .unwrap();
    let btc_usd_feed_id: ID =
        ID::from_hex_str("0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439")
            .unwrap();

    let feed_ids = vec![eth_usd_feed_id, btc_usd_feed_id];

    // Initialize the configuration
    let config = Config::new(
        api_key.to_string(),
        user_secret.to_string(),
        rest_url.to_string(),
        ws_url.to_string(),
    )
    .with_ws_ha(WebSocketHighAvailability::Enabled) // Enable WebSocket High Availability Mode
    .build()?;

    let mut stream = Stream::new(&config, feed_ids).await?;

    // Start listening for messages
    stream.listen().await?;

    let mut counter = 0;

    // Read reports in a loop
    while counter < 10 {
        match stream.read().await {
            Ok(response) => {
                counter += 1;
                println!("Received raw report: {:?}", response);

                // Process the report if needed
                let report = response.report;
                println!("Feed ID: {}", report.feed_id.to_hex_string());
                println!("Valid From Timestamp: {}", report.valid_from_timestamp);
                println!("Observations Timestamp: {}", report.observations_timestamp);

                let full_report = hex::decode(&report.full_report[2..])?;
                let (_report_context, report_blob) = decode_full_report(&full_report)?;

                let report_data = ReportDataV3::decode(&report_blob)?;
                println!("{:#?}", report_data);
            }
            Err(e) => {
                eprintln!("Error reading report: {:?}", e);
                break;
            }
        }

        if counter == 5 {
            let stats = stream.get_stats();
            println!("Current Stream stats: {:#?}", stats);
        }
    }

    stream.close().await?;

    let stats = stream.get_stats();
    println!("Stream stats: {:#?}", stats);

    Ok(())
}
```
