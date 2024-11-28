# Get Report

This example demontstrates how to get the report for a ETH/USD feed at the example timestamp (1729506909) on Arbitrum Sepolia.

## Running the example

Make sure you git cloned the [https://github.com/smartcontractkit/data-streams-sdk](https://github.com/smartcontractkit/data-streams-sdk) repository and navigated to the `rust` directory.

```bash
cargo run --example get_report
```

## Examine the code

The code for this example can be found in the `get_report.rs` file in the `crates/sdk/examples` directory of the `data-streams-sdk` repository.

```rust
use data_streams_report::feed_id::ID;
use data_streams_report::report::{decode_full_report, v3::ReportDataV3};
use data_streams_sdk::client::Client;
use data_streams_sdk::config::Config;
use std::error::Error;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let api_key = "YOUR_API_KEY_GOES_HERE";
    let user_secret = "YOUR_USER_SECRET_GOES_HERE";
    let rest_url = "https://api.testnet-dataengine.chain.link";
    let ws_url = "wss://api.testnet-dataengine.chain.link/ws";

    let eth_usd_feed_id =
        ID::from_hex_str("0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782")
            .unwrap();
    let timestamp = 1732395909; // Example timestamp

    // Initialize the configuration
    let config = Config::new(
        api_key.to_string(),
        user_secret.to_string(),
        rest_url.to_string(),
        ws_url.to_string(),
    )
    .build()?;

    // Initialize the client
    let client = Client::new(config)?;

    // Make a GET request to "/api/v1/reports?feedID={feedID}&timestamp={timestamp}"
    let response = client.get_report(eth_usd_feed_id, timestamp).await?;

    println!("Received Report");
    let report = response.report;

    println!("Feed ID: {}", report.feed_id.to_hex_string());
    println!("Valid From Timestamp: {}", report.valid_from_timestamp);
    println!("Observations Timestamp: {}", report.observations_timestamp);

    // Uncomment to print the raw report data
    // println!("Raw Report data: {}", report.full_report);

    let full_report = hex::decode(&report.full_report[2..])?;
    let (_report_context, report_blob) = decode_full_report(&full_report)?;

    let report_data = ReportDataV3::decode(&report_blob)?;
    println!("{:#?}", report_data);

    Ok(())
}
```
