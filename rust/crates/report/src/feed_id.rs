use hex::{FromHex, ToHex};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use thiserror::Error;

#[derive(Debug, Error, PartialEq)]
pub enum IDError {
    #[error("Missing '0x' prefix")]
    MissingPrefix,

    #[error("Invalid length for FeedID")]
    InvalidLength,

    #[error("Failed to decode FeedID")]
    DecodeError(#[from] hex::FromHexError),
}

/// Represents a 32-byte identifier.
///
/// The `ID` struct encapsulates a 32-byte array and provides methods for
/// parsing from and converting to hexadecimal strings, as well as extracting
/// the feed version from the identifier.
///
/// # Examples
///
/// ```rust
/// use data_streams_report::feed_id::ID;
///
/// let id = ID::from_hex_str("0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472").unwrap();
/// println!("ID: {}", id);
/// ```
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct ID(pub [u8; 32]);

impl ID {
    /// Parses an `ID` from a hexadecimal string with a "0x" prefix.
    ///
    /// # Arguments
    ///
    /// * `s` - A string slice that holds the hexadecimal representation of the ID.
    ///
    /// # Returns
    ///
    /// * `Ok(ID)` if parsing is successful.
    /// * `IDError` if the input string is invalid.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The string does not start with "0x" or "0X".
    /// - The string length after the prefix is not exactly 64 characters (32 bytes).
    /// - The string contains invalid hexadecimal characters.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use data_streams_report::feed_id::ID;
    ///
    /// let id = ID::from_hex_str("0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472").unwrap();
    /// ```
    pub fn from_hex_str(s: &str) -> Result<Self, IDError> {
        let s = s.trim();

        if !s.starts_with("0x") && !s.starts_with("0X") {
            return Err(IDError::MissingPrefix);
        }

        let hex_str = &s[2..];

        if hex_str.len() != 64 {
            return Err(IDError::InvalidLength);
        }

        let bytes = <[u8; 32]>::from_hex(hex_str)?;
        Ok(ID(bytes))
    }

    /// Returns the hexadecimal string representation prefixed with "0x".
    ///
    /// # Returns
    ///
    /// A `String` containing the hexadecimal representation of the `ID`, prefixed with "0x".
    ///
    /// # Examples
    ///
    /// ```rust
    /// use data_streams_report::feed_id::ID;
    ///
    /// let id = ID::from_hex_str("0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472").unwrap();
    /// let hex_string = id.to_hex_string();
    /// assert_eq!(hex_string, "0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472");
    /// ```
    pub fn to_hex_string(&self) -> String {
        format!("0x{}", self.0.encode_hex::<String>())
    }
}

impl FromStr for ID {
    type Err = IDError;

    /// Parses an `ID` from a string using `from_hex_str`.
    ///
    /// # Arguments
    ///
    /// * `s` - A string slice containing the hexadecimal representation of the `ID`.
    ///
    /// # Returns
    ///
    /// * `Ok(ID)` if parsing is successful.
    /// * `IDError` if the input string is invalid.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use data_streams_report::feed_id::ID;
    /// use std::str::FromStr;
    ///
    /// let id = ID::from_str("0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472").unwrap();
    /// ```
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        ID::from_hex_str(s)
    }
}

impl fmt::Display for ID {
    /// Formats the `ID` using its hexadecimal string representation.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use data_streams_report::feed_id::ID;
    ///
    /// let id = ID::from_hex_str("0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472").unwrap();
    /// println!("{}", id); // Outputs: 0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472
    /// ```
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.to_hex_string())
    }
}

impl fmt::Debug for ID {
    /// Formats the `ID` using its hexadecimal string representation.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use data_streams_report::feed_id::ID;
    ///
    /// let id = ID::from_hex_str("0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472").unwrap();
    /// println!("{:?}", id); // Outputs: 0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472
    /// ```
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.to_hex_string())
    }
}

impl Serialize for ID {
    /// Serializes the `ID` as a string.
    ///
    /// This method is used by Serde to serialize the `ID` into formats like JSON.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use data_streams_report::feed_id::ID;
    /// use serde_json;
    ///
    /// let id = ID::from_hex_str("0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472").unwrap();
    /// let json = serde_json::to_string(&id).unwrap();
    /// ```
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_hex_string())
    }
}

impl<'de> Deserialize<'de> for ID {
    /// Deserializes the `ID` from a string.
    ///
    /// This method is used by Serde to deserialize the `ID` from formats like JSON.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use data_streams_report::feed_id::ID;
    /// use serde_json;
    ///
    /// let json = "\"0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472\"";
    /// let id: ID = serde_json::from_str(json).unwrap();
    /// ```
    fn deserialize<D>(deserializer: D) -> Result<ID, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        ID::from_str(&s).map_err(serde::de::Error::custom)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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

    const V1_FEED_ID_STR: &str =
        "0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";
    const V2_FEED_ID_STR: &str =
        "0x00026b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";
    const V3_FEED_ID_STR: &str =
        "0x00036b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";
    const V4_FEED_ID_STR: &str =
        "0x00046b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";

    #[test]
    fn test_from_hex_str() {
        assert_eq!(ID::from_hex_str(V1_FEED_ID_STR), Ok(V1_FEED_ID));
        assert_eq!(ID::from_hex_str(V2_FEED_ID_STR), Ok(V2_FEED_ID));
        assert_eq!(ID::from_hex_str(V3_FEED_ID_STR), Ok(V3_FEED_ID));
        assert_eq!(ID::from_hex_str(V4_FEED_ID_STR), Ok(V4_FEED_ID));
    }

    #[test]
    fn test_from_str() {
        assert_eq!(ID::from_str(V1_FEED_ID_STR), Ok(V1_FEED_ID));
        assert_eq!(ID::from_str(V2_FEED_ID_STR), Ok(V2_FEED_ID));
        assert_eq!(ID::from_str(V3_FEED_ID_STR), Ok(V3_FEED_ID));
        assert_eq!(ID::from_str(V4_FEED_ID_STR), Ok(V4_FEED_ID));
    }

    #[test]
    fn test_to_hex_string() {
        assert_eq!(V1_FEED_ID.to_hex_string(), V1_FEED_ID_STR);
        assert_eq!(V2_FEED_ID.to_hex_string(), V2_FEED_ID_STR);
        assert_eq!(V3_FEED_ID.to_hex_string(), V3_FEED_ID_STR);
        assert_eq!(V4_FEED_ID.to_hex_string(), V4_FEED_ID_STR);
    }

    #[test]
    fn test_revert_if_missing_prefix() {
        let hex_str = &V1_FEED_ID_STR[2..];
        let result = ID::from_hex_str(hex_str);
        assert!(matches!(result, Err(IDError::MissingPrefix)));
    }

    #[test]
    fn test_revert_if_invalid_length() {
        let hex_str = "0x309";
        let result = ID::from_hex_str(hex_str);
        assert!(matches!(result, Err(IDError::InvalidLength)));
    }

    #[test]
    fn test_revert_if_failed_to_decode() {
        let hex_str = "0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ";
        let result = ID::from_hex_str(hex_str);
        assert!(matches!(result, Err(IDError::DecodeError(_))));
    }
}
