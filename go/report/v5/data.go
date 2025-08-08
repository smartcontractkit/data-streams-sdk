package v5

import (
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/smartcontractkit/data-streams-sdk/go/feed"
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
		{Name: "validFromTimestamp", Type: mustNewType("uint32")},
		{Name: "observationsTimestamp", Type: mustNewType("uint32")},
		{Name: "nativeFee", Type: mustNewType("uint192")},
		{Name: "linkFee", Type: mustNewType("uint192")},
		{Name: "expiresAt", Type: mustNewType("uint32")},
		{Name: "rate", Type: mustNewType("int192")},
		{Name: "timestamp", Type: mustNewType("uint32")},
		{Name: "duration", Type: mustNewType("uint32")},
	})
}

// Data is the container for this schema attributes
type Data struct {
	FeedID                feed.ID `abi:"feedId"`
	ValidFromTimestamp    uint32
	ObservationsTimestamp uint32
	NativeFee             *big.Int
	LinkFee               *big.Int
	ExpiresAt             uint32
	Rate                  *big.Int
	Timestamp             uint32
	Duration              uint32
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
	decoded := new(Data)
	if err = schema.Copy(decoded, values); err != nil {
		return nil, fmt.Errorf("failed to copy report values to struct: %w", err)
	}
	return decoded, nil
}
