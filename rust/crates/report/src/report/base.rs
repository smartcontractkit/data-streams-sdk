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

    #[error("Invalid value for {0}")]
    InvalidValue(&'static str),
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

    /// Reads an ABI dynamic `string` referenced by the head word at `offset`.
    ///
    /// The head word holds a byte offset (relative to the start of `data`) pointing to the
    /// string's tail, where the first word is the byte length followed by the UTF-8 data
    /// padded to a multiple of `WORD_SIZE`.
    pub(crate) fn read_string(data: &[u8], offset: usize) -> Result<String, ReportError> {
        if offset + Self::WORD_SIZE > data.len() {
            return Err(ReportError::DataTooShort("string offset"));
        }

        // The offset value is stored in the low 8 bytes of the head word.
        let ptr = usize::from_be_bytes(
            data[offset..offset + Self::WORD_SIZE][24..Self::WORD_SIZE]
                .try_into()
                .map_err(|_| ReportError::ParseError("string offset as usize"))?,
        );

        let ptr_end = ptr
            .checked_add(Self::WORD_SIZE)
            .ok_or(ReportError::InvalidLength("string offset overflow"))?;
        if ptr_end > data.len() {
            return Err(ReportError::InvalidLength("string offset"));
        }

        let length = usize::from_be_bytes(
            data[ptr..ptr + Self::WORD_SIZE][24..Self::WORD_SIZE]
                .try_into()
                .map_err(|_| ReportError::ParseError("string length as usize"))?,
        );

        let start = ptr_end;
        let end = start
            .checked_add(length)
            .ok_or(ReportError::InvalidLength("string length overflow"))?;
        if end > data.len() {
            return Err(ReportError::InvalidLength("string data"));
        }

        String::from_utf8(data[start..end].to_vec())
            .map_err(|_| ReportError::ParseError("string (utf8)"))
    }

    /// Encodes an ABI dynamic `string` tail: a `WORD_SIZE` length word followed by the UTF-8
    /// bytes right-padded with zeros to a multiple of `WORD_SIZE`.
    ///
    /// The caller is responsible for writing the corresponding head offset word.
    pub(crate) fn encode_string_tail(value: &str) -> Vec<u8> {
        let bytes = value.as_bytes();

        let mut length_word = [0u8; Self::WORD_SIZE];
        length_word[24..Self::WORD_SIZE].copy_from_slice(&(bytes.len() as u64).to_be_bytes());

        let mut buffer = length_word.to_vec();

        if !bytes.is_empty() {
            let padded_len = bytes.len().div_ceil(Self::WORD_SIZE) * Self::WORD_SIZE;
            let mut data_words = vec![0u8; padded_len];
            data_words[..bytes.len()].copy_from_slice(bytes);
            buffer.extend_from_slice(&data_words);
        }

        buffer
    }
}
