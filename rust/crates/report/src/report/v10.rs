use crate::feed_id::ID;
use crate::report::base::{ReportBase, ReportError};

use num_bigint::BigInt;

/// Represents a Report Data V10 Schema.
///
/// This schema extends the V8 schema with additional fields for multipliers and tokenized pricing.
///
/// # Parameters
/// - `feed_id`: The feed ID the report has data for.
/// - `valid_from_timestamp`: Earliest timestamp for which price is applicable.
/// - `observations_timestamp`: Latest timestamp for which price is applicable.
/// - `native_fee`: Base cost to validate a transaction using the report, denominated in the chain's native token (e.g., WETH/ETH).
/// - `link_fee`: Base cost to validate a transaction using the report, denominated in LINK.
/// - `expires_at`: Latest timestamp where the report can be verified onchain.
/// - `last_update_timestamp`: Timestamp of the last valid price update.
/// - `price`: DON's consensus price (18 decimal precision).
/// - `market_status`: Market status - 0 (Unknown), 1 (Closed), 2 (Open).
/// - `current_multiplier`: Currently applied multiplier accounting for past corporate actions.
/// - `new_multiplier`: Multiplier to be applied at the `activation_date_time` (set to 0 if none is scheduled).
/// - `activation_date_time`: When the next corporate action takes effect (set to 0 if none is scheduled).
/// - `tokenized_price`: 24/7 tokenized equity price.
///
/// # Solidity Equivalent
/// ```solidity
/// struct ReportDataV10 {
///     bytes32 feedId;
///     uint32 validFromTimestamp;
///     uint32 observationsTimestamp;
///     uint192 nativeFee;
///     uint192 linkFee;
///     uint32 expiresAt;
///     uint64 lastUpdateTimestamp;
///     int192 price;
///     uint32 marketStatus;
///     int192 currentMultiplier;
///     int192 newMultiplier;
///     uint32 activationDateTime;
///     int192 tokenizedPrice;
/// }
/// ```
#[derive(Debug)]
pub struct ReportDataV10 {
    pub feed_id: ID,
    pub valid_from_timestamp: u32,
    pub observations_timestamp: u32,
    pub native_fee: BigInt,
    pub link_fee: BigInt,
    pub expires_at: u32,
    pub last_update_timestamp: u64,
    pub price: BigInt,
    pub market_status: u32,
    pub current_multiplier: BigInt,
    pub new_multiplier: BigInt,
    pub activation_date_time: u32,
    pub tokenized_price: BigInt,
}

impl ReportDataV10 {
    /// Decodes an ABI-encoded `ReportDataV10` from bytes.
    ///
    /// # Parameters
    ///
    /// - `data`: The encoded report data.
    ///
    /// # Returns
    ///
    /// The decoded `ReportDataV10`.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is too short or if the data is invalid.
    pub fn decode(data: &[u8]) -> Result<Self, ReportError> {
        if data.len() < 13 * ReportBase::WORD_SIZE {
            return Err(ReportError::DataTooShort("ReportDataV10"));
        }

        let feed_id = ID(data[..ReportBase::WORD_SIZE]
            .try_into()
            .map_err(|_| ReportError::InvalidLength("feed_id (bytes32)"))?);

        let valid_from_timestamp = ReportBase::read_uint32(data, ReportBase::WORD_SIZE)?;
        let observations_timestamp = ReportBase::read_uint32(data, 2 * ReportBase::WORD_SIZE)?;
        let native_fee = ReportBase::read_uint192(data, 3 * ReportBase::WORD_SIZE)?;
        let link_fee = ReportBase::read_uint192(data, 4 * ReportBase::WORD_SIZE)?;
        let expires_at = ReportBase::read_uint32(data, 5 * ReportBase::WORD_SIZE)?;
        let last_update_timestamp = ReportBase::read_uint64(data, 6 * ReportBase::WORD_SIZE)?;
        let price = ReportBase::read_int192(data, 7 * ReportBase::WORD_SIZE)?;
        let market_status = ReportBase::read_uint32(data, 8 * ReportBase::WORD_SIZE)?;
        let current_multiplier = ReportBase::read_int192(data, 9 * ReportBase::WORD_SIZE)?;
        let new_multiplier = ReportBase::read_int192(data, 10 * ReportBase::WORD_SIZE)?;
        let activation_date_time = ReportBase::read_uint32(data, 11 * ReportBase::WORD_SIZE)?;
        let tokenized_price = ReportBase::read_int192(data, 12 * ReportBase::WORD_SIZE)?;

        Ok(Self {
            feed_id,
            valid_from_timestamp,
            observations_timestamp,
            native_fee,
            link_fee,
            expires_at,
            last_update_timestamp,
            price,
            market_status,
            current_multiplier,
            new_multiplier,
            activation_date_time,
            tokenized_price,
        })
    }

    /// Encodes the `ReportDataV10` into an ABI-encoded byte array.
    ///
    /// # Returns
    ///
    /// The ABI-encoded report data.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is invalid.
    pub fn abi_encode(&self) -> Result<Vec<u8>, ReportError> {
        let mut buffer = Vec::with_capacity(13 * ReportBase::WORD_SIZE);

        buffer.extend_from_slice(&self.feed_id.0);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.valid_from_timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.observations_timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_uint192(&self.native_fee)?);
        buffer.extend_from_slice(&ReportBase::encode_uint192(&self.link_fee)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.expires_at)?);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.last_update_timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.price)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.market_status)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.current_multiplier)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.new_multiplier)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.activation_date_time)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.tokenized_price)?);

        Ok(buffer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::report::tests::{
        generate_mock_report_data_v10, MOCK_FEE, MOCK_PRICE, MOCK_TIMESTAMP, MARKET_STATUS_OPEN
    };

    const V10_FEED_ID_STR: &str =
        "0x000a6b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";

    #[test]
    fn test_decode_report_data_v10() {
        let report_data = generate_mock_report_data_v10();
        let encoded = report_data.abi_encode().unwrap();
        let decoded = ReportDataV10::decode(&encoded).unwrap();

        const MOCK_MULTIPLIER: isize = 1000000000000000000;

        let expected_feed_id = ID::from_hex_str(V10_FEED_ID_STR).unwrap();
        let expected_timestamp: u32 = MOCK_TIMESTAMP;
        let expected_fee = BigInt::from(MOCK_FEE);
        let expected_price = BigInt::from(MOCK_PRICE);
        let expected_market_status: u32 = MARKET_STATUS_OPEN;
        let expected_multiplier = BigInt::from(MOCK_MULTIPLIER); // 1.0 with 18 decimals
        let expected_tokenized_price = BigInt::from(MOCK_PRICE * 2); // Example tokenized price

        assert_eq!(decoded.feed_id, expected_feed_id);
        assert_eq!(decoded.valid_from_timestamp, expected_timestamp);
        assert_eq!(decoded.observations_timestamp, expected_timestamp);
        assert_eq!(decoded.native_fee, expected_fee);
        assert_eq!(decoded.link_fee, expected_fee);
        assert_eq!(decoded.expires_at, expected_timestamp + 100);
        assert_eq!(decoded.last_update_timestamp, expected_timestamp as u64);
        assert_eq!(decoded.price, expected_price);
        assert_eq!(decoded.market_status, expected_market_status);
        assert_eq!(decoded.current_multiplier, expected_multiplier);
        assert_eq!(decoded.new_multiplier, expected_multiplier);
        assert_eq!(decoded.activation_date_time, expected_timestamp + 200);
        assert_eq!(decoded.tokenized_price, expected_tokenized_price);
    }
}
