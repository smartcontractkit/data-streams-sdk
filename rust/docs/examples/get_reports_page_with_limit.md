# Get Reports Page with Limit

This example demonstrates how to get multiple sequential reports for a ETH/USD feed, starting at the example timestamp (1729506909) on Arbitrum Sepolia. The limit parameter specifies the number of reports to be returned.

## Running the example

Make sure you git cloned the https://github.com/smartcontractkit/data-streams-sdk repository and navigated to the `rust` directory.

```bash
cargo run --example get_reports_page_with_limit
```

## Examine the code

The code for this example can be found in the `get_reports_page_with_limit.rs` file in the `examples` directory of the `data-streams-sdk` repository.

```rust
use data_streams_sdk::client::Client;
use data_streams_sdk::config::Config;
use data_streams_sdk::feed::ID;
use data_streams_sdk::report::{decode_full_report, v3::ReportDataV3};
use reqwest::Response;
use std::error::Error;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let api_key = "YOUR_API_KEY_GOES_HERE";
    let user_secret = "YOUR_USER_SECRET_GOES_HERE";
    let rest_url = "https://api.testnet-dataengine.chain.link";
    let ws_url = "wss://api.testnet-dataengine.chain.link/ws";

    let eth_usd_feed_id =
        ID::from_hex_str("0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782")
            .unwrap();
    let start_timestamp = 1729506909; // Example timestamp
    let limit = 5; // Return 5 reports

    // Initialize the configuration
    let config = Config::new(
        api_key.to_string(),
        user_secret.to_string(),
        rest_url.to_string(),
        ws_url.to_string(),
        false,   // ws_ha
        Some(5), // ws_max_reconnect
        false,   // insecure_skip_verify
        Some(Arc::new(|response: &Response| {
            // Example: Log the response status
            println!("Received response with status: {}", response.status());
        })),
    )?;

    // Initialize the client
    let client = Client::new(config)?;

    // Make a GET request to "/api/v1/reports/page?feedID={FeedID}&startTimestamp={StartTimestamp}&limit={Limit}"
    match client
        .get_reports_page_with_limit(eth_usd_feed_id, start_timestamp, limit)
        .await
    {
        Ok(response) => {
            for (index, report) in response.iter().enumerate() {
                println!("Report {}:", index);
                println!("Feed ID: {}", report.feed_id.to_hex_string());
                println!("Valid From Timestamp: {}", report.valid_from_timestamp);
                println!("Observations Timestamp: {}", report.observations_timestamp);

                // Uncomment to print the raw report data
                // println!("Raw Report data: {}", report.full_report);

                let payload = hex::decode(&report.full_report[2..]).unwrap();
                match decode_full_report(&payload) {
                    Ok((_report_context, report_blob)) => {
                        let report_data = ReportDataV3::decode(&report_blob);

                        match report_data {
                            Ok(report_data) => {
                                println!("{:#?}", report_data);
                            }
                            Err(e) => {
                                println!("Error decoding report data: {}", e);
                            }
                        }
                    }
                    Err(e) => println!("Error decoding full report data: {}", e),
                }
            }
        }
        Err(e) => {
            eprintln!("Error fetching reports: {}", e);
        }
    }

    Ok(())
}
```
