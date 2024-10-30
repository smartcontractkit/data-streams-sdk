# Foundry guide

Integrate Chainlink Data Streams SDK with Foundry by creating a FFI test

## Setup the Foundry project

Start by creating a new Foundry project by running the `forge init` command.

### Install Chainlink Contracts

Then install the `@chainlink/contracts` package by running the following command:

```bash
forge install smartcontractkit/chainlink-brownie-contracts
```

and setting the remappings to `@chainlink/contracts/=lib/chainlink-brownie-contracts/contracts/src/`.

Your `foundry.toml` file should look like this:

```toml
# foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
remappings = [
    '@chainlink/contracts/=lib/chainlink-brownie-contracts/contracts/',
]

# See more config options https://github.com/foundry-rs/foundry/blob/master/crates/config/README.md#all-options
```

### Setup Environment Variables

Create a `.env` file in the root of the project with the following content:

```
ARBITRUM_SEPOLIA_RPC_URL = https://arb-sepolia.g.alchemy.com/v2/<YOUR_ALCHEMY_KEY>
API_KEY = <YOUR_DATA_STREAMS_API_KEY>
USER_SECRET = <YOUR_DATA_STREAMS_USER_SECRET>
```

## Create Example.sol contract

Create a new contract in the `src` directory called `Example.sol` with the content below. This is a simple contract that accepts a signed report from a Data Streams DON, verifies it using the Verifier contract, pays for verification in LINK and returns the verified price of the ETH/USD feed on Arbitrum Sepolia.

```ts
// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Common} from "@chainlink/contracts/src/v0.8/llo-feeds/libraries/Common.sol";
import {IVerifierFeeManager} from "@chainlink/contracts/src/v0.8/llo-feeds/interfaces/IVerifierFeeManager.sol";
import {IRewardManager} from "@chainlink/contracts/src/v0.8/llo-feeds/interfaces/IRewardManager.sol";
import {OwnerIsCreator} from "@chainlink/contracts/src/v0.8/shared/access/OwnerIsCreator.sol";
import {IERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/interfaces/IERC20.sol";

/**
 * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE FOR DEMONSTRATION PURPOSES.
 * DO NOT USE THIS CODE IN PRODUCTION.
 */

// Custom interfaces for IVerifierProxy and IFeeManager
interface IVerifierProxy {
    /**
     * @notice Verifies that the data encoded has been signed.
     * correctly by routing to the correct verifier, and bills the user if applicable.
     * @param payload The encoded data to be verified, including the signed
     * report.
     * @param parameterPayload Fee metadata for billing. For the current implementation this is just the abi-encoded fee token ERC-20 address.
     * @return verifierResponse The encoded report from the verifier.
     */
    function verify(bytes calldata payload, bytes calldata parameterPayload)
        external
        payable
        returns (bytes memory verifierResponse);

    function s_feeManager() external view returns (IVerifierFeeManager);
}

interface IFeeManager {
    /**
     * @notice Calculates the fee and reward associated with verifying a report, including discounts for subscribers.
     * This function assesses the fee and reward for report verification, applying a discount for recognized subscriber addresses.
     * @param subscriber The address attempting to verify the report. A discount is applied if this address
     * is recognized as a subscriber.
     * @param unverifiedReport The report data awaiting verification. The content of this report is used to
     * determine the base fee and reward, before considering subscriber discounts.
     * @param quoteAddress The payment token address used for quoting fees and rewards.
     * @return fee The fee assessed for verifying the report, with subscriber discounts applied where applicable.
     * @return reward The reward allocated to the caller for successfully verifying the report.
     * @return totalDiscount The total discount amount deducted from the fee for subscribers
     */
    function getFeeAndReward(address subscriber, bytes memory unverifiedReport, address quoteAddress)
        external
        returns (Common.Asset memory, Common.Asset memory, uint256);

    function i_linkAddress() external view returns (address);

    function i_rewardManager() external view returns (address);
}

contract Example is OwnerIsCreator {
    /**
     * @dev Represents a data report from a Data Streams feed for v3 schema (crypto feeds).
     * The `price`, `bid`, and `ask` values are carried to either 8 or 18 decimal places, depending on the feed.
     * For more information, see https://docs.chain.link/data-streams/crypto-feeds and https://docs.chain.link/data-streams/reference/report-schema
     */
    struct ReportV3 {
        bytes32 feedId; // The feed ID the report has data for.
        uint32 validFromTimestamp; // Earliest timestamp for which price is applicable.
        uint32 observationsTimestamp; // Latest timestamp for which price is applicable.
        uint192 nativeFee; // Base cost to validate a transaction using the report, denominated in the chain’s native token (e.g., WETH/ETH).
        uint192 linkFee; // Base cost to validate a transaction using the report, denominated in LINK.
        uint32 expiresAt; // Latest timestamp where the report can be verified onchain.
        int192 price; // DON consensus median price (8 or 18 decimals).
        int192 bid; // Simulated price impact of a buy order up to the X% depth of liquidity utilisation (8 or 18 decimals).
        int192 ask; // Simulated price impact of a sell order up to the X% depth of liquidity utilisation (8 or 18 decimals).
    }

    IVerifierProxy public s_verifier;

    constructor(address verifier) {
        s_verifier = IVerifierProxy(verifier);
    }

    function verifyReportAndReturnEthUsdFeedPrice(bytes calldata fullReport) external onlyOwner returns (int192) {
        ( /* bytes32[3] reportContextData */ , bytes memory reportData) = abi.decode(fullReport, (bytes32[3], bytes));

        // Handle billing
        IFeeManager feeManager = IFeeManager(address(s_verifier.s_feeManager()));
        IRewardManager rewardManager = IRewardManager(address(feeManager.i_rewardManager()));

        address feeTokenAddress = feeManager.i_linkAddress();
        (Common.Asset memory fee,,) = feeManager.getFeeAndReward(address(this), reportData, feeTokenAddress);

        // Approve rewardManager to spend this contract's balance in fees
        IERC20(feeTokenAddress).approve(address(rewardManager), fee.amount);

        // Verify the report
        bytes memory verifiedReportData = s_verifier.verify(fullReport, abi.encode(feeTokenAddress));

        ReportV3 memory verifiedReportV3 = abi.decode(verifiedReportData, (ReportV3));

        return verifiedReportV3.price;
    }

    function withdrawToken(address beneficiary, address token) public onlyOwner {
        uint256 amount = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(beneficiary, amount);
    }
}
```

## Get latest ETH/USD report using Data Streams SDK

In the root of the Foundry project create the new `get_latest_eth_usd_report.rs` file with the following content:

```rust
use data_streams_sdk::client::Client;
use data_streams_sdk::config::Config;
use data_streams_sdk::feed::ID;
use dotenv::dotenv;
use std::env;
use std::error::Error;

#[tokio::main]
async fn get_latest_eth_usd_report() -> Result<(), Box<dyn Error>> {
    dotenv().ok();

    let api_key = env::var("API_KEY").expect("API_KEY must be set in .env");
    let user_secret = env::var("USER_SECRET").expect("USER_SECRET must be set in .env");
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
    match client.get_latest_report(eth_usd_feed_id).await {
        Ok(response) => {
            let full_report_payload = &response.report.full_report;
            println!("{:?}", &full_report_payload);
        }
        Err(e) => {
            eprintln!("Error fetching latest report: {}", e);
        }
    }

    Ok(())
}

fn main() {
    let _ = get_latest_eth_usd_report();
}
```

Then create the `Cargo.toml` file with the following content. Make sure to replace the path to the `data-streams-sdk` library with the correct path on your local machine (where you git cloned the repository). After publishing the library to crates.io, you can replace the path with the published version.

```toml
[package]
name = "get_latest_eth_usd_report"
version = "0.0.1"
edition = "2021"

[dependencies]
data-streams-sdk = { git = "https://github.com/smartcontractkit/data-streams-sdk.git", branch = "feat/rust" }
dotenv = "0.15"
tokio = { version = "1", features = ["full"] }

[[bin]]
name = "get_latest_eth_usd_report"
path = "get_latest_eth_usd_report.rs"
```

Finally, make sure running the script does not return any errors:

```bash
cargo run
```

## Create a Foundry test

In the `test` directory of the Foundry project, create a new file called `Example.t.sol` with the following content:

```ts
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Test, console} from "forge-std/Test.sol";
import {Example, IERC20} from "../src/Example.sol";

contract ExampleTest is Test {
    address constant LINK_FAUCET = 0x4281eCF07378Ee595C564a59048801330f3084eE;

    Example public example;

    function setUp() public {
        string memory ARBITRUM_SEPOLIA_RPC_URL = vm.envString("ARBITRUM_SEPOLIA_RPC_URL");
        vm.createSelectFork(ARBITRUM_SEPOLIA_RPC_URL);

        address verifierProxyArbitrumSepolia = 0x2ff010DEbC1297f19579B4246cad07bd24F2488A;
        example = new Example(verifierProxyArbitrumSepolia);
    }

    function requestLinkFromFaucet(address to) public returns (bool success) {
        address linkTokenArbitrumSepolia = 0xb1D4538B4571d411F07960EF2838Ce337FE1E80E;

        vm.startPrank(LINK_FAUCET);
        success = IERC20(linkTokenArbitrumSepolia).transfer(to, 20 ether);
        vm.stopPrank();
    }

    function getLatestReportFromDataStreamsDon() public returns (string memory) {
        string[] memory cmds = new string[](3);
        cmds[0] = "cargo";
        cmds[1] = "run";
        cmds[2] = "get_latest_eth_usd_report";
        bytes memory output = vm.ffi(cmds);

        // remove string quotes
        bytes memory result = new bytes(output.length - 2);
        for (uint256 i = 1; i < output.length - 1; i++) {
            result[i - 1] = output[i];
        }

        return string(result);
    }

    function test_happy_path() public {
        assertEq(block.chainid, 421614); // Arbitrum Sepolia Chain ID

        bool success = requestLinkFromFaucet(address(example));
        require(success, "Failed to request LINK from faucet");

        string memory result = getLatestReportFromDataStreamsDon();
        bytes memory payload = vm.parseBytes(result);

        // bytes memory payload =
        //     hex"0006f9b553e393ced311551efd30d1decedb63d76ad41737462e2cdbbdff157800000000000000000000000000000000000000000000000000000000445b5403000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000028000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000120000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba7820000000000000000000000000000000000000000000000000000000067152c9b0000000000000000000000000000000000000000000000000000000067152c9b000000000000000000000000000000000000000000000000000021b6e089a928000000000000000000000000000000000000000000000000001dda3ebee380b00000000000000000000000000000000000000000000000000000000067167e1b0000000000000000000000000000000000000000000000923d614f85b17bd1000000000000000000000000000000000000000000000000923b1595b2409609e00000000000000000000000000000000000000000000000923df8ac99bd03cf600000000000000000000000000000000000000000000000000000000000000002131f48fb7fccefd485436c9b5b20c1f33f4291b410cd6810ed111d3089a378e3a782ba0c47a16407054cbd681d339095bfa5c31b2bc9bd9205613a6cd0a6da0c00000000000000000000000000000000000000000000000000000000000000023310102f89c1596d7b8f0288cabd4732bafeb09cdef9b44c173a070716942ff53a937a3fefa1a5ff0de96fb3e66380f90fc2393ab0ec4248b89a764251a17cba";

        int192 price = example.verifyReportAndReturnEthUsdFeedPrice(payload);

        console.log("price", price);
        assertGt(price, 0);
    }
}
```

## Run the example test

Finally, run the test by executing the following command:

```bash
forge test --ffi -vvv
```
