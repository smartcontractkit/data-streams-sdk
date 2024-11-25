use data_streams_report::feed_id::ID;
use data_streams_sdk::config::Config;
use data_streams_sdk::stream::Stream;
use tokio::signal;
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
    let ws_url = "wss://ws.testnet-dataengine.chain.link";

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
    .build()?;

    let mut stream = Stream::new(&config, feed_ids).await?;
    stream.listen().await?;

    loop {
        tokio::select! {
            _ = signal::ctrl_c() => {
                println!("Ctrl + C received, exiting...");
                break;
            }
            result = stream.read() => {
                match result {
                    Ok(response) => {
                        println!("Received raw report: {:?}", response);
                    }
                    Err(e) => {
                        eprintln!("Error reading report: {:?}", e);
                    }
                }
            }
        }
    }

    stream.close().await?;

    Ok(())
}
