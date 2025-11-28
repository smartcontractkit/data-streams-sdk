use num_bigint::{BigInt, Sign};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ReportError {
    #[error("Data is too short for {0}")]
    DataTooShort(&'static str),

    #[error("Invalid length for {0}")]
    InvalidLength(&'static str),

    #[error("Failed to parse {0}")]
    ParseError(&'static str),
}

pub(crate) struct ReportBase;

impl ReportBase {
    pub(crate) const WORD_SIZE: usize = 32;

    pub(crate) fn read_int192(data: &[u8], offset: usize) -> Result<BigInt, ReportError> {
        if offset + Self::WORD_SIZE > data.len() {
            return Err(ReportError::DataTooShort("int192"));
        }
        let value_bytes = &data[offset..offset + Self::WORD_SIZE];
        Ok(BigInt::from_signed_bytes_be(&value_bytes[8..32]))
    }

    pub(crate) fn encode_int192(value: &BigInt) -> Result<[u8; 32], ReportError> {
        let mut buffer = [0u8; 32];
        let bytes_value = value.to_signed_bytes_be();
        let len = bytes_value.len();

        if len > 24 {
            return Err(ReportError::InvalidLength("int192"));
        }

        buffer[32 - len..32].copy_from_slice(&bytes_value);
        Ok(buffer)
    }

    pub(crate) fn read_uint192(data: &[u8], offset: usize) -> Result<BigInt, ReportError> {
        if offset + Self::WORD_SIZE > data.len() {
            return Err(ReportError::DataTooShort("uint192"));
        }
        let value_bytes = &data[offset..offset + Self::WORD_SIZE];
        Ok(BigInt::from_bytes_be(Sign::Plus, &value_bytes[8..32]))
    }

    pub(crate) fn encode_uint192(value: &BigInt) -> Result<[u8; 32], ReportError> {
        let mut buffer = [0u8; 32];
        let (_, bytes_value) = value.to_bytes_be();
        let len = bytes_value.len();

        if len > 24 {
            return Err(ReportError::InvalidLength("uint192"));
        }

        buffer[32 - len..32].copy_from_slice(&bytes_value);
        Ok(buffer)
    }

    pub(crate) fn read_uint32(data: &[u8], offset: usize) -> Result<u32, ReportError> {
        if offset + Self::WORD_SIZE > data.len() {
            return Err(ReportError::DataTooShort("uint32"));
        }
        let value_bytes = &data[offset..offset + Self::WORD_SIZE];
        Ok(u32::from_be_bytes(
            value_bytes[28..32]
                .try_into()
                .map_err(|_| ReportError::InvalidLength("uint32"))?,
        ))
    }

    pub(crate) fn encode_uint32(value: u32) -> Result<[u8; 32], ReportError> {
        let mut buffer = [0u8; 32];
        let bytes_value = value.to_be_bytes();
        let len = bytes_value.len();

        if len > 4 {
            return Err(ReportError::InvalidLength("uint32"));
        }

        buffer[32 - len..32].copy_from_slice(&bytes_value);
        Ok(buffer)
    }

    pub(crate) fn read_uint64(data: &[u8], offset: usize) -> Result<u64, ReportError> {
        if offset + Self::WORD_SIZE > data.len() {
            return Err(ReportError::DataTooShort("uint64"));
        }
        let value_bytes = &data[offset..offset + Self::WORD_SIZE];
        Ok(u64::from_be_bytes(
            value_bytes[24..32]
                .try_into()
                .map_err(|_| ReportError::InvalidLength("uint64"))?,
        ))
    }

    pub(crate) fn encode_uint64(value: u64) -> Result<[u8; 32], ReportError> {
        let mut buffer = [0u8; 32];
        let bytes_value = value.to_be_bytes();
        let len = bytes_value.len();

        if len > 8 {
            return Err(ReportError::InvalidLength("uint64"));
        }

        buffer[32 - len..32].copy_from_slice(&bytes_value);
        Ok(buffer)
    }

    pub(crate) fn read_int64(data: &[u8], offset: usize) -> Result<i64, ReportError> {
        if offset + Self::WORD_SIZE > data.len() {
            return Err(ReportError::DataTooShort("int64"));
        }
        let value_bytes = &data[offset..offset + Self::WORD_SIZE];
        Ok(i64::from_be_bytes(
            value_bytes[24..32]
                .try_into()
                .map_err(|_| ReportError::InvalidLength("int64"))?,
        ))
    }

    pub(crate) fn encode_int64(value: i64) -> Result<[u8; 32], ReportError> {
        let mut buffer = [0u8; 32];
        let bytes_value = value.to_be_bytes();
        let len = bytes_value.len();

        if len > 8 {
            return Err(ReportError::InvalidLength("int64"));
        }

        buffer[32 - len..32].copy_from_slice(&bytes_value);
        Ok(buffer)
    }
}
