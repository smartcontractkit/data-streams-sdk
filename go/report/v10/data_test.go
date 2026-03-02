package v10

import (
	"math/big"
	"testing"
	"time"
)

func TestData(t *testing.T) {
	// Raw values for packing
	feedID := [32]uint8{00, 10, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114}
	validFromTS := uint64(time.Now().Unix())
	observationsTS := uint64(time.Now().Unix())
	nativeFee := big.NewInt(10)
	linkFee := big.NewInt(10)
	expiresAt := uint64(time.Now().Unix()) + 100
	lastUpdateTS := uint64(time.Now().UnixNano()) - 100
	price := big.NewInt(100)
	marketStatus := uint32(1)
	currentMultiplier := big.NewInt(1)
	newMultiplier := big.NewInt(2)
	activationDateTime := uint64(time.Now().Unix()) + 200
	tokenizedPrice := big.NewInt(100)

	b, err := schema.Pack(
		feedID,
		validFromTS,
		observationsTS,
		nativeFee,
		linkFee,
		expiresAt,
		lastUpdateTS,
		price,
		marketStatus,
		currentMultiplier,
		newMultiplier,
		activationDateTime,
		tokenizedPrice,
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
	if d.LastUpdateTimestamp.UnixNano() != int64(lastUpdateTS) {
		t.Errorf("LastUpdateTimestamp mismatch: expected %d, got %d", lastUpdateTS, d.LastUpdateTimestamp.UnixNano())
	}
	if d.Price.Cmp(price) != 0 {
		t.Errorf("Price mismatch: expected %v, got %v", price, d.Price)
	}
	if d.MarketStatus != marketStatus {
		t.Errorf("MarketStatus mismatch: expected %d, got %d", marketStatus, d.MarketStatus)
	}
	if d.CurrentMultiplier.Cmp(currentMultiplier) != 0 {
		t.Errorf("CurrentMultiplier mismatch: expected %v, got %v", currentMultiplier, d.CurrentMultiplier)
	}
	if d.NewMultiplier.Cmp(newMultiplier) != 0 {
		t.Errorf("NewMultiplier mismatch: expected %v, got %v", newMultiplier, d.NewMultiplier)
	}
	if d.ActivationDateTime.Unix() != int64(activationDateTime) {
		t.Errorf("ActivationDateTime mismatch: expected %d, got %d", activationDateTime, d.ActivationDateTime.Unix())
	}
	if d.TokenizedPrice.Cmp(tokenizedPrice) != 0 {
		t.Errorf("TokenizedPrice mismatch: expected %v, got %v", tokenizedPrice, d.TokenizedPrice)
	}
}
