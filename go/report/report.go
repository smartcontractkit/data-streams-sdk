package report

import (
	"fmt"

	"github.com/ethereum/go-ethereum/accounts/abi"
	v1 "github.com/smartcontractkit/data-streams-sdk/go/report/v1"
	v10 "github.com/smartcontractkit/data-streams-sdk/go/report/v10"
	v2 "github.com/smartcontractkit/data-streams-sdk/go/report/v2"
	v3 "github.com/smartcontractkit/data-streams-sdk/go/report/v3"
	v4 "github.com/smartcontractkit/data-streams-sdk/go/report/v4"
	v8 "github.com/smartcontractkit/data-streams-sdk/go/report/v8"
	v9 "github.com/smartcontractkit/data-streams-sdk/go/report/v9"
)

// Data represents the actual report data and attributes
type Data interface {
	v1.Data | v2.Data | v3.Data | v4.Data | v8.Data | v9.Data | v10.Data
	Schema() abi.Arguments
}

// Report is the full report content
type Report[T Data] struct {
	Data          T
	ReportContext [3][32]byte
	ReportBlob    []byte
	RawRs         [][32]byte
	RawSs         [][32]byte
	RawVs         [32]byte
}

// Decode decodes the report serialized bytes and its data
func Decode[T Data](fullReport []byte) (r *Report[T], err error) {
	r = &Report[T]{}
	values, err := schema.Unpack(fullReport)
	if err != nil {
		return nil, fmt.Errorf("report: failed to unpack: %s", err)
	}
	err = schema.Copy(r, values)
	if err != nil {
		return nil, fmt.Errorf("report: failed to copy: %s", err)
	}

	dataSchema := r.Data.Schema()
	dataValues, err := dataSchema.Unpack(r.ReportBlob)
	if err != nil {
		return nil, fmt.Errorf("report: failed to unpack data: %s", err)
	}

	err = dataSchema.Copy(&r.Data, dataValues)
	if err != nil {
		return nil, fmt.Errorf("report: failed to copy data: %s", err)
	}

	return r, nil
}

var schema = abi.Arguments{
	{Name: "reportContext", Type: mustNewType("bytes32[3]")},
	{Name: "reportBlob", Type: mustNewType("bytes")},
	{Name: "rawRs", Type: mustNewType("bytes32[]")},
	{Name: "rawSs", Type: mustNewType("bytes32[]")},
	{Name: "rawVs", Type: mustNewType("bytes32")},
}

func mustNewType(t string) abi.Type {
	result, err := abi.NewType(t, "", []abi.ArgumentMarshaling{})
	if err != nil {
		panic(fmt.Sprintf("Unexpected error during abi.NewType: %s", err))
	}
	return result
}
