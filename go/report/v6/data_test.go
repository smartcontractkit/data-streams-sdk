package v6

import (
	"math/big"
	"testing"
	"time"
)

func TestData(t *testing.T) {
	// Raw values for packing
	feedID := [32]uint8{00, 06, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114}
	validFromTS := uint64(time.Now().Unix())
	observationsTS := uint64(time.Now().Unix())
	nativeFee := big.NewInt(10)
	linkFee := big.NewInt(10)
	expiresAt := uint64(time.Now().Unix()) + 100
	price := big.NewInt(100)
	price2 := big.NewInt(101)
	price3 := big.NewInt(102)
	price4 := big.NewInt(103)
	price5 := big.NewInt(104)

	b, err := schema.Pack(
		feedID,
		validFromTS,
		observationsTS,
		nativeFee,
		linkFee,
		expiresAt,
		price,
		price2,
		price3,
		price4,
		price5,
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
	if d.Price.Cmp(price) != 0 {
		t.Errorf("Price mismatch: expected %v, got %v", price, d.Price)
	}
	if d.Price2.Cmp(price2) != 0 {
		t.Errorf("Price2 mismatch: expected %v, got %v", price2, d.Price2)
	}
	if d.Price3.Cmp(price3) != 0 {
		t.Errorf("Price3 mismatch: expected %v, got %v", price3, d.Price3)
	}
	if d.Price4.Cmp(price4) != 0 {
		t.Errorf("Price4 mismatch: expected %v, got %v", price4, d.Price4)
	}
	if d.Price5.Cmp(price5) != 0 {
		t.Errorf("Price5 mismatch: expected %v, got %v", price5, d.Price5)
	}
}
