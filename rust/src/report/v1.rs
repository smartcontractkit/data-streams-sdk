use alloy::sol;
use alloy::sol_types::SolValue;

sol! {
    #[derive(Debug)]
    struct ReportDataV1 {
        bytes32 feedId; // The feed ID the report has data for.
        uint32 observationsTimestamp; // Latest timestamp for which price is applicable.
        int192 benchmarkPrice; // DON consensus median price (8 or 18 decimals).
        int192 bid; // Simulated price impact of a buy order up to the X% depth of liquidity utilisation (8 or 18 decimals).
        int192 ask; // Simulated price impact of a sell order up to the X% depth of liquidity utilisation (8 or 18 decimals).
        uint64 currentBlockNum; // Block number at which the report was generated.
        bytes32 currentBlockHash; // Block hash at which the report was generated.
        uint64 validFromBlockNum; // Earliest block number for which price is applicable.
        uint64 currentBlockTimestamp; // Timestamp at which the report was generated.
    }
}

impl ReportDataV1 {
    /// Decodes an ABI-encoded `ReportDataV1` from bytes.
    pub fn decode(data: &[u8]) -> Result<Self, String> {
        Self::abi_decode(data, false).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::report::tests::generate_mock_report_data_v1;
    use alloy::primitives::{aliases::I192, b256};

    #[test]
    fn decode_report_data_v1() {
        let report_data: ReportDataV1 = generate_mock_report_data_v1();
        let encoded = report_data.abi_encode();
        let decoded = ReportDataV1::decode(&encoded).unwrap();

        let expected_mock_price = I192::from_dec_str("100").unwrap();

        assert_eq!(
            decoded.feedId,
            b256!("00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472")
        );
        assert_eq!(decoded.observationsTimestamp, 1718885772);
        assert_eq!(decoded.benchmarkPrice, expected_mock_price);
        assert_eq!(decoded.bid, expected_mock_price);
        assert_eq!(decoded.ask, expected_mock_price);
        assert_eq!(decoded.currentBlockNum, 100);
        assert_eq!(
            decoded.currentBlockHash,
            b256!("0000070407020401522602090605060802080505a335ef7fae696b663f1b8401")
        );
        assert_eq!(decoded.validFromBlockNum, 768986);
        assert_eq!(decoded.currentBlockTimestamp, 1718885772);
    }
}
