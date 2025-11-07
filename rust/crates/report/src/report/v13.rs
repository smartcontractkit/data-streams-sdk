use crate::feed_id::ID;
use crate::report::base::{ReportBase, ReportError};

use num_bigint::BigInt;

/// Represents a Report Data V13 Schema.
///
/// This schema provides the best bid/ask prices, bid/ask volume and last traded price.
///
/// # Parameters
/// - `feed_id`: The feed ID the report has data for.
/// - `valid_from_timestamp`: Earliest timestamp for which price is applicable.
/// - `observations_timestamp`: Latest timestamp for which price is applicable.
/// - `native_fee`: Base cost to validate a transaction using the report, denominated in the chain's native token (e.g., WETH/ETH).
/// - `link_fee`: Base cost to validate a transaction using the report, denominated in LINK.
/// - `expires_at`: Latest timestamp where the report can be verified onchain.
/// - `best_ask`: The best (lowest) ask price (18 decimal precision).
/// - `best_bid`: The best (highest) bid price (18 decimal precision).
/// - `ask_volume`: Total volume of current ask positions.
/// - `bid_volume`: Total volume of current bid positions.
/// - `last_traded_price`: The price at which the latest transaction was completed (18 decimal precision).
///
/// # Solidity Equivalent
/// ```solidity
/// struct ReportDataV13 {
///     bytes32 feedId;
///     uint32 validFromTimestamp;
///     uint32 observationsTimestamp;
///     uint192 nativeFee;
///     uint192 linkFee;
///     uint32 expiresAt;
///     int192 best_ask;
///     int192 best_bid;
///     uint64 ask_volume;
///     uint64 bid_volume;
///     int192 last_traded_price;
/// }
/// ```
#[derive(Debug)]
pub struct ReportDataV13 {
    pub feed_id: ID,
    pub valid_from_timestamp: u32,
    pub observations_timestamp: u32,
    pub native_fee: BigInt,
    pub link_fee: BigInt,
    pub expires_at: u32,
    pub last_update_timestamp: u64,
    pub best_ask: BigInt,
    pub best_bid: BigInt,
    pub ask_volume: u64,
    pub bid_volume: u64,
    pub last_traded_price: BigInt,
}

impl ReportDataV13 {
    /// Decodes an ABI-encoded `ReportDataV13` from bytes.
    ///
    /// # Parameters
    ///
    /// - `data`: The encoded report data.
    ///
    /// # Returns
    ///
    /// The decoded `ReportDataV13`.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is too short or if the data is invalid.
    pub fn decode(data: &[u8]) -> Result<Self, ReportError> {
        if data.len() < 12 * ReportBase::WORD_SIZE {
            return Err(ReportError::DataTooShort("ReportDataV13"));
        }

        let feed_id = ID(data[..ReportBase::WORD_SIZE]
            .try_into()
            .map_err(|_| ReportError::InvalidLength("feed_id (bytes32)"))?);

        let valid_from_timestamp = ReportBase::read_uint32(data, ReportBase::WORD_SIZE)?;
        let observations_timestamp = ReportBase::read_uint32(data, 2 * ReportBase::WORD_SIZE)?;
        let native_fee = ReportBase::read_uint192(data, 3 * ReportBase::WORD_SIZE)?;
        let link_fee = ReportBase::read_uint192(data, 4 * ReportBase::WORD_SIZE)?;
        let expires_at = ReportBase::read_uint32(data, 5 * ReportBase::WORD_SIZE)?;
        let best_ask = ReportBase::read_int192(data, 7 * ReportBase::WORD_SIZE)?;
        let best_bid = ReportBase::read_int192(data, 8 * ReportBase::WORD_SIZE)?;
        let ask_volume = ReportBase::read_uint64(data, 9 * ReportBase::WORD_SIZE)?;
        let bid_volume = ReportBase::read_uint64(data, 10 * ReportBase::WORD_SIZE)?;
        let last_traded_price = ReportBase::read_int192(data, 11 * ReportBase::WORD_SIZE)?;

        Ok(Self {
            feed_id,
            valid_from_timestamp,
            observations_timestamp,
            native_fee,
            link_fee,
            expires_at,
            best_ask,
            best_bid,
            ask_volume,
            bid_volume,
            last_traded_price,
        })
    }

    /// Encodes the `ReportDataV13` into an ABI-encoded byte array.
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
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.best_ask)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.best_bid)?);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.ask_volume)?);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.bid_volume)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.last_traded_price)?);

        Ok(buffer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::report::tests::{
        generate_mock_report_data_v13, MOCK_FEE, MOCK_TIMESTAMP, MOCK_BEST_ASK, MOCK_BEST_BID, MOCK_ASK_VOLUME,
        MOCK_BID_VOLUME, MOCK_LAST_TRADED_PRICE
    };

    const V13_FEED_ID_STR: &str =
        "0x000d13a9b9c5e37a099f374e92c37914af5c268f3a8a9721f1725135bfb4cbb8";

    #[test]
    fn test_decode_report_data_v13() {
        let report_data = generate_mock_report_data_v13();
        let encoded = report_data.abi_encode().unwrap();
        let decoded = ReportDataV13::decode(&encoded).unwrap();

        const MOCK_MULTIPLIER: isize = 1000000000000000000;

        let expected_feed_id = ID::from_hex_str(V13_FEED_ID_STR).unwrap();
        let expected_timestamp: u32 = MOCK_TIMESTAMP;
        let expected_fee = BigInt::from(MOCK_FEE);
        let expected_best_ask = BigInt::from(MOCK_BEST_ASK);
        let expected_best_bid = BigInt::from(MOCK_BEST_BID);
        let expected_ask_volume: u64 = MOCK_ASK_VOLUME;
        let expected_bid_volume: u64 = MOCK_BID_VOLUME;
        let expected_last_traded_price = BigInt::from(MOCK_LAST_TRADED_PRICE);

        assert_eq!(decoded.feed_id, expected_feed_id);
        assert_eq!(decoded.valid_from_timestamp, expected_timestamp);
        assert_eq!(decoded.observations_timestamp, expected_timestamp);
        assert_eq!(decoded.native_fee, expected_fee);
        assert_eq!(decoded.link_fee, expected_fee);
        assert_eq!(decoded.expires_at, expected_timestamp + 100);
        assert_eq!(decoded.best_ask, expected_best_ask);
        assert_eq!(decoded.best_bid, expected_best_bid);
        assert_eq!(decoded.ask_volume, expected_ask_volume);
        assert_eq!(decoded.bid_volume, expected_bid_volume);
        assert_eq!(decoded.last_traded_price, expected_last_traded_price);
    }
}
