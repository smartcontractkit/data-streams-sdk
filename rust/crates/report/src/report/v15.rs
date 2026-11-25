use crate::feed_id::{Resolution, ID};
use crate::report::base::{ReportBase, ReportError};

use num_bigint::BigInt;

/// Represents a Report Data V15 Schema.
///
/// # Parameters
/// - `feed_id`: The feed ID the report has data for.
/// - `valid_from_timestamp`: Earliest timestamp for which the report is applicable.
/// - `observations_timestamp`: Latest timestamp for which the report is applicable.
///
/// The three timestamps are raw values in the resolution encoded in the feed ID (seconds or
/// milliseconds). The `*_seconds` methods return them in Unix seconds.
/// - `native_fee`: Base cost to validate a transaction using the report, denominated in the chain’s native token (e.g., WETH/ETH).
/// - `link_fee`: Base cost to validate a transaction using the report, denominated in LINK.
/// - `expires_at`: Latest timestamp where the report can be verified onchain.
/// - `adaptive_rate`: Signed value (18 decimals).
/// - `reference_rate`: Signed value (18 decimals).
/// - `market_rate`: Signed value (18 decimals).
///
/// # Solidity Equivalent
/// ```solidity
///     struct ReportDataV15 {
///         bytes32 feedId;
///         uint64 validFromTimestamp;
///         uint64 observationsTimestamp;
///         uint192 nativeFee;
///         uint192 linkFee;
///         uint64 expiresAt;
///         int192 adaptiveRate;
///         int192 referenceRate;
///         int192 marketRate;
///     }
/// ```
#[derive(Debug)]
pub struct ReportDataV15 {
    pub feed_id: ID,
    pub valid_from_timestamp: u64,
    pub observations_timestamp: u64,
    pub native_fee: BigInt,
    pub link_fee: BigInt,
    pub expires_at: u64,
    pub adaptive_rate: BigInt,
    pub reference_rate: BigInt,
    pub market_rate: BigInt,
}

impl ReportDataV15 {
    /// Decodes an ABI-encoded `ReportDataV15` from bytes.
    ///
    /// # Parameters
    ///
    /// - `data`: The encoded report data.
    ///
    /// # Returns
    ///
    /// The decoded `ReportDataV15`.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is too short or if the data is invalid.
    pub fn decode(data: &[u8]) -> Result<Self, ReportError> {
        if data.len() < 9 * ReportBase::WORD_SIZE {
            return Err(ReportError::DataTooShort("ReportDataV15"));
        }

        let feed_id = ID(data[..ReportBase::WORD_SIZE]
            .try_into()
            .map_err(|_| ReportError::InvalidLength("feed_id (bytes32)"))?);
        ReportBase::check_schema_version(&feed_id, 15)?;
        feed_id
            .resolution()
            .map_err(ReportError::UnknownResolution)?;

        let valid_from_timestamp = ReportBase::read_uint64(data, ReportBase::WORD_SIZE)?;
        let observations_timestamp = ReportBase::read_uint64(data, 2 * ReportBase::WORD_SIZE)?;
        let native_fee = ReportBase::read_uint192(data, 3 * ReportBase::WORD_SIZE)?;
        let link_fee = ReportBase::read_uint192(data, 4 * ReportBase::WORD_SIZE)?;
        let expires_at = ReportBase::read_uint64(data, 5 * ReportBase::WORD_SIZE)?;
        let adaptive_rate = ReportBase::read_int192(data, 6 * ReportBase::WORD_SIZE)?;
        let reference_rate = ReportBase::read_int192(data, 7 * ReportBase::WORD_SIZE)?;
        let market_rate = ReportBase::read_int192(data, 8 * ReportBase::WORD_SIZE)?;

        Ok(Self {
            feed_id,
            valid_from_timestamp,
            observations_timestamp,
            native_fee,
            link_fee,
            expires_at,
            adaptive_rate,
            reference_rate,
            market_rate,
        })
    }

    fn to_seconds(&self, timestamp: u64) -> u64 {
        match self.feed_id.resolution() {
            Ok(Resolution::Milliseconds) => timestamp / 1000,
            _ => timestamp,
        }
    }

    /// `valid_from_timestamp` in Unix seconds.
    pub fn valid_from_timestamp_seconds(&self) -> u64 {
        self.to_seconds(self.valid_from_timestamp)
    }

    /// `observations_timestamp` in Unix seconds.
    pub fn observations_timestamp_seconds(&self) -> u64 {
        self.to_seconds(self.observations_timestamp)
    }

    /// `expires_at` in Unix seconds.
    pub fn expires_at_seconds(&self) -> u64 {
        self.to_seconds(self.expires_at)
    }

    /// Encodes the `ReportDataV15` into an ABI-encoded byte array.
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
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.valid_from_timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.observations_timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_uint192(&self.native_fee)?);
        buffer.extend_from_slice(&ReportBase::encode_uint192(&self.link_fee)?);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.expires_at)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.adaptive_rate)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.reference_rate)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.market_rate)?);

        Ok(buffer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::report::tests::{
        generate_mock_report_data_v15, MOCK_ADAPTIVE_RATE, MOCK_FEE, MOCK_MARKET_RATE,
        MOCK_REFERENCE_RATE, MOCK_TIMESTAMP,
    };

    const V15_FEED_ID_STR: &str =
        "0x000f6b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";

    #[test]
    fn test_decode_report_data_v15() {
        let report_data = generate_mock_report_data_v15();
        let encoded = report_data.abi_encode().unwrap();
        let decoded = ReportDataV15::decode(&encoded).unwrap();

        let expected_feed_id = ID::from_hex_str(V15_FEED_ID_STR).unwrap();
        let expected_timestamp = u64::from(MOCK_TIMESTAMP);
        let multiplier: BigInt = "1000000000000000000".parse::<BigInt>().unwrap();

        assert_eq!(decoded.feed_id, expected_feed_id);
        assert_eq!(decoded.valid_from_timestamp, expected_timestamp);
        assert_eq!(decoded.observations_timestamp, expected_timestamp);
        assert_eq!(decoded.native_fee, BigInt::from(MOCK_FEE));
        assert_eq!(decoded.link_fee, BigInt::from(MOCK_FEE));
        assert_eq!(decoded.expires_at, expected_timestamp + 100);
        assert_eq!(
            decoded.adaptive_rate,
            BigInt::from(MOCK_ADAPTIVE_RATE) * &multiplier
        );
        assert_eq!(
            decoded.reference_rate,
            BigInt::from(MOCK_REFERENCE_RATE) * &multiplier
        );
        assert_eq!(
            decoded.market_rate,
            BigInt::from(MOCK_MARKET_RATE) * &multiplier
        );
    }

    #[test]
    fn test_decode_report_data_v15_rejects_short_data() {
        let encoded = generate_mock_report_data_v15().abi_encode().unwrap();
        assert!(ReportDataV15::decode(&encoded[..8 * ReportBase::WORD_SIZE]).is_err());
    }

    /// The three signed values round-trip as two's complement.
    #[test]
    fn test_decode_report_data_v15_negative_rates() {
        let mut report_data = generate_mock_report_data_v15();
        report_data.adaptive_rate = BigInt::from(-1);
        report_data.reference_rate = BigInt::from(-2);
        report_data.market_rate = BigInt::from(-3);

        let encoded = report_data.abi_encode().unwrap();
        // Each negative word is sign extended with 0xff, as in an ABI-encoded report.
        let word = |i: usize| &encoded[i * ReportBase::WORD_SIZE..(i + 1) * ReportBase::WORD_SIZE];
        assert!(word(6).iter().all(|b| *b == 0xff));
        assert_eq!(word(7)[..31], [0xffu8; 31]);

        let decoded = ReportDataV15::decode(&encoded).unwrap();
        assert_eq!(decoded.adaptive_rate, BigInt::from(-1));
        assert_eq!(decoded.reference_rate, BigInt::from(-2));
        assert_eq!(decoded.market_rate, BigInt::from(-3));
    }

    #[test]
    fn test_decode_report_data_v15_rejects_other_schema_version() {
        // A v3 feed ID shares the word layout of this schema.
        let mut report_data = generate_mock_report_data_v15();
        report_data.feed_id.0[1] = 0x03;
        let encoded = report_data.abi_encode().unwrap();
        assert!(matches!(
            ReportDataV15::decode(&encoded),
            Err(ReportError::WrongSchemaVersion {
                expected: 15,
                got: 3
            })
        ));
    }

    #[test]
    fn test_decode_report_data_v15_rejects_unknown_resolution() {
        let mut report_data = generate_mock_report_data_v15();
        report_data.feed_id.0[0] = 0x20;
        let encoded = report_data.abi_encode().unwrap();
        assert!(matches!(
            ReportDataV15::decode(&encoded),
            Err(ReportError::UnknownResolution(2))
        ));
    }

    #[test]
    fn test_decode_report_data_v15_timestamps_by_resolution() {
        let seconds = generate_mock_report_data_v15();
        assert_eq!(seconds.observations_timestamp_seconds(), 1718885772);

        let mut millis = generate_mock_report_data_v15();
        millis.feed_id.0[0] = 0x10;
        millis.valid_from_timestamp = 1718885772_123;
        millis.observations_timestamp = 1718885773_456;
        millis.expires_at = 1718885872_999;

        // Millisecond values do not fit in 32 bits and must survive the round trip.
        let decoded = ReportDataV15::decode(&millis.abi_encode().unwrap()).unwrap();
        assert_eq!(decoded.observations_timestamp, 1718885773_456);
        assert_eq!(decoded.valid_from_timestamp_seconds(), 1718885772);
        assert_eq!(decoded.observations_timestamp_seconds(), 1718885773);
        assert_eq!(decoded.expires_at_seconds(), 1718885872);
    }
}
