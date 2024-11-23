use crate::feed::ID;
use crate::report::base::{ReportBase, ReportError};

use num_bigint::BigInt;

/// Represents a Report Data V3 Schema (Crypto Streams).
///
/// # Parameters
/// - `feed_id`: The feed ID the report has data for.
/// - `valid_from_timestamp`: Earliest timestamp for which price is applicable.
/// - `observations_timestamp`: Latest timestamp for which price is applicable.
/// - `native_fee`: Base cost to validate a transaction using the report, denominated in the chain’s native token (e.g., WETH/ETH).
/// - `link_fee`: Base cost to validate a transaction using the report, denominated in LINK.
/// - `expires_at`: Latest timestamp where the report can be verified onchain.
/// - `benchmark_price`: DON consensus median price (8 or 18 decimals).
/// - `bid`: Simulated price impact of a buy order up to the X% depth of liquidity utilisation (8 or 18 decimals).
/// - `ask`: Simulated price impact of a sell order up to the X% depth of liquidity utilisation (8 or 18 decimals).
///
/// # Solidity Equivalent
/// ```solidity
///     struct ReportDataV3 {
///         bytes32 feedId;
///         uint32 validFromTimestamp;
///         uint32 observationsTimestamp;
///         uint192 nativeFee;
///         uint192 linkFee;
///         uint32 expiresAt;
///         int192 benchmarkPrice;
///         int192 bid;
///         int192 ask;
///     }
/// ```
#[derive(Debug)]
pub struct ReportDataV3 {
    pub feed_id: ID,
    pub valid_from_timestamp: u32,
    pub observations_timestamp: u32,
    pub native_fee: BigInt,
    pub link_fee: BigInt,
    pub expires_at: u32,
    pub benchmark_price: BigInt,
    pub bid: BigInt,
    pub ask: BigInt,
}

impl ReportDataV3 {
    /// Decodes an ABI-encoded `ReportDataV3` from bytes.
    ///
    /// # Parameters
    ///
    /// - `data`: The encoded report data.
    ///
    /// # Returns
    ///
    /// The decoded `ReportDataV3`.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is too short or if the data is invalid.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use data_streams_sdk::report::{decode_full_report, v3::ReportDataV3};
    /// use std::error::Error;
    ///
    /// fn main() -> Result<(), Box<dyn Error>> {
    ///     let payload = "0006bd87830d5f336e205cf5c63329a1dab8f5d56812eaeb7c69300e66ab8e22000000000000000000000000000000000000000000000000000000000cf7ed13000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000003000101000101000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012000030ab7d02fbba9c6304f98824524407b1f494741174320cfd17a2c22eec1de0000000000000000000000000000000000000000000000000000000066a8f5c60000000000000000000000000000000000000000000000000000000066a8f5c6000000000000000000000000000000000000000000000000000057810653dd9000000000000000000000000000000000000000000000000000541315da76d6100000000000000000000000000000000000000000000000000000000066aa474600000000000000000000000000000000000000000000000009a697ee4230350400000000000000000000000000000000000000000000000009a6506d1426d00000000000000000000000000000000000000000000000000009a77d03ae355fe0000000000000000000000000000000000000000000000000000000000000000672bac991f5233df89f581dc02a89dd8d48419e3558b247d3e65f4069fa45c36658a5a4820dc94fc47a88a21d83474c29ee38382c46b6f9a575b9ce8be4e689c03c76fac19fbec4a29dba704c72cc003a6be1f96af115e322321f0688e24720a5d9bd7136a1d96842ec89133058b888b2e6572b5d4114de2426195e038f1c9a5ce50016b6f5a5de07e08529b845e1c622dcbefa0cfa2ffd128e9932ecee8efd869bc56d09a50ceb360a8d366cfa8eefe3f64279c88bdbc887560efa9944238eb000000000000000000000000000000000000000000000000000000000000000060e2a800f169f26164533c7faff6c9073cd6db240d89444d3487113232f9c31422a0993bb47d56807d0dc26728e4c8424bb9db77511001904353f1022168723010c46627c890be6e701e766679600696866c888ec80e7dbd428f5162a24f2d8262f846bdb06d9e46d295dd8e896fb232be80534b0041660fe4450a7ede9bc3b230722381773a4ae81241568867a759f53c2bdd05d32b209e78845fc58203949e50a608942b270c456001e578227ad00861cf5f47b27b09137a0c4b7f8b4746cef";
    ///     let payload = hex::decode(payload)?;
    ///
    ///     let (_report_context, report_blob) = decode_full_report(&payload)?;
    ///
    ///     let report = ReportDataV3::decode(&report_blob)?;
    ///
    ///     println!("{:#?}", report);
    ///
    ///     Ok(())
    /// }
    /// ```
    pub fn decode(data: &[u8]) -> Result<Self, ReportError> {
        if data.len() < 9 * ReportBase::WORD_SIZE {
            return Err(ReportError::DataTooShort("ReportDataV3"));
        }

        let feed_id = ID(data[..ReportBase::WORD_SIZE]
            .try_into()
            .map_err(|_| ReportError::InvalidLength("feed_id (bytes32)"))?);

        let valid_from_timestamp = ReportBase::read_uint32(data, ReportBase::WORD_SIZE)?;
        let observations_timestamp = ReportBase::read_uint32(data, 2 * ReportBase::WORD_SIZE)?;
        let native_fee = ReportBase::read_uint192(data, 3 * ReportBase::WORD_SIZE)?;
        let link_fee = ReportBase::read_uint192(data, 4 * ReportBase::WORD_SIZE)?;
        let expires_at = ReportBase::read_uint32(data, 5 * ReportBase::WORD_SIZE)?;
        let benchmark_price = ReportBase::read_int192(data, 6 * ReportBase::WORD_SIZE)?;
        let bid = ReportBase::read_int192(data, 7 * ReportBase::WORD_SIZE)?;
        let ask = ReportBase::read_int192(data, 8 * ReportBase::WORD_SIZE)?;

        Ok(Self {
            feed_id,
            valid_from_timestamp,
            observations_timestamp,
            native_fee,
            link_fee,
            expires_at,
            benchmark_price,
            bid,
            ask,
        })
    }

    /// Encodes the `ReportDataV3` into an ABI-encoded byte array.
    ///
    /// # Returns
    ///
    /// The ABI-encoded report data.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is invalid.
    pub fn abi_encode(&self) -> Result<Vec<u8>, ReportError> {
        let mut buffer = Vec::with_capacity(9 * ReportBase::WORD_SIZE);

        buffer.extend_from_slice(&self.feed_id.0);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.valid_from_timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.observations_timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_uint192(&self.native_fee)?);
        buffer.extend_from_slice(&ReportBase::encode_uint192(&self.link_fee)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.expires_at)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.benchmark_price)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.bid)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.ask)?);

        Ok(buffer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::feed::tests::V3_FEED_ID_STR;
    use crate::report::tests::{
        generate_mock_report_data_v3, MOCK_FEE, MOCK_PRICE, MOCK_TIMESTAMP,
    };

    #[test]
    fn test_decode_report_data_v3() {
        let report_data = generate_mock_report_data_v3();
        let encoded = report_data.abi_encode().unwrap();
        let decoded = ReportDataV3::decode(&encoded).unwrap();

        let expected_feed_id = ID::from_hex_str(V3_FEED_ID_STR).unwrap();
        let expected_timestamp: u32 = MOCK_TIMESTAMP;
        let expected_fee = BigInt::from(MOCK_FEE);
        let expected_price = BigInt::from(MOCK_PRICE);
        let delta = BigInt::from(10) * BigInt::from(MOCK_PRICE) / BigInt::from(100); // 10% of mock_price

        assert_eq!(decoded.feed_id, expected_feed_id);
        assert_eq!(decoded.valid_from_timestamp, expected_timestamp);
        assert_eq!(decoded.observations_timestamp, expected_timestamp);
        assert_eq!(decoded.native_fee, expected_fee);
        assert_eq!(decoded.link_fee, expected_fee);
        assert_eq!(decoded.expires_at, expected_timestamp + 100);
        assert_eq!(decoded.benchmark_price, expected_price);
        assert_eq!(decoded.bid, expected_price.clone() - delta.clone());
        assert_eq!(decoded.ask, expected_price + delta);
    }
}
