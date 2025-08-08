pub mod base;
pub mod compress;
pub mod v1;
pub mod v2;
pub mod v3;
pub mod v4;
pub mod v5;
pub mod v8;
pub mod v9;
pub mod v10;

use base::{ReportBase, ReportError};

use crate::feed_id::ID;

use serde::{Deserialize, Serialize};

/// Represents a report that will be returned from the Data Streams DON.
///
/// The `Report` struct contains the following fields:
/// * `feed_id`: The unique identifier of the feed.
/// * `valid_from_timestamp`: Earliest timestamp for which price is applicable.
/// * `observations_timestamp`: Latest timestamp for which price is applicable.
/// * `full_report`: The report data (bytes) that needs to be decoded further - to version-specific report data.
///
/// # Examples
///
/// ```rust
/// use chainlink_data_streams_report::report::Report;
/// use chainlink_data_streams_report::feed_id::ID;
///
/// let id = ID::from_hex_str("0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472").unwrap();
/// let report = Report {
///    feed_id: id,
///    valid_from_timestamp: 1718885772,
///    observations_timestamp: 1718885772,
///    full_report: "00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b84720000000000000000000000000000000000000000000000000000000066741d8c00000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000064000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000640000070407020401522602090605060802080505a335ef7fae696b663f1b840100000000000000000000000000000000000000000000000000000000000bbbda0000000000000000000000000000000000000000000000000000000066741d8c".to_string(),
/// };
/// ```    
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Report {
    #[serde(rename = "feedID")]
    // pub feed_id: [u8; 32],
    pub feed_id: ID,

    #[serde(rename = "validFromTimestamp")]
    pub valid_from_timestamp: usize,

    #[serde(rename = "observationsTimestamp")]
    pub observations_timestamp: usize,

    #[serde(rename = "fullReport")]
    pub full_report: String,
}

/// ABI-decodes a full report payload into its report context (`bytes32[3]`) and report blob (`bytes`).
/// The report blob is the actual report data that needs to be decoded further - to version-specific report data.
///
/// # Parameters
///
/// - `payload`: The full report payload.
///
/// Solidity Equivalent:
/// ```solidity
/// struct ReportCallback {
///     bytes32[3] reportContext;
///     bytes reportBlob;
///     bytes32[] rawRs;
///     bytes32[] rawSs;
///     bytes32 rawVs;
/// }
/// ```
///
/// # Returns
///
/// The report context and report blob.
///
/// # Errors
///
/// Returns a `String` if the payload is too short, the offset is invalid, or the length is invalid.
pub fn decode_full_report(payload: &[u8]) -> Result<(Vec<[u8; 32]>, Vec<u8>), ReportError> {
    if payload.len() < 128 {
        return Err(ReportError::DataTooShort("Payload is too short"));
    }

    // Decode the first three bytes32 elements
    let report_context = (0..3)
        .map(|i| payload[i * ReportBase::WORD_SIZE..(i + 1) * ReportBase::WORD_SIZE].try_into())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| ReportError::ParseError("report_context"))?;

    // Decode the offset for the bytes reportBlob data
    let offset = usize::from_be_bytes(
        payload[96..128][24..ReportBase::WORD_SIZE] // Offset value is stored as Little Endian
            .try_into()
            .map_err(|_| ReportError::ParseError("offset as usize"))?,
    );

    if offset < 128 || offset >= payload.len() {
        return Err(ReportError::InvalidLength("offset"));
    }

    // Decode the length of the bytes reportBlob data
    let length = usize::from_be_bytes(
        payload[offset..offset + 32][24..ReportBase::WORD_SIZE] // Length value is stored as Little Endian
            .try_into()
            .map_err(|_| ReportError::ParseError("length as usize"))?,
    );

    if offset + ReportBase::WORD_SIZE + length > payload.len() {
        return Err(ReportError::InvalidLength("bytes data"));
    }

    // Decode the remainder of the payload (actual bytes reportBlob data)
    let report_blob =
        payload[offset + ReportBase::WORD_SIZE..offset + ReportBase::WORD_SIZE + length].to_vec();

    Ok((report_context, report_blob))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::report::{v1::ReportDataV1, v2::ReportDataV2, v3::ReportDataV3, v4::ReportDataV4, v5::ReportDataV5, v8::ReportDataV8, v9::ReportDataV9, v10::ReportDataV10};
    use num_bigint::BigInt;

    const V1_FEED_ID: ID = ID([
        0, 1, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58,
        163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114,
    ]);
    const V2_FEED_ID: ID = ID([
        00, 02, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58,
        163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114,
    ]);
    const V3_FEED_ID: ID = ID([
        00, 03, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58,
        163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114,
    ]);
    const V4_FEED_ID: ID = ID([
        00, 04, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58,
        163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114,
    ]);
    const V5_FEED_ID: ID = ID([
        00, 05, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58,
        163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114,
    ]);
    const V8_FEED_ID: ID = ID([
        00, 08, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58,
        163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114,
    ]);
    const V9_FEED_ID: ID = ID([
        00, 09, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58,
        163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114,
    ]);
    const V10_FEED_ID: ID = ID([
        00, 10, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58,
        163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114,
    ]);

    pub const MOCK_TIMESTAMP: u32 = 1718885772;
    pub const MOCK_FEE: usize = 10;
    pub const MOCK_PRICE: isize = 100;
    pub const MARKET_STATUS_OPEN: u32 = 2;

    pub fn generate_mock_report_data_v1() -> ReportDataV1 {
        let report_data = ReportDataV1 {
            feed_id: V1_FEED_ID,
            observations_timestamp: MOCK_TIMESTAMP,
            benchmark_price: BigInt::from(MOCK_PRICE),
            bid: BigInt::from(MOCK_PRICE),
            ask: BigInt::from(MOCK_PRICE),
            current_block_num: 100,
            current_block_hash: [
                0, 0, 7, 4, 7, 2, 4, 1, 82, 38, 2, 9, 6, 5, 6, 8, 2, 8, 5, 5, 163, 53, 239, 127,
                174, 105, 107, 102, 63, 27, 132, 1,
            ],
            valid_from_block_num: 768986,
            current_block_timestamp: MOCK_TIMESTAMP as u64,
        };

        report_data
    }

    pub fn generate_mock_report_data_v2() -> ReportDataV2 {
        let report_data = ReportDataV2 {
            feed_id: V2_FEED_ID,
            valid_from_timestamp: MOCK_TIMESTAMP,
            observations_timestamp: MOCK_TIMESTAMP,
            native_fee: BigInt::from(MOCK_FEE),
            link_fee: BigInt::from(MOCK_FEE),
            expires_at: MOCK_TIMESTAMP + 100,
            benchmark_price: BigInt::from(MOCK_PRICE),
        };

        report_data
    }

    pub fn generate_mock_report_data_v3() -> ReportDataV3 {
        let delta = BigInt::from(10) * BigInt::from(MOCK_PRICE) / BigInt::from(100); // 10% of mock_price

        let report_data = ReportDataV3 {
            feed_id: V3_FEED_ID,
            valid_from_timestamp: MOCK_TIMESTAMP,
            observations_timestamp: MOCK_TIMESTAMP,
            native_fee: BigInt::from(MOCK_FEE),
            link_fee: BigInt::from(MOCK_FEE),
            expires_at: MOCK_TIMESTAMP + 100,
            benchmark_price: BigInt::from(MOCK_PRICE),
            bid: MOCK_PRICE - delta.clone(),
            ask: MOCK_PRICE + delta,
        };

        report_data
    }

    pub fn generate_mock_report_data_v4() -> ReportDataV4 {
        let report_data = ReportDataV4 {
            feed_id: V4_FEED_ID,
            valid_from_timestamp: MOCK_TIMESTAMP,
            observations_timestamp: MOCK_TIMESTAMP,
            native_fee: BigInt::from(MOCK_FEE),
            link_fee: BigInt::from(MOCK_FEE),
            expires_at: MOCK_TIMESTAMP + 100,
            price: BigInt::from(MOCK_PRICE),
            market_status: MARKET_STATUS_OPEN,
        };

        report_data
    }

    pub fn generate_mock_report_data_v5() -> ReportDataV5 {
        let one_hour_in_seconds: u32 = 3600;

        let report_data = ReportDataV5 {
            feed_id: V5_FEED_ID,
            valid_from_timestamp: MOCK_TIMESTAMP,
            observations_timestamp: MOCK_TIMESTAMP,
            native_fee: BigInt::from(MOCK_FEE),
            link_fee: BigInt::from(MOCK_FEE),
            expires_at: MOCK_TIMESTAMP + 100,
            rate: BigInt::from(MOCK_PRICE),
            timestamp: MOCK_TIMESTAMP,
            duration: one_hour_in_seconds,
        };

        report_data
    }

    pub fn generate_mock_report_data_v8() -> ReportDataV8 {
        let report_data = ReportDataV8 {
            feed_id: V8_FEED_ID,
            valid_from_timestamp: MOCK_TIMESTAMP,
            observations_timestamp: MOCK_TIMESTAMP,
            native_fee: BigInt::from(MOCK_FEE),
            link_fee: BigInt::from(MOCK_FEE),
            expires_at: MOCK_TIMESTAMP + 100,
            last_update_timestamp: MOCK_TIMESTAMP as u64,
            mid_price: BigInt::from(MOCK_PRICE),
            market_status: MARKET_STATUS_OPEN,
        };

        report_data
    }

    pub fn generate_mock_report_data_v9() -> ReportDataV9 {
        const MOCK_NAV_PER_SHARE: isize = 1;
        const MOCK_AUM: isize = 1000;
        const RIPCORD_NORMAL: u32 = 0; 

        let report_data = ReportDataV9 {
            feed_id: V9_FEED_ID,
            valid_from_timestamp: MOCK_TIMESTAMP,
            observations_timestamp: MOCK_TIMESTAMP,
            native_fee: BigInt::from(MOCK_FEE),
            link_fee: BigInt::from(MOCK_FEE),
            expires_at: MOCK_TIMESTAMP + 100,
            nav_per_share: BigInt::from(MOCK_NAV_PER_SHARE),
            nav_date: MOCK_TIMESTAMP as u64,
            aum: BigInt::from(MOCK_AUM),
            ripcord: RIPCORD_NORMAL,
        };

        report_data
    }

    pub fn generate_mock_report_data_v10() -> ReportDataV10 {
        const MOCK_MULTIPLIER: isize = 1000000000000000000; // 1.0 with 18 decimals

        let report_data = ReportDataV10 {
            feed_id: V10_FEED_ID,
            valid_from_timestamp: MOCK_TIMESTAMP,
            observations_timestamp: MOCK_TIMESTAMP,
            native_fee: BigInt::from(MOCK_FEE),
            link_fee: BigInt::from(MOCK_FEE),
            expires_at: MOCK_TIMESTAMP + 100,
            last_update_timestamp: MOCK_TIMESTAMP as u64,
            price: BigInt::from(MOCK_PRICE),
            market_status: MARKET_STATUS_OPEN,
            current_multiplier: BigInt::from(MOCK_MULTIPLIER),
            new_multiplier: BigInt::from(MOCK_MULTIPLIER),
            activation_date_time: MOCK_TIMESTAMP + 200,
            tokenized_price: BigInt::from(MOCK_PRICE * 2),
        };

        report_data
    }

    fn generate_mock_report(encoded_report_data: &[u8]) -> Vec<u8> {
        let mut payload = Vec::new();

        let report_context = vec![[0u8; 32]; 3];
        for context in &report_context {
            payload.extend_from_slice(context);
        }

        let mut offset = [0u8; 32];
        let offset_value: usize = 96 + 32;
        offset[24..32].copy_from_slice(&offset_value.to_be_bytes());
        payload.extend_from_slice(&offset);

        let mut length = [0u8; 32];
        let length_value: usize = encoded_report_data.len();
        length[24..32].copy_from_slice(&length_value.to_be_bytes());
        payload.extend_from_slice(&length);

        payload.extend_from_slice(encoded_report_data);

        // Raw `r` values, `s` values, and `v` values are not used in this test

        payload
    }

    fn bytes(hex_str: &str) -> Vec<u8> {
        if hex_str.len() % 2 != 0 {
            panic!("Invalid hex string: odd number of characters");
        }

        hex_str
            .trim_start_matches("0x")
            .as_bytes()
            .chunks(2)
            .map(|chunk| u8::from_str_radix(std::str::from_utf8(chunk).unwrap(), 16).unwrap())
            .collect()
    }

    #[test]
    fn test_decode_report_v1() {
        let report_data = generate_mock_report_data_v1();
        let encoded_report_data = report_data.abi_encode().unwrap();

        let report = generate_mock_report(&encoded_report_data);

        let (_report_context, report_blob) = decode_full_report(&report).unwrap();

        let expected_report_blob = vec![
            "00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "0000000000000000000000000000000000000000000000000000000000000064",
            "0000000000000000000000000000000000000000000000000000000000000064",
            "0000000000000000000000000000000000000000000000000000000000000064",
            "0000000000000000000000000000000000000000000000000000000000000064",
            "0000070407020401522602090605060802080505a335ef7fae696b663f1b8401",
            "00000000000000000000000000000000000000000000000000000000000bbbda",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
        ];

        assert_eq!(
            report_blob,
            bytes(&format!("0x{}", expected_report_blob.join("")))
        );

        let decoded_report = ReportDataV1::decode(&report_blob).unwrap();

        assert_eq!(decoded_report.feed_id, V1_FEED_ID);
    }

    #[test]
    fn test_decode_report_v2() {
        let report_data = generate_mock_report_data_v2();
        let encoded_report_data = report_data.abi_encode().unwrap();

        let report = generate_mock_report(&encoded_report_data);

        let (_report_context, report_blob) = decode_full_report(&report).unwrap();

        let expected_report_blob = vec![
            "00026b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "000000000000000000000000000000000000000000000000000000000000000a",
            "000000000000000000000000000000000000000000000000000000000000000a",
            "0000000000000000000000000000000000000000000000000000000066741df0",
            "0000000000000000000000000000000000000000000000000000000000000064",
        ];

        assert_eq!(
            report_blob,
            bytes(&format!("0x{}", expected_report_blob.join("")))
        );

        let decoded_report = ReportDataV2::decode(&report_blob).unwrap();

        assert_eq!(decoded_report.feed_id, V2_FEED_ID);
    }

    #[test]
    fn test_decode_report_v3() {
        let report_data = generate_mock_report_data_v3();
        let encoded_report_data = report_data.abi_encode().unwrap();

        let report = generate_mock_report(&encoded_report_data);

        let (_report_context, report_blob) = decode_full_report(&report).unwrap();

        let expected_report_blob = vec![
            "00036b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "000000000000000000000000000000000000000000000000000000000000000a",
            "000000000000000000000000000000000000000000000000000000000000000a",
            "0000000000000000000000000000000000000000000000000000000066741df0",
            "0000000000000000000000000000000000000000000000000000000000000064", // Price: 100
            "000000000000000000000000000000000000000000000000000000000000005a", // Bid: 90
            "000000000000000000000000000000000000000000000000000000000000006e", // Ask: 110
        ];

        assert_eq!(
            report_blob,
            bytes(&format!("0x{}", expected_report_blob.join("")))
        );

        let decoded_report = ReportDataV3::decode(&report_blob).unwrap();

        assert_eq!(decoded_report.feed_id, V3_FEED_ID);
    }

    #[test]
    fn test_decode_report_v4() {
        let report_data = generate_mock_report_data_v4();
        let encoded_report_data = report_data.abi_encode().unwrap();

        let report = generate_mock_report(&encoded_report_data);

        let (_report_context, report_blob) = decode_full_report(&report).unwrap();

        let expected_report_blob = vec![
            "00046b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "000000000000000000000000000000000000000000000000000000000000000a",
            "000000000000000000000000000000000000000000000000000000000000000a",
            "0000000000000000000000000000000000000000000000000000000066741df0",
            "0000000000000000000000000000000000000000000000000000000000000064",
            "0000000000000000000000000000000000000000000000000000000000000002", // Market status: Open
        ];

        assert_eq!(
            report_blob,
            bytes(&format!("0x{}", expected_report_blob.join("")))
        );

        let decoded_report = ReportDataV4::decode(&report_blob).unwrap();

        assert_eq!(decoded_report.feed_id, V4_FEED_ID);
    }

    #[test]
    fn test_decode_report_v5() {
        let report_data = generate_mock_report_data_v5();
        let encoded_report_data = report_data.abi_encode().unwrap();

        let report = generate_mock_report(&encoded_report_data);

        let (_report_context, report_blob) = decode_full_report(&report).unwrap();

        let expected_report_blob = vec![
            "00056b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "000000000000000000000000000000000000000000000000000000000000000a",
            "000000000000000000000000000000000000000000000000000000000000000a",
            "0000000000000000000000000000000000000000000000000000000066741df0",
            "0000000000000000000000000000000000000000000000000000000000000064", // Rate: 100
            "0000000000000000000000000000000000000000000000000000000066741d8c", // Timestamp
            "0000000000000000000000000000000000000000000000000000000000000e10", // Duration: 3600
        ];

        assert_eq!(
            report_blob,
            bytes(&format!("0x{}", expected_report_blob.join("")))
        );

        let decoded_report = ReportDataV5::decode(&report_blob).unwrap();

        assert_eq!(decoded_report.feed_id, V5_FEED_ID);
    }

    #[test]
    fn test_decode_report_v8() {
        let report_data = generate_mock_report_data_v8();
        let encoded_report_data = report_data.abi_encode().unwrap();

        let report = generate_mock_report(&encoded_report_data);

        let (_report_context, report_blob) = decode_full_report(&report).unwrap();

        let expected_report_blob = vec![
            "00086b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "000000000000000000000000000000000000000000000000000000000000000a",
            "000000000000000000000000000000000000000000000000000000000000000a",
            "0000000000000000000000000000000000000000000000000000000066741df0",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "0000000000000000000000000000000000000000000000000000000000000064",
            "0000000000000000000000000000000000000000000000000000000000000002", // Market status: Open
        ];

        assert_eq!(
            report_blob,
            bytes(&format!("0x{}", expected_report_blob.join("")))
        );

        let decoded_report = ReportDataV8::decode(&report_blob).unwrap();

        assert_eq!(decoded_report.feed_id, V8_FEED_ID);
    }

    #[test]
    fn test_decode_report_v9() {
        let report_data = generate_mock_report_data_v9();
        let encoded_report_data = report_data.abi_encode().unwrap();

        let report = generate_mock_report(&encoded_report_data);

        let (_report_context, report_blob) = decode_full_report(&report).unwrap();

        let expected_report_blob = vec![
            "00096b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "000000000000000000000000000000000000000000000000000000000000000a",
            "000000000000000000000000000000000000000000000000000000000000000a",
            "0000000000000000000000000000000000000000000000000000000066741df0",
            "0000000000000000000000000000000000000000000000000000000000000001", // NAV per share
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "00000000000000000000000000000000000000000000000000000000000003e8", // AUM
            "0000000000000000000000000000000000000000000000000000000000000000", // Ripcord: Normal
        ];

        assert_eq!(
            report_blob,
            bytes(&format!("0x{}", expected_report_blob.join("")))
        );

        let decoded_report = ReportDataV9::decode(&report_blob).unwrap();

        assert_eq!(decoded_report.feed_id, V9_FEED_ID);
    }

    #[test]
    fn test_decode_report_v10() {
        let report_data = generate_mock_report_data_v10();
        let encoded_report_data = report_data.abi_encode().unwrap();

        let report = generate_mock_report(&encoded_report_data);

        let (_report_context, report_blob) = decode_full_report(&report).unwrap();

        let expected_report_blob = vec![
            "000a6b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "000000000000000000000000000000000000000000000000000000000000000a",
            "000000000000000000000000000000000000000000000000000000000000000a",
            "0000000000000000000000000000000000000000000000000000000066741df0",
            "0000000000000000000000000000000000000000000000000000000066741d8c",
            "0000000000000000000000000000000000000000000000000000000000000064",
            "0000000000000000000000000000000000000000000000000000000000000002", // Market status: Open
            "0000000000000000000000000000000000000000000000000de0b6b3a7640000", // Current multiplier: 1.0 with 18 decimals
            "0000000000000000000000000000000000000000000000000de0b6b3a7640000", // New multiplier: 1.0 with 18 decimals
            "0000000000000000000000000000000000000000000000000000000066741e54", // Activation date time
            "00000000000000000000000000000000000000000000000000000000000000c8", // Tokenized price: 200
        ];

        let expected = bytes(&format!("0x{}", expected_report_blob.join("")));
        println!("Actual  : {}", hex::encode(&report_blob));
        println!("Expected: {}", hex::encode(&expected));
        assert_eq!(report_blob, expected);

        let decoded_report = ReportDataV10::decode(&report_blob).unwrap();

        assert_eq!(decoded_report.feed_id, V10_FEED_ID);
    }
}
