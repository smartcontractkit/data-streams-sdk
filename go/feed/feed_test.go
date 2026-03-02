package feed

import (
	"bytes"
	"testing"
)

var (
	// Seconds Resolution FeedIDs
	v1FeedID = (ID)([32]uint8{00, 01, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114})
	v2FeedID = (ID)([32]uint8{00, 02, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114})
	v3FeedID = (ID)([32]uint8{00, 03, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114})
	v4FeedID = (ID)([32]uint8{00, 04, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114})
	// Milliseconds Resolution FeedIDs (first nibble = 1)
	v1FeedIDMillis = (ID)([32]uint8{0x10, 0x01, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114})
	v2FeedIDMillis = (ID)([32]uint8{0x10, 0x02, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114})
	v3FeedIDMillis = (ID)([32]uint8{0x10, 0x03, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114})
	v4FeedIDMillis = (ID)([32]uint8{0x10, 0x04, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114})
)

func TestFeedVersion(t *testing.T) {
	tests := []struct {
		name string
		feed ID
		want FeedVersion
	}{
		{"v1", v1FeedID, FeedVersion1},
		{"v2", v2FeedID, FeedVersion2},
		{"v3", v3FeedID, FeedVersion3},
		{"v4", v4FeedID, FeedVersion4},
		{"v1_milliseconds", v1FeedIDMillis, FeedVersion1},
		{"v2_milliseconds", v2FeedIDMillis, FeedVersion2},
		{"v3_milliseconds", v3FeedIDMillis, FeedVersion3},
		{"v4_milliseconds", v4FeedIDMillis, FeedVersion4},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.feed.Version() != tt.want {
				t.Fatalf("expected feed version: %d, got: %d", tt.want, tt.feed.Version())
			}
		})
	}
}

func TestFeedMarshalJSON(t *testing.T) {
	var b []byte
	var err error

	tests := []struct {
		name string
		feed ID
		want string
	}{
		{
			name: "v1",
			feed: v1FeedID,
			want: `"0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`,
		},
		{
			name: "v2",
			feed: v2FeedID,
			want: `"0x00026b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`,
		},
		{
			name: "v3",
			feed: v3FeedID,
			want: `"0x00036b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`,
		},
		{
			name: "v4",
			feed: v4FeedID,
			want: `"0x00046b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`,
		},
		// milliseconds resolution feedIDs
		{
			name: "v1_milliseconds",
			feed: v1FeedIDMillis,
			want: `"0x10016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`,
		},
		{
			name: "v2_milliseconds",
			feed: v2FeedIDMillis,
			want: `"0x10026b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`,
		},
		{
			name: "v3_milliseconds",
			feed: v3FeedIDMillis,
			want: `"0x10036b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`,
		},
		{
			name: "v4_milliseconds",
			feed: v4FeedIDMillis,
			want: `"0x10046b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b, err = tt.feed.MarshalJSON()
			if err != nil {
				t.Fatalf("error marshaling feed: %s", err)
			}

			if !bytes.Equal(b, []byte(tt.want)) {
				t.Fatalf("marshaling feed expected: %s, got: %s", tt.want, string(b))
			}
		})
	}
}

func TestFeedUnMarshalJSON(t *testing.T) {
	var err error

	tests := []struct {
		name string
		feed ID
		want []byte
	}{
		{
			name: "v1",
			feed: v1FeedID,
			want: []byte(`"0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`),
		},
		{
			name: "v2",
			feed: v2FeedID,
			want: []byte(`"0x00026b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`),
		},
		{
			name: "v3",
			feed: v3FeedID,
			want: []byte(`"0x00036b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`),
		},
		{
			name: "v4",
			feed: v4FeedID,
			want: []byte(`"0x00046b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`),
		},
		// milliseconds resolution feedIDs
		{
			name: "v1_milliseconds",
			feed: v1FeedIDMillis,
			want: []byte(`"0x10016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`),
		},
		{
			name: "v2_milliseconds",
			feed: v2FeedIDMillis,
			want: []byte(`"0x10026b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`),
		},
		{
			name: "v3_milliseconds",
			feed: v3FeedIDMillis,
			want: []byte(`"0x10036b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`),
		},
		{
			name: "v4_milliseconds",
			feed: v4FeedIDMillis,
			want: []byte(`"0x10046b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"`),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var id ID
			err = id.UnmarshalJSON(tt.want)
			if err != nil {
				t.Fatalf("error unmarshaling feed: %s", err)
			}

			if !bytes.Equal(id[:], tt.feed[:]) {
				t.Fatalf("unmarshaling feed expected: %s, got: %s", string(id[:]), tt.feed.String())
			}
		})
	}
}

func TestFeedResolution(t *testing.T) {
	// Test Seconds Resolution FeedIDs
	secondsFeeds := []struct {
		name       string
		feed       ID
		resolution Resolution
	}{
		{"v1", v1FeedID, ResolutionSeconds},
		{"v2", v2FeedID, ResolutionSeconds},
		{"v3", v3FeedID, ResolutionSeconds},
		{"v4", v4FeedID, ResolutionSeconds},
		{"v1_milliseconds", v1FeedIDMillis, ResolutionMilliseconds},
		{"v2_milliseconds", v2FeedIDMillis, ResolutionMilliseconds},
		{"v3_milliseconds", v3FeedIDMillis, ResolutionMilliseconds},
		{"v4_milliseconds", v4FeedIDMillis, ResolutionMilliseconds},
	}

	for _, tt := range secondsFeeds {
		t.Run(tt.name, func(t *testing.T) {
			if tt.feed.Resolution() != tt.resolution {
				t.Fatalf("expected feed resolution: %v, got: %v", tt.resolution, tt.feed.Resolution())
			}
		})
	}
}

func TestParseTimestamp(t *testing.T) {
    tests := []struct {
        name       string
        ts         uint64
        resolution Resolution
        wantUnix   int64
    }{
        {"seconds", 1700000000, ResolutionSeconds, 1700000000},
        {"milliseconds", 1700000000000, ResolutionMilliseconds, 1700000000},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := ParseTimestamp(tt.ts, tt.resolution)
            if got.Unix() != tt.wantUnix {
                t.Fatalf("ParseTimestamp() = %v, want Unix %v", got.Unix(), tt.wantUnix)
            }
        })
    }
}
