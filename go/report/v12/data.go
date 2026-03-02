package v12

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
	return []abi.Argument{
		{Name: "feedId", Type: mustNewType("bytes32")},
		{Name: "validFromTimestamp", Type: mustNewType("uint64")},
		{Name: "observationsTimestamp", Type: mustNewType("uint64")},
		{Name: "nativeFee", Type: mustNewType("uint192")},
		{Name: "linkFee", Type: mustNewType("uint192")},
		{Name: "expiresAt", Type: mustNewType("uint64")},

		{Name: "navPerShare", Type: mustNewType("int192")},
		{Name: "nextNavPerShare", Type: mustNewType("int192")},
		{Name: "navDate", Type: mustNewType("uint64")},
		{Name: "ripcord", Type: mustNewType("uint32")},
	}
}

// Data is the container for this schema's attributes
type Data struct {
	FeedID                feed.ID `abi:"feedId"`
	ValidFromTimestamp    time.Time
	ObservationsTimestamp time.Time
	NativeFee             *big.Int
	LinkFee               *big.Int
	ExpiresAt             time.Time

	NavPerShare     *big.Int
	NextNavPerShare *big.Int
	NavDate         time.Time // nanoseconds precision
	Ripcord         uint32
}

// rawData is used internally for ABI decoding - types must match ABI schema
type rawData struct {
	FeedID                feed.ID `abi:"feedId"`
	ValidFromTimestamp    uint64
	ObservationsTimestamp uint64
	NativeFee             *big.Int
	LinkFee               *big.Int
	ExpiresAt             uint64

	NavPerShare     *big.Int
	NextNavPerShare *big.Int
	NavDate         uint64
	Ripcord         uint32
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
		NavPerShare:           raw.NavPerShare,
		NextNavPerShare:       raw.NextNavPerShare,
		NavDate:               time.Unix(0, int64(raw.NavDate)), // Always nanoseconds
		Ripcord:               raw.Ripcord,
	}

	return decoded, nil
}
