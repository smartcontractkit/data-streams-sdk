package v10

import (
	"math/big"
	"reflect"
	"testing"
	"time"
)

func TestData(t *testing.T) {
	r := &Data{
		FeedID:                [32]uint8{0, 13, 19, 169, 185, 197, 227, 122, 9, 159, 55, 78, 146, 195, 121, 20, 175, 92, 38, 143, 58, 138, 151, 33, 241, 114, 81, 53, 191, 180, 203, 184},
		ValidFromTimestamp:    uint32(time.Now().Unix()),
		ObservationsTimestamp: uint32(time.Now().Unix()),
		NativeFee:             big.NewInt(10),
		LinkFee:               big.NewInt(10),
		ExpiresAt:             uint32(time.Now().Unix()) + 100,
		LastUpdateTimestamp:   uint64(time.Now().UnixNano()) - 100,
		BestAsk:               big.NewInt(105),
		BestBid:               big.NewInt(101),
		AskVolume:             10001,
		BidVolume:             10002,
		LastTradedPrice:       big.NewInt(103),
	}

	b, err := schema.Pack(
		r.FeedID,
		r.ValidFromTimestamp,
		r.ObservationsTimestamp,
		r.NativeFee,
		r.LinkFee,
		r.ExpiresAt,
		r.LastUpdateTimestamp,
		r.BestAsk,
		r.BestBid,
		r.AskVolume,
		r.BidVolume,
		r.LastTradedPrice,
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
