use data_streams_sdk::client::Client;
use data_streams_sdk::config::Config;
use data_streams_sdk::feed::ID;
use data_streams_sdk::report::compress::compress_report;
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
    let timestamp = 1729506909; // Example timestamp

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

    match client.get_report(eth_usd_feed_id, timestamp).await {
        Ok(response) => match compress_report(response.report) {
            Ok(compressed_report) => {
                println!("Compressed Report: {:#?}", hex::encode(&compressed_report));
            }
            Err(e) => {
                eprintln!("Error compressing report: {:#?}", e);
            }
        },
        Err(e) => {
            eprintln!("Error fetching report: {}", e);
        }
    }

    Ok(())
}
