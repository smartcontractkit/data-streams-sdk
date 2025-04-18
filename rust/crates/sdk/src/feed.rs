use chainlink_data_streams_report::feed_id::ID;

use byteorder::{BigEndian, ByteOrder};
use serde::{Deserialize, Serialize};

/// Represents the feed report schema version.
///
/// The `FeedVersion` struct wraps a `u16` integer representing the version of the feed report schema.
///
/// # Examples
///
/// ```rust
/// use chainlink_data_streams_sdk::feed::FeedVersion;
///
/// let version = FeedVersion(1);
/// println!("Feed version: {}", version.0);
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FeedVersion(pub u16);

/// Represents a feed that identifies the report stream ID.
///
/// The `Feed` struct contains a `feed_id` field, which is an `ID` representing
/// the unique identifier of the feed.
///
/// # Examples
///
/// ```rust
/// use chainlink_data_streams_sdk::feed::Feed;
/// use chainlink_data_streams_report::feed_id::ID;
///
/// let id = ID::from_hex_str("0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472").unwrap();
/// let feed = Feed { feed_id: id };
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Feed {
    /// The unique identifier of the feed.
    #[serde(rename = "feedID")]
    pub feed_id: ID,
}

impl Feed {
    /// Returns the feed version extracted from the first two bytes of the `ID`.
    ///
    /// # Returns
    ///
    /// A `FeedVersion` representing the version number.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use chainlink_data_streams_report::feed_id::ID;
    /// use chainlink_data_streams_sdk::feed::{Feed, FeedVersion};
    ///
    /// let feed_id = ID::from_hex_str("0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472").unwrap();
    /// let feed = Feed { feed_id };
    /// let version = feed.version();
    /// assert_eq!(version, FeedVersion(1));
    /// ```
    pub fn version(&self) -> FeedVersion {
        let version = BigEndian::read_u16(&self.feed_id.0[0..2]);
        FeedVersion(version)
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
    fn test_feed_version() {
        let feed_v1 = Feed {
            feed_id: V1_FEED_ID,
        };
        let feed_v2 = Feed {
            feed_id: V2_FEED_ID,
        };
        let feed_v3 = Feed {
            feed_id: V3_FEED_ID,
        };
        let feed_v4 = Feed {
            feed_id: V4_FEED_ID,
        };

        assert_eq!(feed_v1.version(), FeedVersion(1));
        assert_eq!(feed_v2.version(), FeedVersion(2));
        assert_eq!(feed_v3.version(), FeedVersion(3));
        assert_eq!(feed_v4.version(), FeedVersion(4));
    }

    #[test]
    fn test_serialize() {
        let feeds = vec![
            (V1_FEED_ID, V1_FEED_ID_STR),
            (V2_FEED_ID, V2_FEED_ID_STR),
            (V3_FEED_ID, V3_FEED_ID_STR),
            (V4_FEED_ID, V4_FEED_ID_STR),
        ];

        for (feed_id, expected_str) in feeds {
            let feed = Feed { feed_id };
            let got = serde_json::to_string(&feed).unwrap();
            let want = format!("{{\"feedID\":\"{}\"}}", expected_str);

            assert_eq!(got, want);
        }
    }

    #[test]
    fn test_deserialize() {
        let feeds = vec![
            (V1_FEED_ID, V1_FEED_ID_STR),
            (V2_FEED_ID, V2_FEED_ID_STR),
            (V3_FEED_ID, V3_FEED_ID_STR),
            (V4_FEED_ID, V4_FEED_ID_STR),
        ];

        for (feed_id, expected_str) in feeds {
            let json = format!("{{\"feedID\":\"{}\"}}", expected_str);

            let got: Feed = serde_json::from_str(&json).unwrap();
            let want = Feed { feed_id };

            assert_eq!(got, want);
        }
    }
}
