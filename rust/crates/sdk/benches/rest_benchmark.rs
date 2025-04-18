use chainlink_data_streams_report::{
    feed_id::ID,
    report::{
        compress::{compress_report, compress_report_raw},
        decode_full_report,
    },
};
use chainlink_data_streams_sdk::{client::Client, config::Config};

use criterion::{criterion_group, criterion_main, Criterion};
use dotenv::dotenv;
use std::env;
use std::time::Duration;
use tokio::runtime::Runtime;

fn rest_benchmark(c: &mut Criterion) {
    dotenv().ok();

    // ------------------------------------------------------------
    //                       Criterion setup
    // ------------------------------------------------------------
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("rest_group");
    group.measurement_time(Duration::from_secs(30));
    group.sample_size(50);

    // ------------------------------------------------------------
    //                      Benchmarking setup
    // ------------------------------------------------------------
    let api_key = env::var("API_KEY").expect("API_KEY must be set in .env");
    let user_secret = env::var("USER_SECRET").expect("USER_SECRET must be set in .env");

    let rest_url = "https://api.testnet-dataengine.chain.link";
    let ws_url = "";

    let eth_usd_feed_id =
        ID::from_hex_str("0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782")
            .unwrap();
    let btc_usd_feed_id: ID =
        ID::from_hex_str("0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439")
            .unwrap();
    let feed_ids = vec![eth_usd_feed_id, btc_usd_feed_id];
    let timestamp = 1732395909; // Example timestamp
    let payload = "0006bd87830d5f336e205cf5c63329a1dab8f5d56812eaeb7c69300e66ab8e22000000000000000000000000000000000000000000000000000000000cf7ed13000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000003000101000101000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012000030ab7d02fbba9c6304f98824524407b1f494741174320cfd17a2c22eec1de0000000000000000000000000000000000000000000000000000000066a8f5c60000000000000000000000000000000000000000000000000000000066a8f5c6000000000000000000000000000000000000000000000000000057810653dd9000000000000000000000000000000000000000000000000000541315da76d6100000000000000000000000000000000000000000000000000000000066aa474600000000000000000000000000000000000000000000000009a697ee4230350400000000000000000000000000000000000000000000000009a6506d1426d00000000000000000000000000000000000000000000000000009a77d03ae355fe0000000000000000000000000000000000000000000000000000000000000000672bac991f5233df89f581dc02a89dd8d48419e3558b247d3e65f4069fa45c36658a5a4820dc94fc47a88a21d83474c29ee38382c46b6f9a575b9ce8be4e689c03c76fac19fbec4a29dba704c72cc003a6be1f96af115e322321f0688e24720a5d9bd7136a1d96842ec89133058b888b2e6572b5d4114de2426195e038f1c9a5ce50016b6f5a5de07e08529b845e1c622dcbefa0cfa2ffd128e9932ecee8efd869bc56d09a50ceb360a8d366cfa8eefe3f64279c88bdbc887560efa9944238eb000000000000000000000000000000000000000000000000000000000000000060e2a800f169f26164533c7faff6c9073cd6db240d89444d3487113232f9c31422a0993bb47d56807d0dc26728e4c8424bb9db77511001904353f1022168723010c46627c890be6e701e766679600696866c888ec80e7dbd428f5162a24f2d8262f846bdb06d9e46d295dd8e896fb232be80534b0041660fe4450a7ede9bc3b230722381773a4ae81241568867a759f53c2bdd05d32b209e78845fc58203949e50a608942b270c456001e578227ad00861cf5f47b27b09137a0c4b7f8b4746cef";
    let payload = hex::decode(payload).unwrap();
    let limit = 5;

    let config = Config::new(
        api_key.to_string(),
        user_secret.to_string(),
        rest_url.to_string(),
        ws_url.to_string(),
    )
    .build()
    .unwrap();

    let client = Client::new(config).unwrap();

    // ------------------------------------------------------------
    //                      Benchmarking
    // ------------------------------------------------------------
    group.bench_function("decode_report_data", |b| {
        b.iter(|| decode_full_report(&payload))
    });

    group.bench_function("get_feeds", |b| b.to_async(&rt).iter(|| client.get_feeds()));

    group.bench_function("get_latest_report", |b| {
        b.to_async(&rt)
            .iter(|| client.get_latest_report(eth_usd_feed_id))
    });

    group.bench_function("get_report", |b| {
        b.to_async(&rt)
            .iter(|| client.get_report(eth_usd_feed_id, timestamp))
    });

    group.bench_function("get_reports_bulk", |b| {
        b.to_async(&rt)
            .iter(|| client.get_reports_bulk(&feed_ids, timestamp))
    });

    group.bench_function("get_reports_page", |b| {
        b.to_async(&rt)
            .iter(|| client.get_reports_page(eth_usd_feed_id, timestamp))
    });

    group.bench_function("get_reports_page_with_limit", |b| {
        b.to_async(&rt)
            .iter(|| client.get_reports_page_with_limit(eth_usd_feed_id, timestamp, limit))
    });

    group.bench_function("compress_report", |b| {
        b.iter(|| {
            let response = rt
                .block_on(client.get_report(eth_usd_feed_id, timestamp))
                .unwrap();
            compress_report(response.report).unwrap();
        })
    });

    group.bench_function("compress_report_raw", |b| {
        b.iter(|| compress_report_raw(&payload))
    });

    group.finish();
}

criterion_group!(benches, rest_benchmark);
criterion_main!(benches);
