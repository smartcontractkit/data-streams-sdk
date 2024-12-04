# Get Reports Bulk

This example demonstrates how to get reports for ETH/USD and BTC/USD feeds at the example timestamp (1729506909) on Arbitrum Sepolia.

## Running the example

Make sure you git cloned the [https://github.com/smartcontractkit/data-streams-sdk](https://github.com/smartcontractkit/data-streams-sdk) repository and navigated to the `rust` directory.

```bash
cargo run --example get_reports_bulk
```

## Example output

```bash
Report 0:
Feed ID: 0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782
Valid From Timestamp: 1732395909
Observations Timestamp: 1732395909
ReportDataV3 {
    feed_id: 0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782,
    valid_from_timestamp: 1732395909,
    observations_timestamp: 1732395909,
    native_fee: 29340742848900,
    link_fee: 5755723635476200,
    expires_at: 1732482309,
    benchmark_price: 3408230000000000000000,
    bid: 3408068208000000000000,
    ask: 3408391255216988000000,
}
Report 1:
Feed ID: 0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439
Valid From Timestamp: 1732395909
Observations Timestamp: 1732395909
ReportDataV3 {
    feed_id: 0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439,
    valid_from_timestamp: 1732395909,
    observations_timestamp: 1732395909,
    native_fee: 29343723231300,
    link_fee: 5755723635476200,
    expires_at: 1732482309,
    benchmark_price: 97731000145427245000000,
    bid: 97728886718324385000000,
    ask: 97736225246500000000000,
}
```

## Examine the code

The code for this example can be found in the `get_reports_bulk.rs` file in the `crates/sdk/examples` directory of the `data-streams-sdk` repository.

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
    let btc_usd_feed_id: ID =
        ID::from_hex_str("0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439")
            .unwrap();

    let feed_ids = vec![eth_usd_feed_id, btc_usd_feed_id];
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

    // Make a GET request to "/api/v1/reports/bulk?feedIDs={FeedID1},{FeedID2},...&timestamp={timestamp}"
    let response = client.get_reports_bulk(&feed_ids, timestamp).await?;
    for (index, report) in response.iter().enumerate() {
        println!("Report {}:", index);
        println!("Feed ID: {}", report.feed_id.to_hex_string());
        println!("Valid From Timestamp: {}", report.valid_from_timestamp);
        println!("Observations Timestamp: {}", report.observations_timestamp);

        // Uncomment to print the raw report data
        // println!("Raw Report data: {}", report.full_report);

        let full_report = hex::decode(&report.full_report[2..])?;
        let (_report_context, report_blob) = decode_full_report(&full_report)?;

        let report_data = ReportDataV3::decode(&report_blob)?;
        println!("{:#?}", report_data);
    }

    // Prints:
    //
    // Report 0:
    // Feed ID: 0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782
    // Valid From Timestamp: 1732395909
    // Observations Timestamp: 1732395909
    // ReportDataV3 {
    //     feed_id: 0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782,
    //     valid_from_timestamp: 1732395909,
    //     observations_timestamp: 1732395909,
    //     native_fee: 29340742848900,
    //     link_fee: 5755723635476200,
    //     expires_at: 1732482309,
    //     benchmark_price: 3408230000000000000000,
    //     bid: 3408068208000000000000,
    //     ask: 3408391255216988000000,
    // }
    // Report 1:
    // Feed ID: 0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439
    // Valid From Timestamp: 1732395909
    // Observations Timestamp: 1732395909
    // ReportDataV3 {
    //     feed_id: 0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439,
    //     valid_from_timestamp: 1732395909,
    //     observations_timestamp: 1732395909,
    //     native_fee: 29343723231300,
    //     link_fee: 5755723635476200,
    //     expires_at: 1732482309,
    //     benchmark_price: 97731000145427245000000,
    //     bid: 97728886718324385000000,
    //     ask: 97736225246500000000000,
    // }

    Ok(())
}
```
