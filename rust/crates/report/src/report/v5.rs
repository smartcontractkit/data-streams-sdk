use crate::feed_id::ID;
use crate::report::base::{ReportBase, ReportError};

use num_bigint::BigInt;

/// Represents a Report Data V5 Schema.
///
/// # Parameters
/// - `feed_id`: The feed ID the report has data for.
/// - `valid_from_timestamp`: Earliest timestamp for which price is applicable.
/// - `observations_timestamp`: Latest timestamp for which price is applicable.
/// - `native_fee`: Base cost to validate a transaction using the report, denominated in the chain's native token (e.g., WETH/ETH).
/// - `link_fee`: Base cost to validate a transaction using the report, denominated in LINK.
/// - `expires_at`: Latest timestamp where the report can be verified onchain.
/// - `rate`: The interest rate.
/// - `timestamp`: Timestamp when the rate was observed.
/// - `duration`: Duration for which the rate is applicable.
///
/// # Solidity Equivalent
/// ```solidity
/// struct ReportDataV5 {
///     bytes32 feedId;
///     uint32 validFromTimestamp;
///     uint32 observationsTimestamp;
///     uint192 nativeFee;
///     uint192 linkFee;
///     uint32 expiresAt;
///     int192 rate;
///     uint32 timestamp;
///     uint32 duration;
/// }
/// ```
#[derive(Debug)]
pub struct ReportDataV5 {
    pub feed_id: ID,
    pub valid_from_timestamp: u32,
    pub observations_timestamp: u32,
    pub native_fee: BigInt,
    pub link_fee: BigInt,
    pub expires_at: u32,
    pub rate: BigInt,
    pub timestamp: u32,
    pub duration: u32,
}

impl ReportDataV5 {
    /// Decodes an ABI-encoded `ReportDataV5` from bytes.
    ///
    /// # Parameters
    ///
    /// - `data`: The encoded report data.
    ///
    /// # Returns
    ///
    /// The decoded `ReportDataV5`.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is too short or if the data is invalid.
    pub fn decode(data: &[u8]) -> Result<Self, ReportError> {
        if data.len() < 9 * ReportBase::WORD_SIZE {
            return Err(ReportError::DataTooShort("ReportDataV5"));
        }

        let feed_id = ID(data[..ReportBase::WORD_SIZE]
            .try_into()
            .map_err(|_| ReportError::InvalidLength("feed_id (bytes32)"))?);

        let valid_from_timestamp = ReportBase::read_uint32(data, ReportBase::WORD_SIZE)?;
        let observations_timestamp = ReportBase::read_uint32(data, 2 * ReportBase::WORD_SIZE)?;
        let native_fee = ReportBase::read_uint192(data, 3 * ReportBase::WORD_SIZE)?;
        let link_fee = ReportBase::read_uint192(data, 4 * ReportBase::WORD_SIZE)?;
        let expires_at = ReportBase::read_uint32(data, 5 * ReportBase::WORD_SIZE)?;
        let rate = ReportBase::read_int192(data, 6 * ReportBase::WORD_SIZE)?;
        let timestamp = ReportBase::read_uint32(data, 7 * ReportBase::WORD_SIZE)?;
        let duration = ReportBase::read_uint32(data, 8 * ReportBase::WORD_SIZE)?;

        Ok(Self {
            feed_id,
            valid_from_timestamp,
            observations_timestamp,
            native_fee,
            link_fee,
            expires_at,
            rate,
            timestamp,
            duration,
        })
    }

    /// Encodes the `ReportDataV5` into an ABI-encoded byte array.
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
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.rate)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.duration)?);

        Ok(buffer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::report::tests::{
        generate_mock_report_data_v5, MOCK_FEE, MOCK_PRICE, MOCK_TIMESTAMP,
    };

    const V5_FEED_ID_STR: &str =
        "0x00056b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";

    #[test]
    fn test_decode_report_data_v5() {
        let report_data = generate_mock_report_data_v5();
        let encoded = report_data.abi_encode().unwrap();
        let decoded = ReportDataV5::decode(&encoded).unwrap();

        let one_hour_in_seconds: u32 = 3600;

        let expected_feed_id = ID::from_hex_str(V5_FEED_ID_STR).unwrap();
        let expected_timestamp: u32 = MOCK_TIMESTAMP;
        let expected_fee = BigInt::from(MOCK_FEE);
        let expected_rate = BigInt::from(MOCK_PRICE);
        let expected_duration = one_hour_in_seconds;

        assert_eq!(decoded.feed_id, expected_feed_id);
        assert_eq!(decoded.valid_from_timestamp, expected_timestamp);
        assert_eq!(decoded.observations_timestamp, expected_timestamp);
        assert_eq!(decoded.native_fee, expected_fee);
        assert_eq!(decoded.link_fee, expected_fee);
        assert_eq!(decoded.expires_at, expected_timestamp + 100);
        assert_eq!(decoded.rate, expected_rate);
        assert_eq!(decoded.timestamp, expected_timestamp);
        assert_eq!(decoded.duration, expected_duration);
    }
}
