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
