pub mod compress;
pub mod v1;
pub mod v2;
pub mod v3;
pub mod v4;

use crate::feed::ID;

use alloy::sol;
use alloy::sol_types::SolValue;
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
/// use data_streams_sdk::report::Report;
/// use data_streams_sdk::feed::ID;
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
    pub feed_id: ID,

    #[serde(rename = "validFromTimestamp")]
    pub valid_from_timestamp: usize,

    #[serde(rename = "observationsTimestamp")]
    pub observations_timestamp: usize,

    #[serde(rename = "fullReport")]
    pub full_report: String,
}

sol! {
    #[derive(Debug)]
    struct ReportCallback {
        bytes32[3] reportContext;
        bytes reportBlob;
        bytes32[] rawRs;
        bytes32[] rawSs;
        bytes32 rawVs;
    }
}

impl ReportCallback {
    /// Decodes an ABI-encoded `ReportCallback` from bytes.
    pub fn decode(data: &[u8]) -> Result<Self, String> {
        Self::abi_decode(data, false).map_err(|e| e.to_string())
    }
}

/// ABI-decodes a full report payload into its report context (`bytes32[3]`) and report blob (`bytes`).
/// The report blob is the actual report data that needs to be decoded further - to version-specific report data.
pub fn decode_full_report(payload: &[u8]) -> Result<(Vec<[u8; 32]>, Vec<u8>), String> {
    if payload.len() < 128 {
        return Err("Payload is too short".to_string());
    }

    // Decode the first three bytes32 elements
    let report_context = (0..3)
        .map(|i| payload[i * 32..(i + 1) * 32].try_into())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| "Failed to parse report_context")?;

    // Decode the offset for the bytes reportBlob data
    let offset = usize::from_be_bytes(
        payload[96..128][24..32]
            .try_into()
            .map_err(|_| "Failed to parse offset as usize")?,
    );

    if offset < 128 || offset >= payload.len() {
        return Err("Invalid offset".to_string());
    }

    // Decode the length of the bytes reportBlob data
    let length = usize::from_be_bytes(
        payload[offset..offset + 32][24..32]
            .try_into()
            .map_err(|_| "Failed to parse length as usize")?,
    );

    if offset + 32 + length > payload.len() {
        return Err("Invalid length for bytes data".to_string());
    }

    // Decode the remainder of the payload (actual bytes reportBlob data)
    let report_blob = payload[offset + 32..offset + 32 + length].to_vec();

    Ok((report_context, report_blob))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::report::{v1::ReportDataV1, v2::ReportDataV2, v3::ReportDataV3, v4::ReportDataV4};
    use alloy::primitives::{
        aliases::{I192, U192},
        b256, bytes, Bytes, FixedBytes,
    };

    pub fn generate_mock_report_data_v1() -> ReportDataV1 {
        let mock_price = I192::from_dec_str("100").unwrap();

        let report_data = ReportDataV1 {
            feedId: FixedBytes::from([
                00, 01, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86,
                253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114,
            ]),
            observationsTimestamp: 1718885772,
            benchmarkPrice: mock_price,
            bid: mock_price,
            ask: mock_price,
            currentBlockNum: 100,
            currentBlockHash: FixedBytes::from([
                0, 0, 7, 4, 7, 2, 4, 1, 82, 38, 2, 9, 6, 5, 6, 8, 2, 8, 5, 5, 163, 53, 239, 127,
                174, 105, 107, 102, 63, 27, 132, 1,
            ]),
            validFromBlockNum: 768986,
            currentBlockTimestamp: 1718885772,
        };

        report_data
    }

    pub fn generate_mock_report_data_v2() -> ReportDataV2 {
        let mock_timestamp: u32 = 1718885772;
        let mock_fee = U192::from(10);
        let mock_price = I192::from_dec_str("100").unwrap();

        let report_data = ReportDataV2 {
            feedId: FixedBytes::from([
                0, 2, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86,
                253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114,
            ]),
            validFromTimestamp: mock_timestamp,
            observationsTimestamp: mock_timestamp,
            nativeFee: mock_fee,
            linkFee: mock_fee,
            expiresAt: mock_timestamp + 100,
            benchmarkPrice: mock_price,
        };

        report_data
    }

    pub fn generate_mock_report_data_v3() -> ReportDataV3 {
        let mock_timestamp: u32 = 1718885772;
        let mock_fee = U192::from(10);
        let mock_price = I192::from_dec_str("100").unwrap();

        let report_data = ReportDataV3 {
            feedId: FixedBytes::from([
                0, 3, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86,
                253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114,
            ]),
            validFromTimestamp: mock_timestamp,
            observationsTimestamp: mock_timestamp,
            nativeFee: mock_fee,
            linkFee: mock_fee,
            expiresAt: mock_timestamp + 100,
            benchmarkPrice: mock_price,
            bid: mock_price,
            ask: mock_price,
        };

        report_data
    }

    pub fn generate_mock_report_data_v4() -> ReportDataV4 {
        const MARKET_STATUS_OPEN: u32 = 2;

        let mock_timestamp: u32 = 1718885772;
        let mock_fee = U192::from(10);
        let mock_price = I192::from_dec_str("100").unwrap();

        let report_data = ReportDataV4 {
            feedId: FixedBytes::from([
                00, 04, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86,
                253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114,
            ]),
            validFromTimestamp: mock_timestamp,
            observationsTimestamp: mock_timestamp,
            nativeFee: mock_fee,
            linkFee: mock_fee,
            expiresAt: mock_timestamp + 100,
            price: mock_price,
            marketStatus: MARKET_STATUS_OPEN,
        };

        report_data
    }

    pub fn generate_mock_report(encoded_report_data: Bytes) -> ReportCallback {
        let report = ReportCallback {
            reportContext: [
                FixedBytes::from([0; 32]),
                FixedBytes::from([0; 32]),
                FixedBytes::from([0; 32]),
            ],
            reportBlob: encoded_report_data,
            rawRs: vec![FixedBytes::from([
                0, 1, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13,
                53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14,
            ])],
            rawSs: vec![FixedBytes::from([
                1, 2, 10, 73, 65, 19, 14, 27, 42, 48, 52, 18, 39, 116, 67, 85, 13, 82, 33, 48, 23,
                33, 49, 32, 67, 50, 37, 32, 63, 77, 14, 64,
            ])],
            rawVs: FixedBytes::from([
                0, 1, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13,
                53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14,
            ]),
        };

        report
    }

    #[test]
    fn test_decode_report_v1() {
        let report_data = generate_mock_report_data_v1();
        let encoded_report_data = report_data.abi_encode();

        let report = generate_mock_report(Bytes::from(encoded_report_data));

        let encoded_report = report.abi_encode();
        let decoded_report = ReportCallback::decode(&encoded_report).unwrap();

        assert_eq!(decoded_report.reportContext[0], FixedBytes::from([0; 32]));
        assert_eq!(decoded_report.reportContext[1], FixedBytes::from([0; 32]));
        assert_eq!(decoded_report.reportContext[2], FixedBytes::from([0; 32]));
        assert_eq!(decoded_report.reportBlob, bytes!("00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b84720000000000000000000000000000000000000000000000000000000066741d8c00000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000064000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000640000070407020401522602090605060802080505a335ef7fae696b663f1b840100000000000000000000000000000000000000000000000000000000000bbbda0000000000000000000000000000000000000000000000000000000066741d8c"));
        assert_eq!(
            decoded_report.rawRs[0],
            b256!("00010a4a431d18110c12160b450b3f560c56173a0d351d0c110a110c3f1b0c0e")
        );
        assert_eq!(
            decoded_report.rawSs[0],
            b256!("01020a4941130e1b2a303412277443550d52213017213120433225203f4d0e40")
        );
        assert_eq!(
            decoded_report.rawVs,
            b256!("00010a4a431d18110c12160b450b3f560c56173a0d351d0c110a110c3f1b0c0e")
        );

        let decoded_data = ReportDataV1::decode(&decoded_report.reportBlob).unwrap();

        assert_eq!(
            decoded_data.feedId,
            b256!("00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472")
        );
    }

    #[test]
    fn test_decode_report_v2() {
        let report_data = generate_mock_report_data_v2();
        let encoded_report_data = report_data.abi_encode();

        let report = generate_mock_report(Bytes::from(encoded_report_data));

        let encoded_report = report.abi_encode();
        let decoded_report = ReportCallback::decode(&encoded_report).unwrap();

        assert_eq!(decoded_report.reportContext[0], FixedBytes::from([0; 32]));
        assert_eq!(decoded_report.reportContext[1], FixedBytes::from([0; 32]));
        assert_eq!(decoded_report.reportContext[2], FixedBytes::from([0; 32]));
        assert_eq!(decoded_report.reportBlob, bytes!("00026b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b84720000000000000000000000000000000000000000000000000000000066741d8c0000000000000000000000000000000000000000000000000000000066741d8c000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000066741df00000000000000000000000000000000000000000000000000000000000000064"));
        assert_eq!(
            decoded_report.rawRs[0],
            b256!("00010a4a431d18110c12160b450b3f560c56173a0d351d0c110a110c3f1b0c0e")
        );
        assert_eq!(
            decoded_report.rawSs[0],
            b256!("01020a4941130e1b2a303412277443550d52213017213120433225203f4d0e40")
        );
        assert_eq!(
            decoded_report.rawVs,
            b256!("00010a4a431d18110c12160b450b3f560c56173a0d351d0c110a110c3f1b0c0e")
        );

        let decoded_data = ReportDataV2::decode(&decoded_report.reportBlob).unwrap();

        assert_eq!(
            decoded_data.feedId,
            b256!("00026b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472")
        );
    }

    #[test]
    fn test_decode_report_v3() {
        let report_data = generate_mock_report_data_v3();
        let encoded_report_data = report_data.abi_encode();

        let report = generate_mock_report(Bytes::from(encoded_report_data));

        let encoded_report = report.abi_encode();
        let decoded_report = ReportCallback::decode(&encoded_report).unwrap();

        assert_eq!(decoded_report.reportContext[0], FixedBytes::from([0; 32]));
        assert_eq!(decoded_report.reportContext[1], FixedBytes::from([0; 32]));
        assert_eq!(decoded_report.reportContext[2], FixedBytes::from([0; 32]));
        assert_eq!(decoded_report.reportBlob, bytes!("00036b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b84720000000000000000000000000000000000000000000000000000000066741d8c0000000000000000000000000000000000000000000000000000000066741d8c000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000066741df0000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000064"));
        assert_eq!(
            decoded_report.rawRs[0],
            b256!("00010a4a431d18110c12160b450b3f560c56173a0d351d0c110a110c3f1b0c0e")
        );
        assert_eq!(
            decoded_report.rawSs[0],
            b256!("01020a4941130e1b2a303412277443550d52213017213120433225203f4d0e40")
        );
        assert_eq!(
            decoded_report.rawVs,
            b256!("00010a4a431d18110c12160b450b3f560c56173a0d351d0c110a110c3f1b0c0e")
        );

        let decoded_data = ReportDataV3::decode(&decoded_report.reportBlob).unwrap();

        assert_eq!(
            decoded_data.feedId,
            b256!("00036b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472")
        );
    }

    #[test]
    fn test_decode_report_v4() {
        let report_data = generate_mock_report_data_v4();
        let encoded_report_data = report_data.abi_encode();

        let report = generate_mock_report(Bytes::from(encoded_report_data));

        let encoded_report = report.abi_encode();
        let decoded_report = ReportCallback::decode(&encoded_report).unwrap();

        assert_eq!(decoded_report.reportContext[0], FixedBytes::from([0; 32]));
        assert_eq!(decoded_report.reportContext[1], FixedBytes::from([0; 32]));
        assert_eq!(decoded_report.reportContext[2], FixedBytes::from([0; 32]));
        assert_eq!(decoded_report.reportBlob, bytes!("00046b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b84720000000000000000000000000000000000000000000000000000000066741d8c0000000000000000000000000000000000000000000000000000000066741d8c000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000066741df000000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000002"));
        assert_eq!(
            decoded_report.rawRs[0],
            b256!("00010a4a431d18110c12160b450b3f560c56173a0d351d0c110a110c3f1b0c0e")
        );
        assert_eq!(
            decoded_report.rawSs[0],
            b256!("01020a4941130e1b2a303412277443550d52213017213120433225203f4d0e40")
        );
        assert_eq!(
            decoded_report.rawVs,
            b256!("00010a4a431d18110c12160b450b3f560c56173a0d351d0c110a110c3f1b0c0e")
        );

        let decoded_data = ReportDataV4::decode(&decoded_report.reportBlob).unwrap();

        assert_eq!(
            decoded_data.feedId,
            b256!("00046b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472")
        );
    }
}