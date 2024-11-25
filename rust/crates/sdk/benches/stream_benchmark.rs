use data_streams_report::feed_id::ID;
use data_streams_sdk::{
    config::{Config, WebSocketHighAvailability},
    stream::Stream,
};

use criterion::{criterion_group, criterion_main, Criterion};
use dotenv::dotenv;
use std::env;
use std::time::Duration;
use tokio::runtime::Runtime;

fn stream_benchmark(c: &mut Criterion) {
    dotenv().ok();

    // ------------------------------------------------------------
    //                       Criterion setup
    // ------------------------------------------------------------
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("stream_group");
    group.measurement_time(Duration::from_secs(300));
    group.sample_size(50);

    // ------------------------------------------------------------
    //                      Benchmarking setup
    // ------------------------------------------------------------
    let api_key = env::var("API_KEY").expect("API_KEY must be set in .env");
    let user_secret = env::var("USER_SECRET").expect("USER_SECRET must be set in .env");

    let rest_url = "";
    let ws_url = "wss://ws.testnet-dataengine.chain.link,wss://ws.testnet-dataengine.chain.link";

    let eth_usd_feed_id =
        ID::from_hex_str("0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782")
            .unwrap();
    let btc_usd_feed_id: ID =
        ID::from_hex_str("0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439")
            .unwrap();
    let feed_ids = vec![eth_usd_feed_id, btc_usd_feed_id];

    let config = Config::new(
        api_key.to_string(),
        user_secret.to_string(),
        rest_url.to_string(),
        ws_url.to_string(),
    )
    .with_ws_ha(WebSocketHighAvailability::Enabled) // Enable WebSocket High Availability Mode
    .build()
    .unwrap();

    // ------------------------------------------------------------
    //                      Benchmarking
    // ------------------------------------------------------------
    group.bench_function("ha_stream", |b| {
        b.to_async(&rt).iter(|| async {
            let mut stream = Stream::new(&config, feed_ids.clone()).await.unwrap();
            stream.listen().await.unwrap();

            let mut counter = 0;
            while counter < 10 {
                stream.read().await.unwrap();
                counter += 1;
            }

            stream.close().await.unwrap();
        });
    });

    group.finish();
}

criterion_group!(benches, stream_benchmark);
criterion_main!(benches);
