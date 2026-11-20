package v15

import (
	"encoding/hex"
	"math/big"
	"testing"
	"time"

	"github.com/smartcontractkit/data-streams-sdk/go/v2/feed"
)

func TestData(t *testing.T) {
	// Raw values for packing
	feedID := [32]uint8{00, 15, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114}
	validFromTS := uint64(time.Now().Unix())
	observationsTS := uint64(time.Now().Unix())
	nativeFee := big.NewInt(10)
	linkFee := big.NewInt(10)
	expiresAt := uint64(time.Now().Unix()) + 100
	adaptiveRate := big.NewInt(137)
	referenceRate := big.NewInt(211)
	marketRate := big.NewInt(95)

	b, err := schema.Pack(
		feedID,
		validFromTS,
		observationsTS,
		nativeFee,
		linkFee,
		expiresAt,
		adaptiveRate,
		referenceRate,
		marketRate,
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
	if d.FeedID.Version() != feed.FeedVersion(15) {
		t.Errorf("feed version mismatch: expected 15, got %d", d.FeedID.Version())
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
	if d.AdaptiveRate.Cmp(adaptiveRate) != 0 {
		t.Errorf("AdaptiveRate mismatch: expected %v, got %v", adaptiveRate, d.AdaptiveRate)
	}
	if d.ReferenceRate.Cmp(referenceRate) != 0 {
		t.Errorf("ReferenceRate mismatch: expected %v, got %v", referenceRate, d.ReferenceRate)
	}
	if d.MarketRate.Cmp(marketRate) != 0 {
		t.Errorf("MarketRate mismatch: expected %v, got %v", marketRate, d.MarketRate)
	}
}

// goldenBlob is a fixed encoded report blob for observationsTimestamp 1700000000.
const goldenBlob = "000f000000000000000000000000000000000000000000000000000000000001" +
	"000000000000000000000000000000000000000000000000000000006553f100" +
	"000000000000000000000000000000000000000000000000000000006553f100" +
	"0000000000000000000000000000000000000000000000000000000000000000" +
	"0000000000000000000000000000000000000000000000000000000000000000" +
	"000000000000000000000000000000000000000000000000000000006553ff10" +
	"00000000000000000000000000000000000000000000000770b9f3d17e5d0000" +
	"00000000000000000000000000000000000000000000000b7726f16ccb1e0000" +
	"000000000000000000000000000000000000000000000005281fe38193088000"

func TestDecodeGolden(t *testing.T) {
	b, err := hex.DecodeString(goldenBlob)
	if err != nil {
		t.Fatal(err)
	}
	d, err := Decode(b)
	if err != nil {
		t.Fatalf("failed to deserialize golden report: %s", err)
	}
	e18 := func(s string) *big.Int {
		v, _ := new(big.Int).SetString(s, 10)
		return v
	}
	if d.FeedID.Version() != 15 {
		t.Errorf("version: expected 15, got %d", d.FeedID.Version())
	}
	if d.ObservationsTimestamp.Unix() != 1700000000 || d.ValidFromTimestamp.Unix() != 1700000000 {
		t.Errorf("timestamps: got %d / %d", d.ValidFromTimestamp.Unix(), d.ObservationsTimestamp.Unix())
	}
	if d.ExpiresAt.Unix() != 1700003600 {
		t.Errorf("ExpiresAt: expected 1700003600, got %d", d.ExpiresAt.Unix())
	}
	if d.NativeFee.Sign() != 0 || d.LinkFee.Sign() != 0 {
		t.Errorf("fees should be zero: %v %v", d.NativeFee, d.LinkFee)
	}
	if d.AdaptiveRate.Cmp(e18("137250000000000000000")) != 0 {
		t.Errorf("AdaptiveRate: got %v", d.AdaptiveRate)
	}
	if d.ReferenceRate.Cmp(e18("211500000000000000000")) != 0 {
		t.Errorf("ReferenceRate: got %v", d.ReferenceRate)
	}
	if d.MarketRate.Cmp(e18("95125000000000000000")) != 0 {
		t.Errorf("MarketRate: got %v", d.MarketRate)
	}
}

func TestDecodeRejectsShortBlob(t *testing.T) {
	b, err := hex.DecodeString(goldenBlob)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Decode(b[:8*32]); err == nil {
		t.Fatal("expected an error decoding a blob with 8 words")
	}
}
