package v14

import (
	"math/big"
	"testing"
	"time"
)

func TestData(t *testing.T) {
	// Raw values for packing
	feedID := [32]uint8{00, 14, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114}
	validFromTS := uint64(time.Now().Unix())
	observationsTS := uint64(time.Now().Unix())
	nativeFee := big.NewInt(10)
	linkFee := big.NewInt(10)
	expiresAt := uint64(time.Now().Unix()) + 100
	midPrice := big.NewInt(100)
	bidPrice := big.NewInt(99)
	askPrice := big.NewInt(101)
	expiryTime := uint64(time.Now().UnixNano()) + 100
	firstDayOfNotice := uint64(time.Now().UnixNano()) + 50
	lastSeenTimestampNs := uint64(time.Now().UnixNano()) - 100
	marketStatus := uint32(1)
	contractMonth := "N"

	b, err := schema.Pack(
		feedID,
		validFromTS,
		observationsTS,
		nativeFee,
		linkFee,
		expiresAt,
		midPrice,
		bidPrice,
		askPrice,
		expiryTime,
		firstDayOfNotice,
		lastSeenTimestampNs,
		marketStatus,
		contractMonth,
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
	if d.MidPrice.Cmp(midPrice) != 0 {
		t.Errorf("MidPrice mismatch: expected %v, got %v", midPrice, d.MidPrice)
	}
	if d.BidPrice.Cmp(bidPrice) != 0 {
		t.Errorf("BidPrice mismatch: expected %v, got %v", bidPrice, d.BidPrice)
	}
	if d.AskPrice.Cmp(askPrice) != 0 {
		t.Errorf("AskPrice mismatch: expected %v, got %v", askPrice, d.AskPrice)
	}
	if d.ExpiryTime.UnixNano() != int64(expiryTime) {
		t.Errorf("ExpiryTime mismatch: expected %d, got %d", expiryTime, d.ExpiryTime.UnixNano())
	}
	if d.FirstDayOfNotice.UnixNano() != int64(firstDayOfNotice) {
		t.Errorf("FirstDayOfNotice mismatch: expected %d, got %d", firstDayOfNotice, d.FirstDayOfNotice.UnixNano())
	}
	if d.LastSeenTimestampNs.UnixNano() != int64(lastSeenTimestampNs) {
		t.Errorf("LastSeenTimestampNs mismatch: expected %d, got %d", lastSeenTimestampNs, d.LastSeenTimestampNs.UnixNano())
	}
	if d.MarketStatus != marketStatus {
		t.Errorf("MarketStatus mismatch: expected %d, got %d", marketStatus, d.MarketStatus)
	}
	if d.ContractMonth != contractMonth {
		t.Errorf("ContractMonth mismatch: expected %s, got %s", contractMonth, d.ContractMonth)
	}
}

func TestDecodeInvalidContractMonth(t *testing.T) {
	feedID := [32]uint8{00, 14, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114}

	// Values that are outside the valid single-letter F..Z range must be rejected.
	for _, cm := range []string{"", "A", "E", "AB", "n", "1"} {
		b, err := schema.Pack(
			feedID,
			uint64(time.Now().Unix()),
			uint64(time.Now().Unix()),
			big.NewInt(10),
			big.NewInt(10),
			uint64(time.Now().Unix())+100,
			big.NewInt(100),
			big.NewInt(99),
			big.NewInt(101),
			uint64(time.Now().UnixNano()),
			uint64(time.Now().UnixNano()),
			uint64(time.Now().UnixNano()),
			uint32(1),
			cm,
		)
		if err != nil {
			t.Fatalf("failed to serialize report: %s", err)
		}

		if _, err := Decode(b); err == nil {
			t.Errorf("expected error decoding contractMonth %q, got nil", cm)
		}
	}
}
