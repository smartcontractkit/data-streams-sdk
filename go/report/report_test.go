package report

import (
	"fmt"
	"math/big"
	"reflect"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	v1 "github.com/smartcontractkit/data-streams-sdk/go/report/v1"
	v2 "github.com/smartcontractkit/data-streams-sdk/go/report/v2"
	v3 "github.com/smartcontractkit/data-streams-sdk/go/report/v3"
	v4 "github.com/smartcontractkit/data-streams-sdk/go/report/v4"
)

func TestReport(t *testing.T) {
	b, err := schema.Pack(v1Report.ReportContext, v1Report.ReportBlob, v1Report.RawRs, v1Report.RawSs, v1Report.RawVs)
	if err != nil {
		t.Errorf("failed to encode report: %s", err)
	}

	rv1, err := Decode[v1.Data](b)
	if err != nil {
		t.Errorf("failed to decode report: %s", err)
	}

	if !reflect.DeepEqual(v1Report, rv1) {
		t.Errorf("expected: %#v, got: %#v", v1Report, rv1)
	}

	b, err = schema.Pack(v2Report.ReportContext, v2Report.ReportBlob, v2Report.RawRs, v2Report.RawSs, v2Report.RawVs)
	if err != nil {
		t.Errorf("failed to encode report: %s", err)
	}

	rv2, err := Decode[v2.Data](b)
	if err != nil {
		t.Errorf("failed to decode report: %s", err)
	}

	if !reflect.DeepEqual(v2Report, rv2) {
		t.Errorf("expected: %#v, got: %#v", v2Report, rv2)
	}

	b, err = schema.Pack(v3Report.ReportContext, v3Report.ReportBlob, v3Report.RawRs, v3Report.RawSs, v3Report.RawVs)
	if err != nil {
		t.Errorf("failed to encode report: %s", err)
	}

	rv3, err := Decode[v3.Data](b)
	if err != nil {
		t.Errorf("failed to decode report: %s", err)
	}

	if !reflect.DeepEqual(v3Report, rv3) {
		t.Errorf("expected: %#v, got: %#v", v3Report, rv3)
	}

	b, err = schema.Pack(v4Report.ReportContext, v4Report.ReportBlob, v4Report.RawRs, v4Report.RawSs, v4Report.RawVs)
	if err != nil {
		t.Errorf("failed to encode report: %s", err)
	}

	rv4, err := Decode[v4.Data](b)
	if err != nil {
		t.Errorf("failed to decode report: %s", err)
	}

	if !reflect.DeepEqual(v4Report, rv4) {
		t.Errorf("expected: %#v, got: %#v", v4Report, rv4)
	}
}

var v1Report = &Report[v1.Data]{
	Data:          v1Data,
	ReportContext: [3][32]uint8{},
	ReportBlob:    mustPackData(v1Data),
	RawRs:         [][32]uint8{{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14}},
	RawSs:         [][32]uint8{{01, 02, 10, 73, 65, 19, 14, 27, 42, 48, 52, 18, 39, 116, 67, 85, 13, 82, 33, 48, 23, 33, 49, 32, 67, 50, 37, 32, 63, 77, 14, 64}},
	RawVs:         [32]uint8{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14},
}

var v2Report = &Report[v2.Data]{
	Data:          v2Data,
	ReportContext: [3][32]uint8{},
	ReportBlob:    mustPackData(v2Data),
	RawRs:         [][32]uint8{{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14}},
	RawSs:         [][32]uint8{{01, 02, 10, 73, 65, 19, 14, 27, 42, 48, 52, 18, 39, 116, 67, 85, 13, 82, 33, 48, 23, 33, 49, 32, 67, 50, 37, 32, 63, 77, 14, 64}},
	RawVs:         [32]uint8{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14},
}

var v3Report = &Report[v3.Data]{
	Data:          v3Data,
	ReportContext: [3][32]uint8{},
	ReportBlob:    mustPackData(v3Data),
	RawRs:         [][32]uint8{{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14}},
	RawSs:         [][32]uint8{{01, 02, 10, 73, 65, 19, 14, 27, 42, 48, 52, 18, 39, 116, 67, 85, 13, 82, 33, 48, 23, 33, 49, 32, 67, 50, 37, 32, 63, 77, 14, 64}},
	RawVs:         [32]uint8{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14},
}

var v4Report = &Report[v4.Data]{
	Data:          v4Data,
	ReportContext: [3][32]uint8{},
	ReportBlob:    mustPackData(v4Data),
	RawRs:         [][32]uint8{{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14}},
	RawSs:         [][32]uint8{{01, 02, 10, 73, 65, 19, 14, 27, 42, 48, 52, 18, 39, 116, 67, 85, 13, 82, 33, 48, 23, 33, 49, 32, 67, 50, 37, 32, 63, 77, 14, 64}},
	RawVs:         [32]uint8{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14},
}

var v1Data = v1.Data{
	FeedID:                [32]uint8{00, 01, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
	ObservationsTimestamp: uint32(time.Now().Unix()),
	BenchmarkPrice:        big.NewInt(100),
	Bid:                   big.NewInt(100),
	Ask:                   big.NewInt(100),
	CurrentBlockNum:       100,
	CurrentBlockHash:      [32]uint8{0, 0, 7, 4, 7, 2, 4, 1, 82, 38, 2, 9, 6, 5, 6, 8, 2, 8, 5, 5, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 1},
	ValidFromBlockNum:     768986,
	CurrentBlockTimestamp: uint64(time.Now().Unix()),
}

var v2Data = v2.Data{
	FeedID:                [32]uint8{00, 02, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
	ObservationsTimestamp: uint32(time.Now().Unix()),
	BenchmarkPrice:        big.NewInt(100),
	ValidFromTimestamp:    uint32(time.Now().Unix()),
	ExpiresAt:             uint32(time.Now().Unix()) + 100,
	LinkFee:               big.NewInt(10),
	NativeFee:             big.NewInt(10),
}

var v3Data = v3.Data{
	FeedID:                [32]uint8{00, 03, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
	ValidFromTimestamp:    uint32(time.Now().Unix()),
	ObservationsTimestamp: uint32(time.Now().Unix()),
	NativeFee:             big.NewInt(10),
	LinkFee:               big.NewInt(10),
	ExpiresAt:             uint32(time.Now().Unix()) + 100,
	BenchmarkPrice:        big.NewInt(100),
	Bid:                   big.NewInt(100),
	Ask:                   big.NewInt(100),
}

var v4Data = v4.Data{
	FeedID:                [32]uint8{00, 04, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
	ValidFromTimestamp:    uint32(time.Now().Unix()),
	ObservationsTimestamp: uint32(time.Now().Unix()),
	NativeFee:             big.NewInt(10),
	LinkFee:               big.NewInt(10),
	ExpiresAt:             uint32(time.Now().Unix()) + 100,
	BenchmarkPrice:        big.NewInt(100),
	MarketStatus:          v4.MarketStatusOpen,
}

func mustPackData(d interface{}) []byte {
	var args []interface{}
	var dataSchema abi.Arguments

	switch v := d.(type) {
	case v1.Data:
		dataSchema = v1.Schema()
		args = []interface{}{
			v.FeedID,
			v.ObservationsTimestamp,
			v.BenchmarkPrice,
			v.Bid,
			v.Ask,
			v.CurrentBlockNum,
			v.CurrentBlockHash,
			v.ValidFromBlockNum,
			v.CurrentBlockTimestamp,
		}
	case v2.Data:
		dataSchema = v2.Schema()
		args = []interface{}{
			v.FeedID,
			v.ValidFromTimestamp,
			v.ObservationsTimestamp,
			v.NativeFee,
			v.LinkFee,
			v.ExpiresAt,
			v.BenchmarkPrice,
		}
	case v3.Data:
		dataSchema = v3.Schema()
		args = []interface{}{
			v.FeedID,
			v.ValidFromTimestamp,
			v.ObservationsTimestamp,
			v.NativeFee,
			v.LinkFee,
			v.ExpiresAt,
			v.BenchmarkPrice,
			v.Bid,
			v.Ask,
		}
	case v4.Data:
		dataSchema = v4.Schema()
		args = []interface{}{
			v.FeedID,
			v.ValidFromTimestamp,
			v.ObservationsTimestamp,
			v.NativeFee,
			v.LinkFee,
			v.ExpiresAt,
			v.BenchmarkPrice,
			v.MarketStatus,
		}
	default:
		panic(fmt.Sprintf("invalid type to pack: %#v", v))
	}

	b, err := dataSchema.PackValues(args)
	if err != nil {
		panic(fmt.Sprintf("failed to pack: %s", err))
	}

	return b
}
