package report

import (
	"fmt"
	"math/big"
	"reflect"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"

	"github.com/smartcontractkit/data-streams-sdk/go/report/common"
	v1 "github.com/smartcontractkit/data-streams-sdk/go/report/v1"
	v10 "github.com/smartcontractkit/data-streams-sdk/go/report/v10"
	v11 "github.com/smartcontractkit/data-streams-sdk/go/report/v11"
	v12 "github.com/smartcontractkit/data-streams-sdk/go/report/v12"
	v13 "github.com/smartcontractkit/data-streams-sdk/go/report/v13"
	v2 "github.com/smartcontractkit/data-streams-sdk/go/report/v2"
	v3 "github.com/smartcontractkit/data-streams-sdk/go/report/v3"
	v4 "github.com/smartcontractkit/data-streams-sdk/go/report/v4"
	v5 "github.com/smartcontractkit/data-streams-sdk/go/report/v5"
	v6 "github.com/smartcontractkit/data-streams-sdk/go/report/v6"
	v7 "github.com/smartcontractkit/data-streams-sdk/go/report/v7"
	v8 "github.com/smartcontractkit/data-streams-sdk/go/report/v8"
	v9 "github.com/smartcontractkit/data-streams-sdk/go/report/v9"
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

	b, err = schema.Pack(v5Report.ReportContext, v5Report.ReportBlob, v5Report.RawRs, v5Report.RawSs, v5Report.RawVs)
	if err != nil {
		t.Errorf("failed to encode report: %s", err)
	}

	rv5, err := Decode[v5.Data](b)
	if err != nil {
		t.Errorf("failed to decode report: %s", err)
	}

	if !reflect.DeepEqual(v5Report, rv5) {
		t.Errorf("expected: %#v, got: %#v", v5Report, rv5)
	}

	b, err = schema.Pack(v6Report.ReportContext, v6Report.ReportBlob, v6Report.RawRs, v6Report.RawSs, v6Report.RawVs)
	if err != nil {
		t.Errorf("failed to encode report: %s", err)
	}

	rv6, err := Decode[v6.Data](b)
	if err != nil {
		t.Errorf("failed to decode report: %s", err)
	}

	if !reflect.DeepEqual(v6Report, rv6) {
		t.Errorf("expected: %#v, got: %#v", v6Report, rv6)
	}

	b, err = schema.Pack(v7Report.ReportContext, v7Report.ReportBlob, v7Report.RawRs, v7Report.RawSs, v7Report.RawVs)
	if err != nil {
		t.Errorf("failed to encode report: %s", err)
	}

	rv7, err := Decode[v7.Data](b)
	if err != nil {
		t.Errorf("failed to decode report: %s", err)
	}

	if !reflect.DeepEqual(v7Report, rv7) {
		t.Errorf("expected: %#v, got: %#v", v7Report, rv7)
	}

	b, err = schema.Pack(v8Report.ReportContext, v8Report.ReportBlob, v8Report.RawRs, v8Report.RawSs, v8Report.RawVs)
	if err != nil {
		t.Errorf("failed to encode report: %s", err)
	}

	rv8, err := Decode[v8.Data](b)
	if err != nil {
		t.Errorf("failed to decode report: %s", err)
	}

	if !reflect.DeepEqual(v8Report, rv8) {
		t.Errorf("expected: %#v, got: %#v", v8Report, rv8)
	}

	b, err = schema.Pack(v9Report.ReportContext, v9Report.ReportBlob, v9Report.RawRs, v9Report.RawSs, v9Report.RawVs)
	if err != nil {
		t.Errorf("failed to encode report: %s", err)
	}

	rv9, err := Decode[v9.Data](b)
	if err != nil {
		t.Errorf("failed to decode report: %s", err)
	}

	if !reflect.DeepEqual(v9Report, rv9) {
		t.Errorf("expected: %#v, got: %#v", v9Report, rv9)
	}

	b, err = schema.Pack(v10Report.ReportContext, v10Report.ReportBlob, v10Report.RawRs, v10Report.RawSs, v10Report.RawVs)
	if err != nil {
		t.Errorf("failed to encode report: %s", err)
	}

	rv10, err := Decode[v10.Data](b)
	if err != nil {
		t.Errorf("failed to decode report: %s", err)
	}

	if !reflect.DeepEqual(v10Report, rv10) {
		t.Errorf("expected: %#v, got: %#v", v10Report, rv10)
	}

	b, err = schema.Pack(v11Report.ReportContext, v11Report.ReportBlob, v11Report.RawRs, v11Report.RawSs, v11Report.RawVs)
	if err != nil {
		t.Errorf("failed to encode report: %s", err)
	}

	rv11, err := Decode[v11.Data](b)
	if err != nil {
		t.Errorf("failed to decode report: %s", err)
	}

	if !reflect.DeepEqual(v11Report, rv11) {
		t.Errorf("expected: %#v, got: %#v", v11Report, rv11)
	}

	b, err = schema.Pack(v12Report.ReportContext, v12Report.ReportBlob, v12Report.RawRs, v12Report.RawSs, v12Report.RawVs)
	if err != nil {
		t.Errorf("failed to encode report: %s", err)
	}

	rv12, err := Decode[v12.Data](b)
	if err != nil {
		t.Errorf("failed to decode report: %s", err)
	}

	if !reflect.DeepEqual(v12Report, rv12) {
		t.Errorf("expected: %#v, got: %#v", v12Report, rv12)
	}

	b, err = schema.Pack(v13Report.ReportContext, v13Report.ReportBlob, v13Report.RawRs, v13Report.RawSs, v13Report.RawVs)
	if err != nil {
		t.Errorf("failed to encode report: %s", err)
	}

	rv13, err := Decode[v13.Data](b)
	if err != nil {
		t.Errorf("failed to decode report: %s", err)
	}

	if !reflect.DeepEqual(v13Report, rv13) {
		t.Errorf("expected: %#v, got: %#v", v13Report, rv13)
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

var v5Report = &Report[v5.Data]{
	Data:          v5Data,
	ReportContext: [3][32]uint8{},
	ReportBlob:    mustPackData(v5Data),
	RawRs:         [][32]uint8{{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14}},
	RawSs:         [][32]uint8{{01, 02, 10, 73, 65, 19, 14, 27, 42, 48, 52, 18, 39, 116, 67, 85, 13, 82, 33, 48, 23, 33, 49, 32, 67, 50, 37, 32, 63, 77, 14, 64}},
	RawVs:         [32]uint8{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14},
}

var v6Report = &Report[v6.Data]{
	Data:          v6Data,
	ReportContext: [3][32]uint8{},
	ReportBlob:    mustPackData(v6Data),
	RawRs:         [][32]uint8{{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14}},
	RawSs:         [][32]uint8{{01, 02, 10, 73, 65, 19, 14, 27, 42, 48, 52, 18, 39, 116, 67, 85, 13, 82, 33, 48, 23, 33, 49, 32, 67, 50, 37, 32, 63, 77, 14, 64}},
	RawVs:         [32]uint8{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14},
}

var v7Report = &Report[v7.Data]{
	Data:          v7Data,
	ReportContext: [3][32]uint8{},
	ReportBlob:    mustPackData(v7Data),
	RawRs:         [][32]uint8{{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14}},
	RawSs:         [][32]uint8{{01, 02, 10, 73, 65, 19, 14, 27, 42, 48, 52, 18, 39, 116, 67, 85, 13, 82, 33, 48, 23, 33, 49, 32, 67, 50, 37, 32, 63, 77, 14, 64}},
	RawVs:         [32]uint8{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14},
}

var v8Report = &Report[v8.Data]{
	Data:          v8Data,
	ReportContext: [3][32]uint8{},
	ReportBlob:    mustPackData(v8Data),
	RawRs:         [][32]uint8{{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14}},
	RawSs:         [][32]uint8{{01, 02, 10, 73, 65, 19, 14, 27, 42, 48, 52, 18, 39, 116, 67, 85, 13, 82, 33, 48, 23, 33, 49, 32, 67, 50, 37, 32, 63, 77, 14, 64}},
	RawVs:         [32]uint8{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14},
}

var v9Report = &Report[v9.Data]{
	Data:          v9Data,
	ReportContext: [3][32]uint8{},
	ReportBlob:    mustPackData(v9Data),
	RawRs:         [][32]uint8{{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14}},
	RawSs:         [][32]uint8{{01, 02, 10, 73, 65, 19, 14, 27, 42, 48, 52, 18, 39, 116, 67, 85, 13, 82, 33, 48, 23, 33, 49, 32, 67, 50, 37, 32, 63, 77, 14, 64}},
	RawVs:         [32]uint8{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14},
}

var v10Report = &Report[v10.Data]{
	Data:          v10Data,
	ReportContext: [3][32]uint8{},
	ReportBlob:    mustPackData(v10Data),
	RawRs:         [][32]uint8{{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14}},
	RawSs:         [][32]uint8{{01, 02, 10, 73, 65, 19, 14, 27, 42, 48, 52, 18, 39, 116, 67, 85, 13, 82, 33, 48, 23, 33, 49, 32, 67, 50, 37, 32, 63, 77, 14, 64}},
	RawVs:         [32]uint8{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14},
}

var v11Report = &Report[v11.Data]{
	Data:          v11Data,
	ReportContext: [3][32]uint8{},
	ReportBlob:    mustPackData(v11Data),
	RawRs:         [][32]uint8{{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14}},
	RawSs:         [][32]uint8{{01, 02, 10, 73, 65, 19, 14, 27, 42, 48, 52, 18, 39, 116, 67, 85, 13, 82, 33, 48, 23, 33, 49, 32, 67, 50, 37, 32, 63, 77, 14, 64}},
	RawVs:         [32]uint8{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14},
}

var v12Report = &Report[v12.Data]{
	Data:          v12Data,
	ReportContext: [3][32]uint8{},
	ReportBlob:    mustPackData(v12Data),
	RawRs:         [][32]uint8{{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14}},
	RawSs:         [][32]uint8{{01, 02, 10, 73, 65, 19, 14, 27, 42, 48, 52, 18, 39, 116, 67, 85, 13, 82, 33, 48, 23, 33, 49, 32, 67, 50, 37, 32, 63, 77, 14, 64}},
	RawVs:         [32]uint8{00, 01, 10, 74, 67, 29, 24, 17, 12, 18, 22, 11, 69, 11, 63, 86, 12, 86, 23, 58, 13, 53, 29, 12, 17, 10, 17, 12, 63, 27, 12, 14},
}

var v13Report = &Report[v13.Data]{
	Data:          v13Data,
	ReportContext: [3][32]uint8{},
	ReportBlob:    mustPackData(v13Data),
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
	MarketStatus:          common.MarketStatusOpen,
}

var v5Data = v5.Data{
	FeedID:                [32]uint8{00, 5, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
	ValidFromTimestamp:    uint32(time.Now().Unix()),
	ObservationsTimestamp: uint32(time.Now().Unix()),
	NativeFee:             big.NewInt(10),
	LinkFee:               big.NewInt(10),
	ExpiresAt:             uint32(time.Now().Unix()) + 100,
	Rate:                  big.NewInt(550),
	Timestamp:             uint32(time.Now().Unix()),
	Duration:              uint32(86400),
}

var v6Data = v6.Data{
	FeedID:                [32]uint8{00, 6, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
	ValidFromTimestamp:    uint32(time.Now().Unix()),
	ObservationsTimestamp: uint32(time.Now().Unix()),
	NativeFee:             big.NewInt(10),
	LinkFee:               big.NewInt(10),
	ExpiresAt:             uint32(time.Now().Unix()) + 100,
	Price:                 big.NewInt(600),
	Price2:                big.NewInt(601),
	Price3:                big.NewInt(602),
	Price4:                big.NewInt(603),
	Price5:                big.NewInt(604),
}

var v7Data = v7.Data{
	FeedID:                [32]uint8{00, 7, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
	ValidFromTimestamp:    uint32(time.Now().Unix()),
	ObservationsTimestamp: uint32(time.Now().Unix()),
	NativeFee:             big.NewInt(10),
	LinkFee:               big.NewInt(10),
	ExpiresAt:             uint32(time.Now().Unix()) + 100,
	ExchangeRate:          big.NewInt(700),
}

var v8Data = v8.Data{
	FeedID:                [32]uint8{00, 8, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
	ValidFromTimestamp:    uint32(time.Now().Unix()),
	ObservationsTimestamp: uint32(time.Now().Unix()),
	NativeFee:             big.NewInt(10),
	LinkFee:               big.NewInt(10),
	ExpiresAt:             uint32(time.Now().Unix()) + 100,
	LastUpdateTimestamp:   uint64(time.Now().UnixNano() - int64(10*time.Second)),
	MidPrice:              big.NewInt(100),
	MarketStatus:          1,
}

var v9Data = v9.Data{
	FeedID:                [32]uint8{00, 9, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
	ValidFromTimestamp:    uint32(time.Now().Unix()),
	ObservationsTimestamp: uint32(time.Now().Unix()),
	NativeFee:             big.NewInt(10),
	LinkFee:               big.NewInt(10),
	ExpiresAt:             uint32(time.Now().Unix()) + 100,
	NavPerShare:           big.NewInt(1100),
	NavDate:               uint64(time.Now().UnixNano()) - 100,
	Aum:                   big.NewInt(11009),
	Ripcord:               108,
}

var v10Data = v10.Data{
	FeedID:                [32]uint8{00, 10, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
	ValidFromTimestamp:    uint32(time.Now().Unix()),
	ObservationsTimestamp: uint32(time.Now().Unix()),
	NativeFee:             big.NewInt(10),
	LinkFee:               big.NewInt(10),
	ExpiresAt:             uint32(time.Now().Unix()) + 100,
	LastUpdateTimestamp:   uint64(time.Now().UnixNano() - int64(10*time.Second)),
	Price:                 big.NewInt(1000),
	MarketStatus:          1,
	CurrentMultiplier:     big.NewInt(100),
	NewMultiplier:         big.NewInt(101),
	ActivationDateTime:    uint32(time.Now().Unix()) + 200,
	TokenizedPrice:        big.NewInt(1001),
}

var v11Data = v11.Data{
	FeedID:                [32]uint8{00, 11, 251, 109, 19, 88, 151, 228, 170, 245, 101, 123, 255, 211, 176, 180, 143, 142, 42, 81, 49, 33, 76, 158, 194, 214, 46, 172, 93, 83, 32, 103},
	ValidFromTimestamp:    uint32(time.Now().Unix()),
	ObservationsTimestamp: uint32(time.Now().Unix()),
	NativeFee:             big.NewInt(10),
	LinkFee:               big.NewInt(10),
	ExpiresAt:             uint32(time.Now().Unix()) + 100,
	Mid:                   big.NewInt(103),
	LastSeenTimestampNs:   uint64(time.Now().Unix()),
	Bid:                   big.NewInt(101),
	BidVolume:             10002,
	Ask:                   big.NewInt(105),
	AskVolume:             10001,
	LastTradedPrice:       big.NewInt(103),
	MarketStatus:          common.MarketStatusOpen,
}

var v12Data = v12.Data{
	FeedID:                [32]uint8{00, 12, 107, 74, 167, 229, 124, 167, 182, 138, 225, 191, 69, 101, 63, 86, 182, 86, 253, 58, 163, 53, 239, 127, 174, 105, 107, 102, 63, 27, 132, 114},
	ValidFromTimestamp:    uint32(time.Now().Unix()),
	ObservationsTimestamp: uint32(time.Now().Unix()),
	NativeFee:             big.NewInt(10),
	LinkFee:               big.NewInt(10),
	ExpiresAt:             uint32(time.Now().Unix()) + 100,
	NavPerShare:           big.NewInt(1100),
	NextNavPerShare:       big.NewInt(1101),
	NavDate:               uint64(time.Now().UnixNano()) - 100,
	Ripcord:               108,
}

var v13Data = v13.Data{
	FeedID:                [32]uint8{00, 13, 19, 169, 185, 197, 227, 122, 9, 159, 55, 78, 146, 195, 121, 20, 175, 92, 38, 143, 58, 138, 151, 33, 241, 114, 81, 53, 191, 180, 203, 184},
	ValidFromTimestamp:    uint32(time.Now().Unix()),
	ObservationsTimestamp: uint32(time.Now().Unix()),
	NativeFee:             big.NewInt(10),
	LinkFee:               big.NewInt(10),
	ExpiresAt:             uint32(time.Now().Unix()) + 100,
	BestAsk:               big.NewInt(75),
	BestBid:               big.NewInt(78),
	AskVolume:             10000,
	BidVolume:             11000,
	LastTradedPrice:       big.NewInt(76),
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
	case v5.Data:
		dataSchema = v5.Schema()
		args = []interface{}{
			v.FeedID,
			v.ValidFromTimestamp,
			v.ObservationsTimestamp,
			v.NativeFee,
			v.LinkFee,
			v.ExpiresAt,
			v.Rate,
			v.Timestamp,
			v.Duration,
		}
	case v6.Data:
		dataSchema = v6.Schema()
		args = []interface{}{
			v.FeedID,
			v.ValidFromTimestamp,
			v.ObservationsTimestamp,
			v.NativeFee,
			v.LinkFee,
			v.ExpiresAt,
			v.Price,
			v.Price2,
			v.Price3,
			v.Price4,
			v.Price5,
		}
	case v7.Data:
		dataSchema = v7.Schema()
		args = []interface{}{
			v.FeedID,
			v.ValidFromTimestamp,
			v.ObservationsTimestamp,
			v.NativeFee,
			v.LinkFee,
			v.ExpiresAt,
			v.ExchangeRate,
		}
	case v8.Data:
		dataSchema = v8.Schema()
		args = []interface{}{
			v.FeedID,
			v.ValidFromTimestamp,
			v.ObservationsTimestamp,
			v.NativeFee,
			v.LinkFee,
			v.ExpiresAt,
			v.LastUpdateTimestamp,
			v.MidPrice,
			v.MarketStatus,
		}
	case v9.Data:
		dataSchema = v9.Schema()
		args = []interface{}{
			v.FeedID,
			v.ValidFromTimestamp,
			v.ObservationsTimestamp,
			v.NativeFee,
			v.LinkFee,
			v.ExpiresAt,
			v.NavPerShare,
			v.NavDate,
			v.Aum,
			v.Ripcord,
		}
	case v10.Data:
		dataSchema = v10.Schema()
		args = []interface{}{
			v.FeedID,
			v.ValidFromTimestamp,
			v.ObservationsTimestamp,
			v.NativeFee,
			v.LinkFee,
			v.ExpiresAt,
			v.LastUpdateTimestamp,
			v.Price,
			v.MarketStatus,
			v.CurrentMultiplier,
			v.NewMultiplier,
			v.ActivationDateTime,
			v.TokenizedPrice,
		}
	case v11.Data:
		dataSchema = v11.Schema()
		args = []interface{}{
			v.FeedID,
			v.ValidFromTimestamp,
			v.ObservationsTimestamp,
			v.NativeFee,
			v.LinkFee,
			v.ExpiresAt,
			v.Mid,
			v.LastSeenTimestampNs,
			v.Bid,
			v.BidVolume,
			v.Ask,
			v.AskVolume,
			v.LastTradedPrice,
			v.MarketStatus,
		}
	case v12.Data:
		dataSchema = v12.Schema()
		args = []interface{}{
			v.FeedID,
			v.ValidFromTimestamp,
			v.ObservationsTimestamp,
			v.NativeFee,
			v.LinkFee,
			v.ExpiresAt,
			v.NavPerShare,
			v.NextNavPerShare,
			v.NavDate,
			v.Ripcord,
		}
	case v13.Data:
		dataSchema = v13.Schema()
		args = []interface{}{
			v.FeedID,
			v.ValidFromTimestamp,
			v.ObservationsTimestamp,
			v.NativeFee,
			v.LinkFee,
			v.ExpiresAt,
			v.BestAsk,
			v.BestBid,
			v.AskVolume,
			v.BidVolume,
			v.LastTradedPrice,
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
