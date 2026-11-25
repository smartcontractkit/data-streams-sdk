package feed

import (
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
)

// FeedVersion represents the feed report schema version
type FeedVersion uint16

const (
	_ FeedVersion = iota
	FeedVersion1
	FeedVersion2
	FeedVersion3
	FeedVersion4
	FeedVersion5
	FeedVersion6
	FeedVersion7
	FeedVersion8
	FeedVersion9
	FeedVersion10
	FeedVersion11
	FeedVersion12
	FeedVersion13
	FeedVersion14
	FeedVersion15
)

// ErrWrongSchemaVersion is returned when a report's feed ID carries a schema version
// other than the one the decoder handles.
var ErrWrongSchemaVersion = errors.New("feed ID does not match the report schema version")

// ErrUnknownResolution is returned when a report's feed ID carries an undefined timestamp resolution.
var ErrUnknownResolution = errors.New("feed ID has an undefined timestamp resolution")

// Resolution represents the timestamp resolution for a feed
type Resolution uint8

const (
	// ResolutionSeconds indicates timestamps are in seconds
	ResolutionSeconds Resolution = 0
	// ResolutionMilliseconds indicates timestamps are in milliseconds
	ResolutionMilliseconds Resolution = 1
)

func (r Resolution) String() string {
	switch r {
	case ResolutionSeconds:
		return "seconds"
	case ResolutionMilliseconds:
		return "milliseconds"
	default:
		return "undefined"
	}
}

// ID type
type ID [32]byte

// UnmarshalJSON implements json.Unmarshaler.
func (f *ID) UnmarshalJSON(b []byte) (err error) {
	if len(b) != 68 {
		return fmt.Errorf("invalid encoded FeedID: %s", string(b))
	}

	r, err := hex.DecodeString(string(b[3 : len(b)-1]))
	if err != nil {
		return fmt.Errorf("failed to decode FeedID: %w", err)
	}

	*f = *(*[32]byte)(r[:32])
	return nil
}

func (f *ID) String() (id string) {
	return "0x" + hex.EncodeToString(f[:])
}

func (f *ID) FromString(s string) (err error) {
	if len(s) != 66 {
		return fmt.Errorf("invalid encoded FeedID: %s", s)
	}

	r, err := hex.DecodeString(s[2:])
	if err != nil {
		return fmt.Errorf("failed to decode FeedID: %w", err)
	}
	*f = *(*[32]byte)(r[:32])
	return nil
}

// MarshalJSON implements json.Marshaler.
func (f *ID) MarshalJSON() (b []byte, err error) {
	b = append(b, '"')
	b = append(b, []byte(f.String())...)
	b = append(b, '"')
	return b, nil

}

// Feed identifies the report stream ID.
type Feed struct {
	FeedID ID `json:"feedID"`
}

// Version returns the feed schema version (masked to ignore resolution nibble)
func (f *ID) Version() FeedVersion {
	return FeedVersion(binary.BigEndian.Uint16(f[:2]) & 0x0FFF)
}

// Resolution returns the timestamp resolution for this feed
func (f *ID) Resolution() Resolution {
	return Resolution(f[0] >> 4)
}

// ParseTimestamp converts a raw uint64 timestamp to time.Time based on resolution.
func ParseTimestamp(ts uint64, res Resolution) time.Time {
	if res == ResolutionMilliseconds {
		return time.UnixMilli(int64(ts))
	}
	return time.Unix(int64(ts), 0)
}

// CheckVersion validates the schema version and timestamp resolution of the feed ID
// in the first word of a report blob. Schemas can share a word layout, so the layout
// alone cannot tell them apart.
func CheckVersion(report []byte, want FeedVersion) error {
	var id ID
	if len(report) < len(id) {
		return fmt.Errorf("report blob has %d bytes, too short for a feed ID", len(report))
	}
	copy(id[:], report)

	if id.Version() != want {
		return fmt.Errorf("%w: feed ID %s has version %d, want %d", ErrWrongSchemaVersion, id.String(), id.Version(), want)
	}
	if res := id.Resolution(); res != ResolutionSeconds && res != ResolutionMilliseconds {
		return fmt.Errorf("%w: feed ID %s has resolution %d", ErrUnknownResolution, id.String(), res)
	}
	return nil
}
