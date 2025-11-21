package v12

import (
	"math/big"
	"reflect"
	"testing"
	"time"
)

func TestData(t *testing.T) {
	r := &Data{
		// 0x000c6b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472
		FeedID:                [32]uint8{00, 12, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
		ValidFromTimestamp:    uint32(time.Now().Unix()),
		ObservationsTimestamp: uint32(time.Now().Unix()),
		NativeFee:             big.NewInt(10),
		LinkFee:               big.NewInt(10),
		ExpiresAt:             uint32(time.Now().Unix()) + 100,

		NavPerShare:     big.NewInt(1100),
		NextNavPerShare: big.NewInt(1101),
		NavDate:         uint64(time.Now().UnixNano()) - 100,
		Ripcord:         108,
	}

	b, err := schema.Pack(
		r.FeedID,
		r.ValidFromTimestamp,
		r.ObservationsTimestamp,
		r.NativeFee,
		r.LinkFee,
		r.ExpiresAt,

		r.NavPerShare,
		r.NextNavPerShare,
		r.NavDate,
		r.Ripcord,
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
