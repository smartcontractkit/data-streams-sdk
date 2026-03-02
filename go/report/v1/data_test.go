package v1

import (
	"math/big"
	"testing"
	"time"
)

func TestData(t *testing.T) {
	// Raw values for packing
	feedID := [32]uint8{00, 01, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114}
	observationsTS := uint64(time.Now().Unix())
	benchmarkPrice := big.NewInt(100)
	bid := big.NewInt(100)
	ask := big.NewInt(100)
	currentBlockNum := uint64(100)
	currentBlockHash := [32]uint8{0, 0, 7, 4, 7, 2, 4, 1, 82, 38, 2, 9, 6, 5, 6, 8, 2, 8, 5, 5, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 1}
	validFromBlockNum := uint64(768986)
	currentBlockTS := uint64(time.Now().Unix())

	b, err := schema.Pack(
		feedID,
		observationsTS,
		benchmarkPrice,
		bid,
		ask,
		currentBlockNum,
		currentBlockHash,
		validFromBlockNum,
		currentBlockTS,
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
	if d.ObservationsTimestamp.Unix() != int64(observationsTS) {
		t.Errorf("ObservationsTimestamp mismatch: expected %d, got %d", observationsTS, d.ObservationsTimestamp.Unix())
	}
	if d.BenchmarkPrice.Cmp(benchmarkPrice) != 0 {
		t.Errorf("BenchmarkPrice mismatch: expected %v, got %v", benchmarkPrice, d.BenchmarkPrice)
	}
	if d.Bid.Cmp(bid) != 0 {
		t.Errorf("Bid mismatch: expected %v, got %v", bid, d.Bid)
	}
	if d.Ask.Cmp(ask) != 0 {
		t.Errorf("Ask mismatch: expected %v, got %v", ask, d.Ask)
	}
	if d.CurrentBlockNum != currentBlockNum {
		t.Errorf("CurrentBlockNum mismatch: expected %d, got %d", currentBlockNum, d.CurrentBlockNum)
	}
	if d.CurrentBlockHash != currentBlockHash {
		t.Errorf("CurrentBlockHash mismatch: expected %v, got %v", currentBlockHash, d.CurrentBlockHash)
	}
	if d.ValidFromBlockNum != validFromBlockNum {
		t.Errorf("ValidFromBlockNum mismatch: expected %d, got %d", validFromBlockNum, d.ValidFromBlockNum)
	}
	if d.CurrentBlockTimestamp.Unix() != int64(currentBlockTS) {
		t.Errorf("CurrentBlockTimestamp mismatch: expected %d, got %d", currentBlockTS, d.CurrentBlockTimestamp.Unix())
	}
}
