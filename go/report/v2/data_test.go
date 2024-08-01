package v2

import (
	"math/big"
	"reflect"
	"testing"
	"time"
)

func TestData(t *testing.T) {
	r := &Data{
		FeedID:                [32]uint8{00, 02, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
		ObservationsTimestamp: uint32(time.Now().Unix()),
		BenchmarkPrice:        big.NewInt(100),
		ValidFromTimestamp:    uint32(time.Now().Unix()),
		ExpiresAt:             uint32(time.Now().Unix()) + 100,
		LinkFee:               big.NewInt(10),
		NativeFee:             big.NewInt(10),
	}

	b, err := schema.Pack(
		r.FeedID,
		r.ValidFromTimestamp,
		r.ObservationsTimestamp,
		r.NativeFee,
		r.LinkFee,
		r.ExpiresAt,
		r.BenchmarkPrice,
	)

	if err != nil {
		t.Errorf("failed to serialize report: %s", err)
	}

	d, err := Decode(b)
	if err != nil {
		t.Errorf("failed to deserialize report: %s", err)
	}

	if !reflect.DeepEqual(r, d) {
		t.Errorf("expected: %#v, got %#v", r, d)
	}
}
