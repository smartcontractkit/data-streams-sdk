package v10

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
		{Name: "lastUpdateTimestamp", Type: mustNewType("uint64")},
		{Name: "price", Type: mustNewType("int192")},
		{Name: "marketStatus", Type: mustNewType("uint32")},
		{Name: "currentMultiplier", Type: mustNewType("int192")},
		{Name: "newMultiplier", Type: mustNewType("int192")},
		{Name: "activationDateTime", Type: mustNewType("uint64")},
		{Name: "tokenizedPrice", Type: mustNewType("int192")},
	})
}

// Data is the container for this schema attributes
type Data struct {
	FeedID                feed.ID `abi:"feedId"`
	ObservationsTimestamp time.Time
	ValidFromTimestamp    time.Time
	ExpiresAt             time.Time
	LinkFee               *big.Int
	NativeFee             *big.Int
	LastUpdateTimestamp   time.Time // nanoseconds precision
	Price                 *big.Int
	MarketStatus          uint32
	CurrentMultiplier     *big.Int
	NewMultiplier         *big.Int
	ActivationDateTime    time.Time // Always seconds
	TokenizedPrice        *big.Int
}

// rawData is used internally for ABI decoding - types must match ABI schema
type rawData struct {
	FeedID                feed.ID `abi:"feedId"`
	ObservationsTimestamp uint64
	ValidFromTimestamp    uint64
	ExpiresAt             uint64
	LinkFee               *big.Int
	NativeFee             *big.Int
	LastUpdateTimestamp   uint64
	Price                 *big.Int
	MarketStatus          uint32
	CurrentMultiplier     *big.Int
	NewMultiplier         *big.Int
	ActivationDateTime    uint64
	TokenizedPrice        *big.Int
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

	res := raw.FeedID.Resolution()

	decoded := &Data{
		FeedID:                raw.FeedID,
		ValidFromTimestamp:    feed.ParseTimestamp(raw.ValidFromTimestamp, res),
		ObservationsTimestamp: feed.ParseTimestamp(raw.ObservationsTimestamp, res),
		NativeFee:             raw.NativeFee,
		LinkFee:               raw.LinkFee,
		ExpiresAt:             feed.ParseTimestamp(raw.ExpiresAt, res),
		LastUpdateTimestamp:   time.Unix(0, int64(raw.LastUpdateTimestamp)), // Always nanoseconds
		Price:                 raw.Price,
		MarketStatus:          raw.MarketStatus,
		CurrentMultiplier:     raw.CurrentMultiplier,
		NewMultiplier:         raw.NewMultiplier,
		ActivationDateTime:    time.Unix(int64(raw.ActivationDateTime), 0), // Always seconds
		TokenizedPrice:        raw.TokenizedPrice,
	}

	return decoded, nil
}
