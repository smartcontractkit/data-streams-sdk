use data_streams_sdk::client::Client;
use data_streams_sdk::config::Config;
use reqwest::Response;
use std::error::Error;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let api_key = "YOUR_API_KEY_GOES_HERE";
    let user_secret = "YOUR_USER_SECRET_GOES_HERE";
    let rest_url = "https://api.testnet-dataengine.chain.link";
    let ws_url = "wss://api.testnet-dataengine.chain.link/ws";

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

    // Make a GET request to "/api/v1/feeds"
    match client.get_feeds().await {
        Ok(feeds) => {
            println!("Available Feeds:");
            for feed in feeds {
                println!("{:#?}", feed.feed_id.to_hex_string());
            }
        }
        Err(e) => {
            eprintln!("Error fetching feeds: {}", e);
        }
    }

    Ok(())
}
