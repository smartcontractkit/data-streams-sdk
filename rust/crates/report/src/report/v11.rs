use crate::feed_id::ID;
use crate::report::base::{ReportBase, ReportError};

use num_bigint::BigInt;

/// Represents a Report Data V11 Schema.
///
/// This schema provides Deutsch Boerse data - mid price, bid/ask prices and volumes, last traded price, as well as market status.
///
/// # Parameters
/// - `feed_id`: The feed ID the report has data for.
/// - `valid_from_timestamp`: Earliest timestamp for which price is applicable.
/// - `observations_timestamp`: Latest timestamp for which price is applicable.
/// - `native_fee`: Base cost to validate a transaction using the report, denominated in the chain's native token (e.g., WETH/ETH).
/// - `link_fee`: Base cost to validate a transaction using the report, denominated in LINK.
/// - `expires_at`: Latest timestamp where the report can be verified onchain.
/// - `mid`: The mid (benchmark) traded price (18 decimal precision).
/// - `last_seen_timestamp_ns`: The timestamp if the last trade, in nanoseconds.
/// - `bid`: The latest bid price (18 decimal precision).
/// - `bid_volume`: Total volume of current bid positions.
/// - `ask`: The latest ask price (18 decimal precision).
/// - `ask_volume`: Total volume of current ask positions.
/// - `last_traded_price`: The price at which the latest transaction was completed (18 decimal precision).
/// - `market_status`: The status of the market (1 - closed, 2 - open).
///
/// # Solidity Equivalent
/// ```solidity
/// struct ReportDataV11 {
///     bytes32 feedId;
///     uint32 validFromTimestamp;
///     uint32 observationsTimestamp;
///     uint192 nativeFee;
///     uint192 linkFee;
///     uint32 expiresAt;
///     int192 mid;
///     uint64 last_seen_timestamp_ns;
///     int192 bid;
///     uint64 bid_volume;
///     int192 ask;
///     uint64 ask_volume;
///     int192 last_traded_price;
///     uint32 market_status;
/// }
/// ```
#[derive(Debug)]
pub struct ReportDataV11 {
    pub feed_id: ID,
    pub valid_from_timestamp: u32,
    pub observations_timestamp: u32,
    pub native_fee: BigInt,
    pub link_fee: BigInt,
    pub expires_at: u32,
    pub mid: BigInt,
    pub last_seen_timestamp_ns: u64,
    pub bid: BigInt,
    pub bid_volume: u64,
    pub ask: BigInt,
    pub ask_volume: u64,
    pub last_traded_price: BigInt,
    pub market_status: u32,
}

impl ReportDataV11 {
    /// Decodes an ABI-encoded `ReportDataV11` from bytes.
    ///
    /// # Parameters
    ///
    /// - `data`: The encoded report data.
    ///
    /// # Returns
    ///
    /// The decoded `ReportDataV11`.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is too short or if the data is invalid.
    pub fn decode(data: &[u8]) -> Result<Self, ReportError> {
        if data.len() < 13 * ReportBase::WORD_SIZE {
            return Err(ReportError::DataTooShort("ReportDataV11"));
        }

        let feed_id = ID(data[..ReportBase::WORD_SIZE]
            .try_into()
            .map_err(|_| ReportError::InvalidLength("feed_id (bytes32)"))?);

        let valid_from_timestamp = ReportBase::read_uint32(data, ReportBase::WORD_SIZE)?;
        let observations_timestamp = ReportBase::read_uint32(data, 2 * ReportBase::WORD_SIZE)?;
        let native_fee = ReportBase::read_uint192(data, 3 * ReportBase::WORD_SIZE)?;
        let link_fee = ReportBase::read_uint192(data, 4 * ReportBase::WORD_SIZE)?;
        let expires_at = ReportBase::read_uint32(data, 5 * ReportBase::WORD_SIZE)?;
        let mid = ReportBase::read_int192(data, 6 * ReportBase::WORD_SIZE)?;
        let last_seen_timestamp_ns = ReportBase::read_uint64(data, 7 * ReportBase::WORD_SIZE)?;
        let bid = ReportBase::read_int192(data, 8 * ReportBase::WORD_SIZE)?;
        let bid_volume = ReportBase::read_uint64(data, 9 * ReportBase::WORD_SIZE)?;
        let ask = ReportBase::read_int192(data, 10 * ReportBase::WORD_SIZE)?;
        let ask_volume = ReportBase::read_uint64(data, 11 * ReportBase::WORD_SIZE)?;
        let last_traded_price = ReportBase::read_int192(data, 12 * ReportBase::WORD_SIZE)?;
        let market_status = ReportBase::read_uint32(data, 13 * ReportBase::WORD_SIZE)?;

        Ok(Self {
            feed_id,
            valid_from_timestamp,
            observations_timestamp,
            native_fee,
            link_fee,
            expires_at,
            mid,
            last_seen_timestamp_ns,
            bid,
            bid_volume,
            ask,
            ask_volume,
            last_traded_price,
            market_status,
        })
    }

    /// Encodes the `ReportDataV11` into an ABI-encoded byte array.
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
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.mid)?);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.last_seen_timestamp_ns)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.bid)?);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.bid_volume)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.ask)?);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.ask_volume)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.last_traded_price)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.market_status)?);

        Ok(buffer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::report::tests::{
        generate_mock_report_data_v11, MOCK_ASK, MOCK_ASK_VOLUME, MOCK_BID, MOCK_BID_VOLUME,
        MOCK_FEE, MOCK_LAST_SEEN_TIMESTAMP_NS, MOCK_LAST_TRADED_PRICE, MOCK_MARKET_STATUS,
        MOCK_MID, MOCK_TIMESTAMP,
    };

    const V11_FEED_ID_STR: &str =
        "0x000bfb6d135897e4aaf5657bffd3b0b48f8e2a5131214c9ec2d62eac5d532067";

    #[test]
    fn test_decode_report_data_v11() {
        let multiplier: BigInt = "1000000000000000000".parse::<BigInt>().unwrap(); // 1.0 with 18 decimals

        let report_data = generate_mock_report_data_v11();
        let encoded = report_data.abi_encode().unwrap();
        let decoded = ReportDataV11::decode(&encoded).unwrap();

        let expected_feed_id = ID::from_hex_str(V11_FEED_ID_STR).unwrap();
        let expected_timestamp: u32 = MOCK_TIMESTAMP;
        let expected_fee = BigInt::from(MOCK_FEE);

        let expected_mid = BigInt::from(MOCK_MID).checked_mul(&multiplier).unwrap();
        let expected_last_seen_timestamp_ns: u64 = MOCK_LAST_SEEN_TIMESTAMP_NS;
        let expected_bid = BigInt::from(MOCK_BID).checked_mul(&multiplier).unwrap();
        let expected_bid_volume: u64 = MOCK_BID_VOLUME;
        let expected_ask = BigInt::from(MOCK_ASK).checked_mul(&multiplier).unwrap();
        let expected_ask_volume: u64 = MOCK_ASK_VOLUME;
        let expected_last_traded_price = BigInt::from(MOCK_LAST_TRADED_PRICE)
            .checked_mul(&multiplier)
            .unwrap();
        let expected_market_status: u32 = MOCK_MARKET_STATUS;

        assert_eq!(decoded.feed_id, expected_feed_id);
        assert_eq!(decoded.valid_from_timestamp, expected_timestamp);
        assert_eq!(decoded.observations_timestamp, expected_timestamp);
        assert_eq!(decoded.native_fee, expected_fee);
        assert_eq!(decoded.link_fee, expected_fee);
        assert_eq!(decoded.expires_at, expected_timestamp + 100);
        assert_eq!(decoded.mid, expected_mid);
        assert_eq!(
            decoded.last_seen_timestamp_ns,
            expected_last_seen_timestamp_ns
        );
        assert_eq!(decoded.bid, expected_bid);
        assert_eq!(decoded.bid_volume, expected_bid_volume);
        assert_eq!(decoded.ask, expected_ask);
        assert_eq!(decoded.ask_volume, expected_ask_volume);
        assert_eq!(decoded.last_traded_price, expected_last_traded_price);
        assert_eq!(decoded.market_status, expected_market_status);
    }
}
