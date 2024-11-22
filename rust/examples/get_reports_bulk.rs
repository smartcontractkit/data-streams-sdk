use data_streams_sdk::client::Client;
use data_streams_sdk::config::Config;
use data_streams_sdk::feed::ID;
use data_streams_sdk::report::{decode_full_report, v3::ReportDataV3};
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
    let timestamp = 1729506909; // Example timestamp

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
    // Valid From Timestamp: 1729506909
    // Observations Timestamp: 1729506909
    // ReportDataV3 {
    //     feedId: 0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782,
    //     validFromTimestamp: 1729506909,
    //     observationsTimestamp: 1729506909,
    //     nativeFee: 36940126380400,
    //     linkFee: 8490469890258900,
    //     expiresAt: 1729593309,
    //     benchmarkPrice: 2707083321000000000000,
    //     bid: 2707040224000000000000,
    //     ask: 2707132663418226000000,
    // }
    // Report 1:
    // Feed ID: 0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439
    // Valid From Timestamp: 1729506909
    // Observations Timestamp: 1729506909
    // ReportDataV3 {
    //     feedId: 0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439,
    //     validFromTimestamp: 1729506909,
    //     observationsTimestamp: 1729506909,
    //     nativeFee: 36938874359400,
    //     linkFee: 8490443733792400,
    //     expiresAt: 1729593309,
    //     benchmarkPrice: 68366578060671980000000,
    //     bid: 68365711259711160000000,
    //     ask: 68367314517132790000000,
    // }

    Ok(())
}
