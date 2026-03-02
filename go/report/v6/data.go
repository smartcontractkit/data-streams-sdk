package v6

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
		{Name: "price", Type: mustNewType("int192")},
		{Name: "price2", Type: mustNewType("int192")},
		{Name: "price3", Type: mustNewType("int192")},
		{Name: "price4", Type: mustNewType("int192")},
		{Name: "price5", Type: mustNewType("int192")},
	})
}

// Data is the container for this schema attributes
type Data struct {
	FeedID                feed.ID `abi:"feedId"`
	ValidFromTimestamp    time.Time
	ObservationsTimestamp time.Time
	NativeFee             *big.Int
	LinkFee               *big.Int
	ExpiresAt             time.Time
	Price                 *big.Int
	Price2                *big.Int
	Price3                *big.Int
	Price4                *big.Int
	Price5                *big.Int
}

// rawData is used internally for ABI decoding - types must match ABI schema
type rawData struct {
	FeedID                feed.ID `abi:"feedId"`
	ValidFromTimestamp    uint64
	ObservationsTimestamp uint64
	NativeFee             *big.Int
	LinkFee               *big.Int
	ExpiresAt             uint64
	Price                 *big.Int
	Price2                *big.Int
	Price3                *big.Int
	Price4                *big.Int
	Price5                *big.Int
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
		Price:                 raw.Price,
		Price2:                raw.Price2,
		Price3:                raw.Price3,
		Price4:                raw.Price4,
		Price5:                raw.Price5,
	}

	return decoded, nil
}
