package v14

import (
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"

	"github.com/smartcontractkit/data-streams-sdk/go/v2/feed"
)

var schema = Schema()

// expiryTimeLayout is the date layout of the expiryTime field, e.g. "2026-09-22".
const expiryTimeLayout = "2006-01-02"

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
		{Name: "expiryTime", Type: mustNewType("string")},
		{Name: "firstDayOfNotice", Type: mustNewType("uint64")},
		{Name: "lastSeenTimestampNs", Type: mustNewType("uint64")},
		{Name: "marketStatus", Type: mustNewType("uint32")},
		{Name: "contractMonth", Type: mustNewType("uint32")},
		{Name: "goldmanRollPrice", Type: mustNewType("int192")},
		{Name: "currentBusinessDay", Type: mustNewType("uint32")},
		{Name: "interpolatedGoldmanRollPrice", Type: mustNewType("int192")},
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

	MidPrice                     *big.Int
	BidPrice                     *big.Int
	AskPrice                     *big.Int
	ExpiryTime                   string    // Contract expiry date, formatted as YYYY-MM-DD, e.g. "2026-09-22"
	FirstDayOfNotice             time.Time // roll_date converted to UNIX timestamp, nanoseconds precision
	LastSeenTimestampNs          time.Time // Should reflect the timestamp of the last update from the DP, nanoseconds precision
	MarketStatus                 uint32
	ContractMonth                uint32   // The contract month, from 1 (Jan) to 12 (Dec).
	GoldmanRollPrice             *big.Int // The Goldman roll price (18 decimal precision)
	CurrentBusinessDay           uint32   // The current business day, numbered
	InterpolatedGoldmanRollPrice *big.Int // The interpolated Goldman roll price (18 decimal precision)
}

// rawData is used internally for ABI decoding - types must match ABI schema
type rawData struct {
	FeedID                feed.ID `abi:"feedId"`
	ValidFromTimestamp    uint64
	ObservationsTimestamp uint64
	NativeFee             *big.Int
	LinkFee               *big.Int
	ExpiresAt             uint64

	MidPrice                     *big.Int
	BidPrice                     *big.Int
	AskPrice                     *big.Int
	ExpiryTime                   string
	FirstDayOfNotice             uint64
	LastSeenTimestampNs          uint64
	MarketStatus                 uint32
	ContractMonth                uint32
	GoldmanRollPrice             *big.Int
	CurrentBusinessDay           uint32
	InterpolatedGoldmanRollPrice *big.Int
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

	// contractMonth must be a number from 1 (Jan) to 12 (Dec).
	if raw.ContractMonth < 1 || raw.ContractMonth > 12 {
		return nil, fmt.Errorf("invalid contractMonth %d: must be a number from 1 to 12", raw.ContractMonth)
	}

	// expiryTime must be a valid calendar date formatted as YYYY-MM-DD.
	if _, err := time.Parse(expiryTimeLayout, raw.ExpiryTime); err != nil {
		return nil, fmt.Errorf("invalid expiryTime %q: must be a date formatted as YYYY-MM-DD: %w", raw.ExpiryTime, err)
	}

	// Validate uint64 nanosecond timestamps do not overflow int64
	const maxInt64Ns = int64(^uint64(0) >> 1) // 2^63 - 1
	if raw.FirstDayOfNotice > uint64(maxInt64Ns) {
		return nil, fmt.Errorf("FirstDayOfNotice overflow: %d exceeds maximum nanosecond timestamp", raw.FirstDayOfNotice)
	}
	if raw.LastSeenTimestampNs > uint64(maxInt64Ns) {
		return nil, fmt.Errorf("LastSeenTimestampNs overflow: %d exceeds maximum nanosecond timestamp", raw.LastSeenTimestampNs)
	}

	res := raw.FeedID.Resolution()

	decoded := &Data{
		FeedID:                       raw.FeedID,
		ValidFromTimestamp:           feed.ParseTimestamp(raw.ValidFromTimestamp, res),
		ObservationsTimestamp:        feed.ParseTimestamp(raw.ObservationsTimestamp, res),
		NativeFee:                    raw.NativeFee,
		LinkFee:                      raw.LinkFee,
		ExpiresAt:                    feed.ParseTimestamp(raw.ExpiresAt, res),
		MidPrice:                     raw.MidPrice,
		BidPrice:                     raw.BidPrice,
		AskPrice:                     raw.AskPrice,
		ExpiryTime:                   raw.ExpiryTime,
		FirstDayOfNotice:             time.Unix(0, int64(raw.FirstDayOfNotice)),
		LastSeenTimestampNs:          time.Unix(0, int64(raw.LastSeenTimestampNs)),
		MarketStatus:                 raw.MarketStatus,
		ContractMonth:                raw.ContractMonth,
		GoldmanRollPrice:             raw.GoldmanRollPrice,
		CurrentBusinessDay:           raw.CurrentBusinessDay,
		InterpolatedGoldmanRollPrice: raw.InterpolatedGoldmanRollPrice,
	}

	return decoded, nil
}
