package v1

import (
	"math/big"
	"reflect"
	"testing"
	"time"
)

func TestData(t *testing.T) {
	r := &Data{
		FeedID:                [32]uint8{00, 01, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
		ObservationsTimestamp: uint32(time.Now().Unix()),
		BenchmarkPrice:        big.NewInt(100),
		Bid:                   big.NewInt(100),
		Ask:                   big.NewInt(100),
		CurrentBlockNum:       100,
		CurrentBlockHash:      [32]uint8{0, 0, 7, 4, 7, 2, 4, 1, 82, 38, 2, 9, 6, 5, 6, 8, 2, 8, 5, 5, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 1},
		ValidFromBlockNum:     768986,
		CurrentBlockTimestamp: uint64(time.Now().Unix()),
	}

	b, err := schema.Pack(
		r.FeedID,
		r.ObservationsTimestamp,
		r.BenchmarkPrice,
		r.Bid,
		r.Ask,
		r.CurrentBlockNum,
		r.CurrentBlockHash,
		r.ValidFromBlockNum,
		r.CurrentBlockTimestamp,
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
