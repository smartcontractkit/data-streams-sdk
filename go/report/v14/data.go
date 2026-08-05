package v14

import (
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"

	"github.com/smartcontractkit/data-streams-sdk/go/v2/feed"
)

var schema = Schema()

// Schema returns this data version schema
func Schema() abi.Arguments {
	mustNewType := func(t string) abi.Type {
		result, err := abi.NewType(t, "", []abi.ArgumentMarshaling{})
		if err != nil {
			panic(fmt.Sprintf("Unexpected error during abi.NewType: %s", err))
		}
		return result
	}
	return abi.Arguments([]abi.Argument{
		{Name: "feedId", Type: mustNewType("bytes32")},
		{Name: "validFromTimestamp", Type: mustNewType("uint64")},
		{Name: "observationsTimestamp", Type: mustNewType("uint64")},
		{Name: "nativeFee", Type: mustNewType("uint192")},
		{Name: "linkFee", Type: mustNewType("uint192")},
		{Name: "expiresAt", Type: mustNewType("uint64")},

		{Name: "midPrice", Type: mustNewType("int192")},
		{Name: "bidPrice", Type: mustNewType("int192")},
		{Name: "askPrice", Type: mustNewType("int192")},
		{Name: "expiryTime", Type: mustNewType("uint64")},
		{Name: "firstDayOfNotice", Type: mustNewType("uint64")},
		{Name: "lastSeenTimestampNs", Type: mustNewType("uint64")},
		{Name: "marketStatus", Type: mustNewType("uint32")},
		{Name: "contractMonth", Type: mustNewType("string")},
	})
}

// Data is the container for this schema's attributes
type Data struct {
	FeedID                feed.ID `abi:"feedId"`
	ValidFromTimestamp    time.Time
	ObservationsTimestamp time.Time
	NativeFee             *big.Int
	LinkFee               *big.Int
	ExpiresAt             time.Time

	MidPrice            *big.Int
	BidPrice            *big.Int
	AskPrice            *big.Int
	ExpiryTime          time.Time // nanoseconds precision
	FirstDayOfNotice    time.Time // roll_date converted to UNIX timestamp, nanoseconds precision
	LastSeenTimestampNs time.Time // Should reflect the timestamp of the last update from the DP, nanoseconds precision
	MarketStatus        uint32
	ContractMonth       string // A single capital letter F to Z for Jan to Dec.
}

// rawData is used internally for ABI decoding - types must match ABI schema
type rawData struct {
	FeedID                feed.ID `abi:"feedId"`
	ValidFromTimestamp    uint64
	ObservationsTimestamp uint64
	NativeFee             *big.Int
	LinkFee               *big.Int
	ExpiresAt             uint64

	MidPrice            *big.Int
	BidPrice            *big.Int
	AskPrice            *big.Int
	ExpiryTime          uint64
	FirstDayOfNotice    uint64
	LastSeenTimestampNs uint64
	MarketStatus        uint32
	ContractMonth       string
}

// Schema returns this data version schema
func (Data) Schema() abi.Arguments {
	return Schema()
}

// Decode decodes the serialized data bytes
func Decode(data []byte) (*Data, error) {
	values, err := schema.Unpack(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode report: %w", err)
	}
	raw := new(rawData)
	if err = schema.Copy(raw, values); err != nil {
		return nil, fmt.Errorf("failed to copy report values to struct: %w", err)
	}

	// contractMonth must be a single letter from F to Z (Jan to Dec).
	if len(raw.ContractMonth) != 1 || raw.ContractMonth[0] < 'F' || raw.ContractMonth[0] > 'Z' {
		return nil, fmt.Errorf("invalid contractMonth %q: must be a single letter from F to Z", raw.ContractMonth)
	}

	// Validate uint64 nanosecond timestamps do not overflow int64
	const maxInt64Ns = int64(^uint64(0) >> 1) // 2^63 - 1
	if raw.ExpiryTime > uint64(maxInt64Ns) {
		return nil, fmt.Errorf("ExpiryTime overflow: %d exceeds maximum nanosecond timestamp", raw.ExpiryTime)
	}
	if raw.FirstDayOfNotice > uint64(maxInt64Ns) {
		return nil, fmt.Errorf("FirstDayOfNotice overflow: %d exceeds maximum nanosecond timestamp", raw.FirstDayOfNotice)
	}
	if raw.LastSeenTimestampNs > uint64(maxInt64Ns) {
		return nil, fmt.Errorf("LastSeenTimestampNs overflow: %d exceeds maximum nanosecond timestamp", raw.LastSeenTimestampNs)
	}

	res := raw.FeedID.Resolution()

	decoded := &Data{
		FeedID:                raw.FeedID,
		ValidFromTimestamp:    feed.ParseTimestamp(raw.ValidFromTimestamp, res),
		ObservationsTimestamp: feed.ParseTimestamp(raw.ObservationsTimestamp, res),
		NativeFee:             raw.NativeFee,
		LinkFee:               raw.LinkFee,
		ExpiresAt:             feed.ParseTimestamp(raw.ExpiresAt, res),
		MidPrice:              raw.MidPrice,
		BidPrice:              raw.BidPrice,
		AskPrice:              raw.AskPrice,
		ExpiryTime:            time.Unix(0, int64(raw.ExpiryTime)),
		FirstDayOfNotice:      time.Unix(0, int64(raw.FirstDayOfNotice)),
		LastSeenTimestampNs:   time.Unix(0, int64(raw.LastSeenTimestampNs)),
		MarketStatus:          raw.MarketStatus,
		ContractMonth:         raw.ContractMonth,
	}

	return decoded, nil
}
