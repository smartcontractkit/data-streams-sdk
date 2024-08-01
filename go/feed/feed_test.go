package feed

import (
	"bytes"
	"testing"
)

var (
	v1FeedID = (ID)([32]uint8{00, 01, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114})
	v2FeedID = (ID)([32]uint8{00, 02, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114})
	v3FeedID = (ID)([32]uint8{00, 03, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114})
)

func TestFeedVersion(t *testing.T) {
	if v1FeedID.Version() != FeedVersion1 {
		t.Fatalf("expected feed version: %d, got: %d", FeedVersion1, v1FeedID.Version())
	}

	if v2FeedID.Version() != FeedVersion2 {
		t.Fatalf("expected feed version: %d, got: %d", FeedVersion2, v2FeedID.Version())
	}

	if v3FeedID.Version() != FeedVersion3 {
		t.Fatalf("expected feed version: %d, got: %d", FeedVersion3, v3FeedID.Version())
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
