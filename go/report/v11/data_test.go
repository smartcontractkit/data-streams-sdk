package v11

import (
	"math/big"
	"reflect"
	"testing"
	"time"

	"github.com/smartcontractkit/data-streams-sdk/go/report/common"
)

func TestData(t *testing.T) {
	r := &Data{
		// 0x000bfb6d135897e4aaf5657bffd3b0b48f8e2a5131214c9ec2d62eac5d532067
		FeedID:                [32]uint8{0, 11, 251, 109, 19, 88, 151, 228, 170, 245, 101, 123, 255, 211, 176, 180, 143, 142, 42, 81, 49, 33, 76, 158, 194, 214, 46, 172, 93, 83, 32, 103},
		ValidFromTimestamp:    uint32(time.Now().Unix()),
		ObservationsTimestamp: uint32(time.Now().Unix()),
		NativeFee:             big.NewInt(10),
		LinkFee:               big.NewInt(10),
		ExpiresAt:             uint32(time.Now().Unix()) + 100,

		Mid:                 big.NewInt(103),
		LastSeenTimestampNs: uint64(time.Now().Unix()),
		Bid:                 big.NewInt(101),
		BidVolume:           10002,
		Ask:                 big.NewInt(105),
		AskVolume:           10001,
		LastTradedPrice:     big.NewInt(103),
		MarketStatus:        common.MarketStatusOpen,
	}

	b, err := schema.Pack(
		r.FeedID,
		r.ValidFromTimestamp,
		r.ObservationsTimestamp,
		r.NativeFee,
		r.LinkFee,
		r.ExpiresAt,
		r.Mid,
		r.LastSeenTimestampNs,
		r.Bid,
		r.BidVolume,
		r.Ask,
		r.AskVolume,
		r.LastTradedPrice,
		r.MarketStatus,
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
