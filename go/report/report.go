package report

import (
	"fmt"

	"github.com/ethereum/go-ethereum/accounts/abi"

	v1 "github.com/smartcontractkit/data-streams-sdk/go/v2/report/v1"
	v10 "github.com/smartcontractkit/data-streams-sdk/go/v2/report/v10"
	v11 "github.com/smartcontractkit/data-streams-sdk/go/v2/report/v11"
	v12 "github.com/smartcontractkit/data-streams-sdk/go/v2/report/v12"
	v13 "github.com/smartcontractkit/data-streams-sdk/go/v2/report/v13"
	v2 "github.com/smartcontractkit/data-streams-sdk/go/v2/report/v2"
	v3 "github.com/smartcontractkit/data-streams-sdk/go/v2/report/v3"
	v4 "github.com/smartcontractkit/data-streams-sdk/go/v2/report/v4"
	v5 "github.com/smartcontractkit/data-streams-sdk/go/v2/report/v5"
	v6 "github.com/smartcontractkit/data-streams-sdk/go/v2/report/v6"
	v7 "github.com/smartcontractkit/data-streams-sdk/go/v2/report/v7"
	v8 "github.com/smartcontractkit/data-streams-sdk/go/v2/report/v8"
	v9 "github.com/smartcontractkit/data-streams-sdk/go/v2/report/v9"
)

// Data represents the actual report data and attributes
type Data interface {
	v1.Data | v2.Data | v3.Data | v4.Data | v5.Data | v6.Data | v7.Data | v8.Data | v9.Data | v10.Data | v11.Data | v12.Data | v13.Data
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

	var data any
	switch any(r.Data).(type) {
	case v1.Data:
		data, err = v1.Decode(r.ReportBlob)
	case v2.Data:
		data, err = v2.Decode(r.ReportBlob)
	case v3.Data:
		data, err = v3.Decode(r.ReportBlob)
	case v4.Data:
		data, err = v4.Decode(r.ReportBlob)
	case v5.Data:
		data, err = v5.Decode(r.ReportBlob)
	case v6.Data:
		data, err = v6.Decode(r.ReportBlob)
	case v7.Data:
		data, err = v7.Decode(r.ReportBlob)
	case v8.Data:
		data, err = v8.Decode(r.ReportBlob)
	case v9.Data:
		data, err = v9.Decode(r.ReportBlob)
	case v10.Data:
		data, err = v10.Decode(r.ReportBlob)
	case v11.Data:
		data, err = v11.Decode(r.ReportBlob)
	case v12.Data:
		data, err = v12.Decode(r.ReportBlob)
	case v13.Data:
		data, err = v13.Decode(r.ReportBlob)
	default:
		return nil, fmt.Errorf("report: unsupported data type")
	}

	if err != nil {
		return nil, fmt.Errorf("report: failed to decode data: %s", err)
	}

	// Required to return typed data as T
	if d, ok := data.(*T); ok {
		r.Data = *d
	} else {
		return nil, fmt.Errorf("report: could not cast data to T")
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
