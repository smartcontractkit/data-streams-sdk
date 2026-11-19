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
        // Sign-extend: a negative value's high bytes must be 0xff, not 0x00.
        let fill = if value.sign() == Sign::Minus {
            0xff
        } else {
            0x00
        };
        let mut buffer = [fill; 32];
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
        // Sign-extend: a negative value's high bytes must be 0xff, not 0x00.
        let fill = if value < 0 { 0xff } else { 0x00 };
        let mut buffer = [fill; 32];
        let bytes_value = value.to_be_bytes();
        let len = bytes_value.len();

        if len > 8 {
            return Err(ReportError::InvalidLength("int64"));
        }

        buffer[32 - len..32].copy_from_slice(&bytes_value);
        Ok(buffer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_int192_sign_extends_negative_values() {
        let encoded = ReportBase::encode_int192(&BigInt::from(-1)).unwrap();
        assert_eq!(encoded, [0xffu8; 32]);

        let encoded = ReportBase::encode_int192(&BigInt::from(-1_000_000)).unwrap();
        let mut expected = [0xffu8; 32];
        expected[29..32].copy_from_slice(&[0xf0, 0xbd, 0xc0]);
        assert_eq!(encoded, expected);
    }

    #[test]
    fn encode_int192_round_trips() {
        let min: BigInt = -(BigInt::from(1) << 191usize);
        let max: BigInt = (BigInt::from(1) << 191usize) - 1;
        for value in [
            BigInt::from(0),
            BigInt::from(1),
            BigInt::from(-1),
            BigInt::from(-1_000_000),
            BigInt::from(i64::MIN),
            min,
            max,
        ] {
            let encoded = ReportBase::encode_int192(&value).unwrap();
            assert_eq!(ReportBase::read_int192(&encoded, 0).unwrap(), value);
        }
    }

    #[test]
    fn encode_int192_rejects_out_of_range_values() {
        let too_small: BigInt = -(BigInt::from(1) << 191usize) - 1;
        let too_large: BigInt = BigInt::from(1) << 191usize;
        assert!(ReportBase::encode_int192(&too_small).is_err());
        assert!(ReportBase::encode_int192(&too_large).is_err());
    }

    #[test]
    fn encode_int64_sign_extends_negative_values() {
        assert_eq!(ReportBase::encode_int64(-1).unwrap(), [0xffu8; 32]);

        let encoded = ReportBase::encode_int64(i64::MIN).unwrap();
        assert_eq!(&encoded[..24], &[0xffu8; 24]);
        assert_eq!(ReportBase::read_int64(&encoded, 0).unwrap(), i64::MIN);

        let encoded = ReportBase::encode_int64(42).unwrap();
        assert_eq!(&encoded[..24], &[0u8; 24]);
        assert_eq!(ReportBase::read_int64(&encoded, 0).unwrap(), 42);
    }
}
