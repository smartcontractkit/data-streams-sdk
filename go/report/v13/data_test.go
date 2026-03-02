package v13

import (
	"math/big"
	"testing"
	"time"
)

func TestData(t *testing.T) {
	// Raw values for packing
	feedID := [32]uint8{0, 13, 251, 109, 19, 88, 151, 228, 170, 245, 101, 123, 255, 211, 176, 180, 143, 142, 42, 81, 49, 33, 76, 158, 194, 214, 46, 172, 93, 83, 32, 103}
	validFromTS := uint64(time.Now().Unix())
	observationsTS := uint64(time.Now().Unix())
	nativeFee := big.NewInt(10)
	linkFee := big.NewInt(10)
	expiresAt := uint64(time.Now().Unix()) + 100
	bestAsk := big.NewInt(105)
	bestBid := big.NewInt(100)
	askVolume := uint64(1000)
	bidVolume := uint64(2000)
	lastTradedPrice := big.NewInt(103)

	b, err := schema.Pack(
		feedID,
		validFromTS,
		observationsTS,
		nativeFee,
		linkFee,
		expiresAt,
		bestAsk,
		bestBid,
		askVolume,
		bidVolume,
		lastTradedPrice,
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
	if d.BestAsk.Cmp(bestAsk) != 0 {
		t.Errorf("BestAsk mismatch: expected %v, got %v", bestAsk, d.BestAsk)
	}
	if d.BestBid.Cmp(bestBid) != 0 {
		t.Errorf("BestBid mismatch: expected %v, got %v", bestBid, d.BestBid)
	}
	if d.AskVolume != askVolume {
		t.Errorf("AskVolume mismatch: expected %d, got %d", askVolume, d.AskVolume)
	}
	if d.BidVolume != bidVolume {
		t.Errorf("BidVolume mismatch: expected %d, got %d", bidVolume, d.BidVolume)
	}
	if d.LastTradedPrice.Cmp(lastTradedPrice) != 0 {
		t.Errorf("LastTradedPrice mismatch: expected %v, got %v", lastTradedPrice, d.LastTradedPrice)
	}
}
