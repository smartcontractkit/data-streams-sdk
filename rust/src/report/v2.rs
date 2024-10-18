use alloy::sol;
use alloy::sol_types::SolValue;

sol! {
    #[derive(Debug)]
    struct ReportDataV2 {
        bytes32 feedId; // The feed ID the report has data for
        uint32 validFromTimestamp; // Earliest timestamp for which price is applicable
        uint32 observationsTimestamp; // Latest timestamp for which price is applicable
        uint192 nativeFee; // Base cost to validate a transaction using the report, denominated in the chain’s native token (WETH/ETH)
        uint192 linkFee; // Base cost to validate a transaction using the report, denominated in LINK
        uint32 expiresAt; // Latest timestamp where the report can be verified on-chain
        int192 benchmarkPrice; // DON consensus median price, carried to 8 decimal places
    }
}

impl ReportDataV2 {
    /// Decodes an ABI-encoded `ReportDataV2` from bytes.
    pub fn decode(data: &[u8]) -> Result<Self, String> {
        Self::abi_decode(data, false).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::report::tests::generate_mock_report_data_v2;
    use alloy::primitives::{
        aliases::{I192, U192},
        b256,
    };

    #[test]
    fn decode_report_data_v2() {
        let report_data = generate_mock_report_data_v2();
        let encoded = report_data.abi_encode();
        let decoded = ReportDataV2::decode(&encoded).unwrap();

        let expected_timestamp: u32 = 1718885772;
        let expected_fee = U192::from(10);
        let expected_price = I192::from_dec_str("100").unwrap();

        assert_eq!(
            decoded.feedId,
            b256!("00026b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472")
        );
        assert_eq!(decoded.validFromTimestamp, expected_timestamp);
        assert_eq!(decoded.observationsTimestamp, expected_timestamp);
        assert_eq!(decoded.nativeFee, expected_fee);
        assert_eq!(decoded.linkFee, expected_fee);
        assert_eq!(decoded.expiresAt, expected_timestamp + 100);
        assert_eq!(decoded.benchmarkPrice, expected_price);
    }
}
