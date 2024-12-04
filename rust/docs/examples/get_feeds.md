# Get Feeds

This example demontstrates how to get the list of all Data Streams feeds.

## Running the example

Make sure you git cloned the [https://github.com/smartcontractkit/data-streams-sdk](https://github.com/smartcontractkit/data-streams-sdk) repository and navigated to the `rust` directory.

```bash
cargo run --example get_feeds
```

## Examine the code

The code for this example can be found in the `get_feeds.rs` file in the `crates/sdk/examples` directory of the `data-streams-sdk` repository.

```rust
use data_streams_sdk::client::Client;
use data_streams_sdk::config::Config;
use std::error::Error;

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
    )
    .build()?;

    // Initialize the client
    let client = Client::new(config)?;

    // Make a GET request to "/api/v1/feeds"
    let feeds = client.get_feeds().await?;

    println!("Available Feeds:");
    for feed in feeds {
        println!("{:#?}", feed.feed_id.to_hex_string());
    }

    Ok(())
}
```
