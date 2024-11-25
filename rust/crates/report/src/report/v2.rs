use crate::feed_id::ID;
use crate::report::base::{ReportBase, ReportError};

use num_bigint::BigInt;

/// Represents a Report Data V2 Schema.
///
/// # Parameters
/// - `feed_id`: The feed ID the report has data for.
/// - `valid_from_timestamp`: Earliest timestamp for which price is applicable.
/// - `observations_timestamp`: Latest timestamp for which price is applicable.
/// - `native_fee`: Base cost to validate a transaction using the report, denominated in the chain’s native token (e.g., WETH/ETH).
/// - `link_fee`: Base cost to validate a transaction using the report, denominated in LINK.
/// - `expires_at`: Latest timestamp where the report can be verified on-chain.
/// - `benchmark_price`: DON consensus median price, carried to 8 decimal places
///
/// # Solidity Equivalent
/// ```solidity
/// struct ReportDataV2 {
///     bytes32 feedId;
///     uint32 validFromTimestamp;
///     uint32 observationsTimestamp;
///     uint192 nativeFee;
///     uint192 linkFee;
///     uint32 expiresAt;
///     int192 benchmarkPrice;
/// }
/// ```
#[derive(Debug)]
pub struct ReportDataV2 {
    pub feed_id: ID,
    pub valid_from_timestamp: u32,
    pub observations_timestamp: u32,
    pub native_fee: BigInt,
    pub link_fee: BigInt,
    pub expires_at: u32,
    pub benchmark_price: BigInt,
}

impl ReportDataV2 {
    /// Decodes an ABI-encoded `ReportDataV2` from bytes.
    ///
    /// # Parameters
    ///
    /// - `data`: The encoded report data.
    ///
    /// # Returns
    ///
    /// The decoded `ReportDataV2`.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is too short or if the data is invalid.
    pub fn decode(data: &[u8]) -> Result<Self, ReportError> {
        if data.len() < 7 * ReportBase::WORD_SIZE {
            return Err(ReportError::DataTooShort("ReportDataV2"));
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

        Ok(Self {
            feed_id,
            valid_from_timestamp,
            observations_timestamp,
            native_fee,
            link_fee,
            expires_at,
            benchmark_price,
        })
    }

    /// Encodes a `ReportDataV2` into bytes.
    ///
    /// # Returns
    ///
    /// The encoded report data.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is too short or if the data is invalid.
    pub fn abi_encode(&self) -> Result<Vec<u8>, ReportError> {
        let mut buffer = Vec::with_capacity(7 * ReportBase::WORD_SIZE);

        buffer.extend_from_slice(&self.feed_id.0);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.valid_from_timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.observations_timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_uint192(&self.native_fee)?);
        buffer.extend_from_slice(&ReportBase::encode_uint192(&self.link_fee)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.expires_at)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.benchmark_price)?);

        Ok(buffer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::report::tests::{
        generate_mock_report_data_v2, MOCK_FEE, MOCK_PRICE, MOCK_TIMESTAMP,
    };

    const V2_FEED_ID_STR: &str =
        "0x00026b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";

    #[test]
    fn test_decode_report_data_v2() {
        let report_data = generate_mock_report_data_v2();
        let encoded = report_data.abi_encode().unwrap();
        let decoded = ReportDataV2::decode(&encoded).unwrap();

        let expected_feed_id = ID::from_hex_str(V2_FEED_ID_STR).unwrap();
        let expected_timestamp: u32 = MOCK_TIMESTAMP;
        let expected_fee = BigInt::from(MOCK_FEE);
        let expected_price = BigInt::from(MOCK_PRICE);

        assert_eq!(decoded.feed_id, expected_feed_id);
        assert_eq!(decoded.valid_from_timestamp, expected_timestamp);
        assert_eq!(decoded.observations_timestamp, expected_timestamp);
        assert_eq!(decoded.native_fee, expected_fee);
        assert_eq!(decoded.link_fee, expected_fee);
        assert_eq!(decoded.expires_at, expected_timestamp + 100);
        assert_eq!(decoded.benchmark_price, expected_price);
    }
}
