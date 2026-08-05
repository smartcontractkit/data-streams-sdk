use crate::feed_id::ID;
use crate::report::base::{ReportBase, ReportError};

use num_bigint::BigInt;

/// Represents a Report Data V14 Schema (Continuous Commodities Futures).
///
/// This schema provides mid/bid/ask pricing alongside futures contract metadata such as
/// the expiry time, first day of notice and contract month.
///
/// # Parameters
/// - `feed_id`: The feed ID the report has data for.
/// - `valid_from_timestamp`: Earliest timestamp for which price is applicable.
/// - `observations_timestamp`: Latest timestamp for which price is applicable.
/// - `native_fee`: Base cost to validate a transaction using the report, denominated in the chain's native token (e.g., WETH/ETH).
/// - `link_fee`: Base cost to validate a transaction using the report, denominated in LINK.
/// - `expires_at`: Latest timestamp where the report can be verified onchain.
/// - `mid_price`: The mid price (18 decimal precision).
/// - `bid_price`: The bid price (18 decimal precision).
/// - `ask_price`: The ask price (18 decimal precision).
/// - `expiry_time`: Contract expiry time in nanoseconds.
/// - `first_day_of_notice`: First day of notice, converted to a UNIX timestamp in nanoseconds.
/// - `last_seen_timestamp_ns`: Timestamp of the last update seen from the data provider, in nanoseconds.
/// - `market_status`: The DON's consensus on whether the market is currently open. Possible values: `0` (`Unknown`), `1` (`Closed`), `2` (`Open`).
/// - `contract_month`: Contract month code: a single capital letter F to Z for Jan to Dec.
///
/// # Solidity Equivalent
/// ```solidity
/// struct ReportDataV14 {
///     bytes32 feedId;
///     uint32 validFromTimestamp;
///     uint32 observationsTimestamp;
///     uint192 nativeFee;
///     uint192 linkFee;
///     uint32 expiresAt;
///     int192 midPrice;
///     int192 bidPrice;
///     int192 askPrice;
///     uint64 expiryTime;
///     uint64 firstDayOfNotice;
///     uint64 lastSeenTimestampNs;
///     uint32 marketStatus;
///     string contractMonth;
/// }
/// ```
#[derive(Debug)]
pub struct ReportDataV14 {
    pub feed_id: ID,
    pub valid_from_timestamp: u32,
    pub observations_timestamp: u32,
    pub native_fee: BigInt,
    pub link_fee: BigInt,
    pub expires_at: u32,
    pub mid_price: BigInt,
    pub bid_price: BigInt,
    pub ask_price: BigInt,
    pub expiry_time: u64,
    pub first_day_of_notice: u64,
    pub last_seen_timestamp_ns: u64,
    pub market_status: u32,
    pub contract_month: String,
}

impl ReportDataV14 {
    /// Number of 32-byte head words: 13 static fields plus one offset word for the
    /// dynamic `contractMonth` string.
    const HEAD_WORDS: usize = 14;

    /// Decodes an ABI-encoded `ReportDataV14` from bytes.
    ///
    /// # Parameters
    ///
    /// - `data`: The encoded report data.
    ///
    /// # Returns
    ///
    /// The decoded `ReportDataV14`.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is too short or if the data is invalid.
    pub fn decode(data: &[u8]) -> Result<Self, ReportError> {
        if data.len() < Self::HEAD_WORDS * ReportBase::WORD_SIZE {
            return Err(ReportError::DataTooShort("ReportDataV14"));
        }

        let feed_id = ID(data[..ReportBase::WORD_SIZE]
            .try_into()
            .map_err(|_| ReportError::InvalidLength("feed_id (bytes32)"))?);

        let valid_from_timestamp = ReportBase::read_uint32(data, ReportBase::WORD_SIZE)?;
        let observations_timestamp = ReportBase::read_uint32(data, 2 * ReportBase::WORD_SIZE)?;
        let native_fee = ReportBase::read_uint192(data, 3 * ReportBase::WORD_SIZE)?;
        let link_fee = ReportBase::read_uint192(data, 4 * ReportBase::WORD_SIZE)?;
        let expires_at = ReportBase::read_uint32(data, 5 * ReportBase::WORD_SIZE)?;
        let mid_price = ReportBase::read_int192(data, 6 * ReportBase::WORD_SIZE)?;
        let bid_price = ReportBase::read_int192(data, 7 * ReportBase::WORD_SIZE)?;
        let ask_price = ReportBase::read_int192(data, 8 * ReportBase::WORD_SIZE)?;
        let expiry_time = ReportBase::read_uint64(data, 9 * ReportBase::WORD_SIZE)?;
        let first_day_of_notice = ReportBase::read_uint64(data, 10 * ReportBase::WORD_SIZE)?;
        let last_seen_timestamp_ns = ReportBase::read_uint64(data, 11 * ReportBase::WORD_SIZE)?;
        let market_status = ReportBase::read_uint32(data, 12 * ReportBase::WORD_SIZE)?;
        let contract_month = ReportBase::read_string(data, 13 * ReportBase::WORD_SIZE)?;

        // contract_month must be a single letter from F to Z (Jan to Dec).
        let month_bytes = contract_month.as_bytes();
        if month_bytes.len() != 1 || !(b'F'..=b'Z').contains(&month_bytes[0]) {
            return Err(ReportError::InvalidValue("contract_month"));
        }

        Ok(Self {
            feed_id,
            valid_from_timestamp,
            observations_timestamp,
            native_fee,
            link_fee,
            expires_at,
            mid_price,
            bid_price,
            ask_price,
            expiry_time,
            first_day_of_notice,
            last_seen_timestamp_ns,
            market_status,
            contract_month,
        })
    }

    /// Encodes the `ReportDataV14` into an ABI-encoded byte array.
    ///
    /// # Returns
    ///
    /// The ABI-encoded report data.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is invalid.
    pub fn abi_encode(&self) -> Result<Vec<u8>, ReportError> {
        let mut buffer = Vec::with_capacity((Self::HEAD_WORDS + 2) * ReportBase::WORD_SIZE);

        // Head: 13 static fields.
        buffer.extend_from_slice(&self.feed_id.0);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.valid_from_timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.observations_timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_uint192(&self.native_fee)?);
        buffer.extend_from_slice(&ReportBase::encode_uint192(&self.link_fee)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.expires_at)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.mid_price)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.bid_price)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.ask_price)?);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.expiry_time)?);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.first_day_of_notice)?);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.last_seen_timestamp_ns)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.market_status)?);

        // Head: offset word pointing to the dynamic `contractMonth` string tail.
        let offset = (Self::HEAD_WORDS * ReportBase::WORD_SIZE) as u64;
        buffer.extend_from_slice(&ReportBase::encode_uint64(offset)?);

        // Tail: the dynamic `contractMonth` string.
        buffer.extend_from_slice(&ReportBase::encode_string_tail(&self.contract_month));

        Ok(buffer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::report::tests::{
        generate_mock_report_data_v14, MARKET_STATUS_OPEN, MOCK_ASK, MOCK_BID,
        MOCK_CONTRACT_MONTH, MOCK_EXPIRY_TIME, MOCK_FEE, MOCK_FIRST_DAY_OF_NOTICE,
        MOCK_LAST_SEEN_TIMESTAMP_NS, MOCK_MID, MOCK_TIMESTAMP,
    };

    const V14_FEED_ID_STR: &str =
        "0x000e6b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";

    #[test]
    fn test_decode_report_data_v14() {
        let multiplier: BigInt = "1000000000000000000".parse::<BigInt>().unwrap(); // 1.0 with 18 decimals

        let report_data = generate_mock_report_data_v14();
        let encoded = report_data.abi_encode().unwrap();
        let decoded = ReportDataV14::decode(&encoded).unwrap();

        let expected_feed_id = ID::from_hex_str(V14_FEED_ID_STR).unwrap();
        let expected_timestamp: u32 = MOCK_TIMESTAMP;
        let expected_fee = BigInt::from(MOCK_FEE);
        let expected_mid = BigInt::from(MOCK_MID).checked_mul(&multiplier).unwrap();
        let expected_bid = BigInt::from(MOCK_BID).checked_mul(&multiplier).unwrap();
        let expected_ask = BigInt::from(MOCK_ASK).checked_mul(&multiplier).unwrap();

        assert_eq!(decoded.feed_id, expected_feed_id);
        assert_eq!(decoded.valid_from_timestamp, expected_timestamp);
        assert_eq!(decoded.observations_timestamp, expected_timestamp);
        assert_eq!(decoded.native_fee, expected_fee);
        assert_eq!(decoded.link_fee, expected_fee);
        assert_eq!(decoded.expires_at, expected_timestamp + 100);
        assert_eq!(decoded.mid_price, expected_mid);
        assert_eq!(decoded.bid_price, expected_bid);
        assert_eq!(decoded.ask_price, expected_ask);
        assert_eq!(decoded.expiry_time, MOCK_EXPIRY_TIME);
        assert_eq!(decoded.first_day_of_notice, MOCK_FIRST_DAY_OF_NOTICE);
        assert_eq!(decoded.last_seen_timestamp_ns, MOCK_LAST_SEEN_TIMESTAMP_NS);
        assert_eq!(decoded.market_status, MARKET_STATUS_OPEN);
        assert_eq!(decoded.contract_month, MOCK_CONTRACT_MONTH);
    }

    #[test]
    fn test_decode_report_data_v14_invalid_contract_month() {
        // Values outside the valid single-letter F..Z range must be rejected.
        for invalid in ["", "A", "E", "AB", "n", "1"] {
            let mut report_data = generate_mock_report_data_v14();
            report_data.contract_month = invalid.to_string();
            let encoded = report_data.abi_encode().unwrap();

            let result = ReportDataV14::decode(&encoded);
            assert!(
                matches!(result, Err(ReportError::InvalidValue("contract_month"))),
                "expected InvalidValue error for contract_month {:?}, got {:?}",
                invalid,
                result
            );
        }
    }
}
