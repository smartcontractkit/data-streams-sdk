use data_streams_sdk::config::Config;
use data_streams_sdk::feed::ID;
use data_streams_sdk::report::decode_full_report;
use data_streams_sdk::report::v3::ReportDataV3;
use data_streams_sdk::stream::Stream;
use reqwest::Response;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
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
        true,    // ws_ha
        Some(5), // ws_max_reconnect
        false,   // insecure_skip_verify
        Some(Arc::new(|response: &Response| {
            // Example: Log the response status
            println!("Received response with status: {}", response.status());
        })),
    )?;

    // let mut stream = Stream::new(&config, feed_ids).await?;
    // stream.listen().await?;

    let mut stream = Stream::new(&config, feed_ids).await?;

    // Start listening for messages
    stream.listen().await?;

    let mut counter = 0;

    // Read reports in a loop
    loop {
        match stream.read().await {
            Ok(response) => {
                counter += 1;
                println!("INFO Received report: {:?}", response);
                // Process the report as needed
                println!("INFO Feed ID: {}", response.report.feed_id.to_hex_string());

                let payload = hex::decode(&response.report.full_report[2..]).unwrap();
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
            Err(e) => {
                eprintln!("Error reading report: {:?}", e);
                break;
            }
        }

        if counter >= 10 {
            break;
        }
    }

    stream.close().await?;

    Ok(())
}
