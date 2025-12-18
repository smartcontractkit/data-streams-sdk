# Data Streams SDK

The Data Streams SDK is a Rust library that provides a convenient way to consume data from the Chainlink Data Streams DON. It supports both the REST API and WebSocket API.

## Prerequisites

- Rust 1.70 or later
- Valid Chainlink Data Streams credentials

## Project Structure

The project is organized into the following crates:

- `chainlink-data-streams-report` - The crate that provides the data structures for the reports.
- `chainlink-data-streams-sdk` - The main crate that provides the REST and WebSocket clients.

## Installation

Add the following to your `Cargo.toml`:

```toml
[dependencies]
chainlink-data-streams-report = "1.2.1"
chainlink-data-streams-sdk = { version = "1.2.1", features = ["full"] }
```

#### Features

- `"rest"` - Enables the REST API client
- `"websocket"` - Enables the WebSocket client
- `"tracing"` - Enables logging with the `tracing` crate
- `"full"` - Enables all of the above features. Default feature.

## Usage

### REST API

Here is the basic example that demontstrates how to get the latest report for a ETH/USD feed on Arbitrum Sepolia:

```rust
use chainlink_data_streams_report::feed_id::ID;
use chainlink_data_streams_report::report::{decode_full_report, v3::ReportDataV3};
use chainlink_data_streams_sdk::client::Client;
use chainlink_data_streams_sdk::config::Config;
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

    // Make a GET request to "/api/v1/reports/latest?feedID={feed_id}"
    let response = client.get_latest_report(eth_usd_feed_id).await?;

    println!("Latest Report");
    let report = response.report;

    println!("Feed ID: {}", report.feed_id.to_hex_string());
    println!("Valid From Timestamp: {}", report.valid_from_timestamp);
    println!("Observations Timestamp: {}", report.observations_timestamp);

    // Uncomment to print the raw report data
    // println!("Raw Report data: {}", report.full_report);

    let full_report = hex::decode(&report.full_report[2..])?;
    let (_report_context, report_blob) = decode_full_report(&full_report)?;

    let report_data = ReportDataV3::decode(&report_blob)?;
    println!("{:#?}", report_data);

    Ok(())
}
```

### WebSocket API

Here is the basic example that demonstrates how to connect to the Data Streams WebSocket server and subscribe to a single stream of ETH/USD Feed Reports on Arbitrum Sepolia:

```rust
use chainlink_data_streams_report::feed_id::ID;
use chainlink_data_streams_sdk::config::Config;
use chainlink_data_streams_sdk::stream::Stream;
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
```

## Building from Source

1. Clone the repository:

```sh
git clone https://github.com/smartcontractkit/data-streams-sdk
```

2. Build the library:

```sh
cargo build
```

3. Run the tests:

```sh
cargo test
```

### Documentation

To generate the documentation, run:

```sh
cargo doc --no-deps --open
```

### MdBook

To preview the Book locally, run:

```sh
mdbook serve --open
```

### Benchmarks

Create an `.env` file in the root of the `rust/crates/sdk` directory with the following content:

```sh
API_KEY="YOUR_API_KEY_GOES_HERE"
USER_SECRET="YOUR_USER_SECRET_GOES_HERE"
```

To run the benchmarks, run:

```sh
cargo bench
```

and then to view the results, run:

```sh
open target/criterion/report/index.html
```

### Flamegraphs

To generate flamegraphs for each of the examples, run:

```sh
cargo flamegraph [--root] --example <example_name>
```

The `--root` flag is necessary for running on MacOS. Read more [here](https://github.com/flamegraph-rs/flamegraph?tab=readme-ov-file#dtrace-on-macos).

The new `flamegraph.svg` file will be generated.

To generate a flamegraph for integration tests, run:

```sh
cargo flamegraph --root --test stream_integration_tests
```

The `test_stream_ha_max_reconnection_attempts` test is ignored by default because it takes a while to complete. To generate a flamegraph with it included, remove the `#[ignore]` attribute from the test.

To generate a flamegraph for benchmarks, run:

```sh
cargo flamegraph --bench <benchmark_name>
```

for example, `cargo flamegraph --root --bench rest_benchmark` or `cargo flamegraph --root --bench stream_benchmark`.
