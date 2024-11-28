use crate::feed_id::ID;
use crate::report::base::{ReportBase, ReportError};

use num_bigint::BigInt;

/// Represents a Report Data V1 Schema.
///
/// # Parameters
/// - `feed_id`: The feed ID the report has data for.
/// - `observations_timestamp`: Latest timestamp for which price is applicable.
/// - `benchmark_price`: DON consensus median price (8 or 18 decimals).
/// - `bid`: Simulated price impact of a buy order up to the X% depth of liquidity utilisation (8 or 18 decimals).
/// - `ask`: Simulated price impact of a sell order up to the X% depth of liquidity utilisation (8 or 18 decimals).
/// - `current_block_num`: Block number at which the report was generated.
/// - `current_block_hash`: Block hash at which the report was generated.
/// - `valid_from_block_num`: Earliest block number for which price is applicable.
/// - `current_block_timestamp`: Timestamp at which the report was generated.
///
/// # Solidity Equivalent
/// ```solidity
/// struct ReportDataV1 {
///     bytes32 feedId;
///     uint32 observationsTimestamp;
///     int192 benchmarkPrice;
///     int192 bid;
///     int192 ask;
///     uint64 currentBlockNum;
///     bytes32 currentBlockHash;
///     uint64 validFromBlockNum;
///     uint64 currentBlockTimestamp;
/// }
/// ```
#[derive(Debug)]
pub struct ReportDataV1 {
    pub feed_id: ID,
    pub observations_timestamp: u32,
    pub benchmark_price: BigInt,
    pub bid: BigInt,
    pub ask: BigInt,
    pub current_block_num: u64,
    pub current_block_hash: [u8; 32],
    pub valid_from_block_num: u64,
    pub current_block_timestamp: u64,
}

impl ReportDataV1 {
    /// Decodes an ABI-encoded `ReportDataV1` from bytes.
    ///
    /// # Parameters
    ///
    /// - `data`: The encoded report data.
    ///
    /// # Returns
    ///
    /// The decoded `ReportDataV1`.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is too short or if the data is invalid.
    pub fn decode(data: &[u8]) -> Result<Self, ReportError> {
        if data.len() < 9 * ReportBase::WORD_SIZE {
            return Err(ReportError::DataTooShort("ReportDataV1"));
        }

        let feed_id = ID(data[..ReportBase::WORD_SIZE]
            .try_into()
            .map_err(|_| ReportError::InvalidLength("feed_id (bytes32)"))?);

        let observations_timestamp = ReportBase::read_uint32(data, ReportBase::WORD_SIZE)?;
        let benchmark_price = ReportBase::read_int192(data, 2 * ReportBase::WORD_SIZE)?;
        let bid = ReportBase::read_int192(data, 3 * ReportBase::WORD_SIZE)?;
        let ask = ReportBase::read_int192(data, 4 * ReportBase::WORD_SIZE)?;
        let current_block_num = ReportBase::read_uint64(data, 5 * ReportBase::WORD_SIZE)?;
        let current_block_hash = data[6 * ReportBase::WORD_SIZE..7 * ReportBase::WORD_SIZE]
            .try_into()
            .map_err(|_| ReportError::InvalidLength("current_block_hash (bytes32)"))?;
        let valid_from_block_num = ReportBase::read_uint64(data, 7 * ReportBase::WORD_SIZE)?;
        let current_block_timestamp = ReportBase::read_uint64(data, 8 * ReportBase::WORD_SIZE)?;

        Ok(Self {
            feed_id,
            observations_timestamp,
            benchmark_price,
            bid,
            ask,
            current_block_num,
            current_block_hash,
            valid_from_block_num,
            current_block_timestamp,
        })
    }

    /// Encodes a `ReportDataV1` into bytes.
    ///
    /// # Returns
    ///
    /// The encoded report data.
    ///
    /// # Errors
    ///
    /// Returns a `ReportError` if the data is too short or if the data is invalid.
    pub fn abi_encode(&self) -> Result<Vec<u8>, ReportError> {
        let mut buffer = Vec::with_capacity(9 * ReportBase::WORD_SIZE);

        buffer.extend_from_slice(&self.feed_id.0);
        buffer.extend_from_slice(&ReportBase::encode_uint32(self.observations_timestamp)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.benchmark_price)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.bid)?);
        buffer.extend_from_slice(&ReportBase::encode_int192(&self.ask)?);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.current_block_num)?);
        buffer.extend_from_slice(&self.current_block_hash);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.valid_from_block_num)?);
        buffer.extend_from_slice(&ReportBase::encode_uint64(self.current_block_timestamp)?);

        Ok(buffer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::report::tests::{generate_mock_report_data_v1, MOCK_PRICE, MOCK_TIMESTAMP};

    const V1_FEED_ID_STR: &str =
        "0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";

    #[test]
    fn decode_report_data_v1() {
        let report_data: ReportDataV1 = generate_mock_report_data_v1();
        let encoded = report_data.abi_encode().unwrap();
        let decoded = ReportDataV1::decode(&encoded).unwrap();

        let expected_feed_id = ID::from_hex_str(V1_FEED_ID_STR).unwrap();
        let expected_timestamp = MOCK_TIMESTAMP;
        let expected_current_block_num = 100;
        let expected_current_block_hash = [
            0, 0, 7, 4, 7, 2, 4, 1, 82, 38, 2, 9, 6, 5, 6, 8, 2, 8, 5, 5, 163, 53, 239, 127, 174,
            105, 107, 102, 63, 27, 132, 1,
        ];
        let expected_valid_from_block_num = 768986;

        assert_eq!(decoded.feed_id, expected_feed_id);
        assert_eq!(decoded.observations_timestamp, expected_timestamp);
        assert_eq!(decoded.benchmark_price, BigInt::from(MOCK_PRICE));
        assert_eq!(decoded.bid, BigInt::from(MOCK_PRICE));
        assert_eq!(decoded.ask, BigInt::from(MOCK_PRICE));
        assert_eq!(decoded.current_block_num, expected_current_block_num);
        assert_eq!(decoded.current_block_hash, expected_current_block_hash);
        assert_eq!(decoded.valid_from_block_num, expected_valid_from_block_num);
        assert_eq!(decoded.current_block_timestamp, expected_timestamp as u64);
    }
}
