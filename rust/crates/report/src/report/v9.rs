use crate::feed_id::ID;
use crate::report::base::{ReportBase, ReportError};

use num_bigint::BigInt;

/// Represents a Report Data V9 Schema (NAV Data Streams).
///
/// # Parameters
/// - `feed_id`: The feed ID the report has data for.
/// - `valid_from_timestamp`: Earliest timestamp for which price is applicable.
/// - `observations_timestamp`: Latest timestamp for which price is applicable.
/// - `native_fee`: Base cost to validate a transaction using the report, denominated in the chain's native token (e.g., WETH/ETH).
/// - `link_fee`: Base cost to validate a transaction using the report, denominated in LINK.
/// - `expires_at`: Latest timestamp where the report can be verified onchain.
/// - `nav_per_share`: DON's consensus NAV per share (18 decimal precision).
/// - `nav_date`: Timestamp for the date the NAV report was produced.
/// - `aum`: DON's consensus for the total Assets Under Management (18 decimal precision).
/// - `ripcord`: Emergency pause flag (0 = normal, 1 = paused - do not consume NAV data).
///
/// # Ripcord Flag
/// - `0` (false): Feed's data provider is OK. Fund's data provider and accuracy is as expected.
/// - `1` (true): Feed's data provider is flagging a pause. Data provider detected outliers, 
///   deviated thresholds, or operational issues. **DO NOT consume NAV data when ripcord=1.**
///
/// # Solidity Equivalent
/// ```solidity
/// struct ReportDataV9 {
///     bytes32 feedId;
///     uint32 validFromTimestamp;
///     uint32 observationsTimestamp;
///     uint192 nativeFee;
///     uint192 linkFee;
///     uint32 expiresAt;
///     int192 navPerShare;
///     uint64 navDate;
///     int192 aum;
///     uint32 ripcord;
/// }
/// ```
#[derive(Debug)]
pub struct ReportDataV9 {
    pub feed_id: ID,
    pub valid_from_timestamp: u32,
    pub observations_timestamp: u32,
    pub native_fee: BigInt,
    pub link_fee: BigInt,
    pub expires_at: u32,
    pub nav_per_share: BigInt,
    pub nav_date: u64,
    pub aum: BigInt,
    pub ripcord: u32,
}

impl ReportDataV9 {
    /// Decodes an ABI-encoded `ReportDataV9` from bytes.
    ///
    /// # Parameters
    ///
    /// - `data`: The encoded report data.
    ///
    /// # Returns
    ///
    /// The decoded `ReportDataV9`.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is too short or if the data is invalid.
    pub fn decode(data: &[u8]) -> Result<Self, ReportError> {
        if data.len() < 10 * ReportBase::WORD_SIZE {
            return Err(ReportError::DataTooShort("ReportDataV9"));
        }

        let feed_id = ID(data[..ReportBase::WORD_SIZE]
            .try_into()
            .map_err(|_| ReportError::InvalidLength("feed_id (bytes32)"))?);

        let valid_from_timestamp = ReportBase::read_uint32(data, ReportBase::WORD_SIZE)?;
        let observations_timestamp = ReportBase::read_uint32(data, 2 * ReportBase::WORD_SIZE)?;
        let native_fee = ReportBase::read_uint192(data, 3 * ReportBase::WORD_SIZE)?;
        let link_fee = ReportBase::read_uint192(data, 4 * ReportBase::WORD_SIZE)?;
        let expires_at = ReportBase::read_uint32(data, 5 * ReportBase::WORD_SIZE)?;
        let nav_per_share = ReportBase::read_int192(data, 6 * ReportBase::WORD_SIZE)?;
        let nav_date = ReportBase::read_uint64(data, 7 * ReportBase::WORD_SIZE)?;
        let aum = ReportBase::read_int192(data, 8 * ReportBase::WORD_SIZE)?;
        let ripcord = ReportBase::read_uint32(data, 9 * ReportBase::WORD_SIZE)?;

        Ok(Self {
            feed_id,
            valid_from_timestamp,
            observations_timestamp,
            native_fee,
            link_fee,
            expires_at,
            nav_per_share,
            nav_date,
            aum,
            ripcord,
        })
    }

    /// Encodes the `ReportDataV9` into an ABI-encoded byte array.
    ///
    /// # Returns
    ///
    /// The ABI-encoded report data.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is invalid.
    pub fn abi_encode(&self) -> Result<Vec<u8>, ReportError> {
        let mut buffer = Vec::with_capacity(10 * ReportBase::WORD_SIZE);

        buffer.extend_from_slice(&self.feed_id.0);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.valid_from_timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.observations_timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_uint192(&self.native_fee)?);
        buffer.extend_from_slice(&ReportBase::encode_uint192(&self.link_fee)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.expires_at)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.nav_per_share)?);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.nav_date)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.aum)?);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.ripcord)?);

        Ok(buffer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::report::tests::{
        generate_mock_report_data_v9, MOCK_FEE, MOCK_TIMESTAMP,
    };

    const V9_FEED_ID_STR: &str =
        "0x00096b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";

    const MOCK_NAV_PER_SHARE: isize = 1;
    const MOCK_AUM: isize = 1000;
    const RIPCORD_NORMAL: u32 = 0; 

    #[test]
    fn test_decode_report_data_v9() {
        let report_data = generate_mock_report_data_v9();
        let encoded = report_data.abi_encode().unwrap();
        let decoded = ReportDataV9::decode(&encoded).unwrap();

        let expected_feed_id = ID::from_hex_str(V9_FEED_ID_STR).unwrap();
        let expected_timestamp: u32 = MOCK_TIMESTAMP;
        let expected_fee = BigInt::from(MOCK_FEE);
        let expected_nav_per_share = BigInt::from(MOCK_NAV_PER_SHARE);
        let expected_aum = BigInt::from(MOCK_AUM);
        let expected_ripcord = RIPCORD_NORMAL;

        assert_eq!(decoded.feed_id, expected_feed_id);
        assert_eq!(decoded.valid_from_timestamp, expected_timestamp);
        assert_eq!(decoded.observations_timestamp, expected_timestamp);
        assert_eq!(decoded.native_fee, expected_fee);
        assert_eq!(decoded.link_fee, expected_fee);
        assert_eq!(decoded.expires_at, expected_timestamp + 100);
        assert_eq!(decoded.nav_per_share, expected_nav_per_share);
        assert_eq!(decoded.nav_date, expected_timestamp as u64);
        assert_eq!(decoded.aum, expected_aum);
        assert_eq!(decoded.ripcord, expected_ripcord);
    }
}
