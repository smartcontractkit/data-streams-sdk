package v6

import (
	"math/big"
	"reflect"
	"testing"
	"time"
)

func TestData(t *testing.T) {
	r := &Data{
		FeedID:                [32]uint8{00, 06, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
		ValidFromTimestamp:    uint32(time.Now().Unix()),
		ObservationsTimestamp: uint32(time.Now().Unix()),
		NativeFee:             big.NewInt(10),
		LinkFee:               big.NewInt(10),
		ExpiresAt:             uint32(time.Now().Unix()) + 100,
		Price:                 big.NewInt(100),
		Price2:                big.NewInt(110),
		Price3:                big.NewInt(120),
		Price4:                big.NewInt(130),
		Price5:                big.NewInt(140),
	}

	b, err := schema.Pack(
		r.FeedID,
		r.ValidFromTimestamp,
		r.ObservationsTimestamp,
		r.NativeFee,
		r.LinkFee,
		r.ExpiresAt,
		r.Price,
		r.Price2,
		r.Price3,
		r.Price4,
		r.Price5,
	)
	if err != nil {
		t.Errorf("failed to serialize report: %s", err)
	}

	// Test data decoding
	decoded, err := Decode(b)
	if err != nil {
		t.Errorf("failed to deserialize report: %s", err)
	}

	if !reflect.DeepEqual(r, decoded) {
		t.Errorf("expected: %#v, got %#v", r, decoded)
	}
}
