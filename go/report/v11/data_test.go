package v11

import (
	"math/big"
	"testing"
	"time"

	"github.com/smartcontractkit/data-streams-sdk/go/v2/report/common"
)

func TestData(t *testing.T) {
	// Raw values for packing
	feedID := [32]uint8{0, 11, 251, 109, 19, 88, 151, 228, 170, 245, 101, 123, 255, 211, 176, 180, 143, 142, 42, 81, 49, 33, 76, 158, 194, 214, 46, 172, 93, 83, 32, 103}
	validFromTS := uint64(time.Now().Unix())
	observationsTS := uint64(time.Now().Unix())
	nativeFee := big.NewInt(10)
	linkFee := big.NewInt(10)
	expiresAt := uint64(time.Now().Unix()) + 100
	mid := big.NewInt(103)
	lastSeenTimestampNs := uint64(time.Now().UnixNano())
	bid := big.NewInt(101)
	bidVolume := big.NewInt(10002)
	ask := big.NewInt(105)
	askVolume := big.NewInt(10001)
	lastTradedPrice := big.NewInt(103)
	marketStatus := common.MarketStatusOpen

	b, err := schema.Pack(
		feedID,
		validFromTS,
		observationsTS,
		nativeFee,
		linkFee,
		expiresAt,
		mid,
		lastSeenTimestampNs,
		bid,
		bidVolume,
		ask,
		askVolume,
		lastTradedPrice,
		marketStatus,
	)

	if err != nil {
		t.Fatalf("failed to serialize report: %s", err)
	}

	d, err := Decode(b)
	if err != nil {
		t.Fatalf("failed to deserialize report: %s", err)
	}

	// Verify decoded values
	if d.FeedID != feedID {
		t.Errorf("FeedID mismatch: expected %v, got %v", feedID, d.FeedID)
	}
	if d.ValidFromTimestamp.Unix() != int64(validFromTS) {
		t.Errorf("ValidFromTimestamp mismatch: expected %d, got %d", validFromTS, d.ValidFromTimestamp.Unix())
	}
	if d.ObservationsTimestamp.Unix() != int64(observationsTS) {
		t.Errorf("ObservationsTimestamp mismatch: expected %d, got %d", observationsTS, d.ObservationsTimestamp.Unix())
	}
	if d.NativeFee.Cmp(nativeFee) != 0 {
		t.Errorf("NativeFee mismatch: expected %v, got %v", nativeFee, d.NativeFee)
	}
	if d.LinkFee.Cmp(linkFee) != 0 {
		t.Errorf("LinkFee mismatch: expected %v, got %v", linkFee, d.LinkFee)
	}
	if d.ExpiresAt.Unix() != int64(expiresAt) {
		t.Errorf("ExpiresAt mismatch: expected %d, got %d", expiresAt, d.ExpiresAt.Unix())
	}
	if d.Mid.Cmp(mid) != 0 {
		t.Errorf("Mid mismatch: expected %v, got %v", mid, d.Mid)
	}
	if d.LastSeenTimestampNs.UnixNano() != int64(lastSeenTimestampNs) {
		t.Errorf("LastSeenTimestampNs mismatch: expected %d, got %d", lastSeenTimestampNs, d.LastSeenTimestampNs.UnixNano())
	}
	if d.Bid.Cmp(bid) != 0 {
		t.Errorf("Bid mismatch: expected %v, got %v", bid, d.Bid)
	}
	if d.BidVolume.Cmp(bidVolume) != 0 {
		t.Errorf("BidVolume mismatch: expected %v, got %v", bidVolume, d.BidVolume)
	}
	if d.Ask.Cmp(ask) != 0 {
		t.Errorf("Ask mismatch: expected %v, got %v", ask, d.Ask)
	}
	if d.AskVolume.Cmp(askVolume) != 0 {
		t.Errorf("AskVolume mismatch: expected %v, got %v", askVolume, d.AskVolume)
	}
	if d.LastTradedPrice.Cmp(lastTradedPrice) != 0 {
		t.Errorf("LastTradedPrice mismatch: expected %v, got %v", lastTradedPrice, d.LastTradedPrice)
	}
	if d.MarketStatus != marketStatus {
		t.Errorf("MarketStatus mismatch: expected %d, got %d", marketStatus, d.MarketStatus)
	}
}
