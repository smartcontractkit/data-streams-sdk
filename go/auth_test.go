package streams

import (
	"net/http"
	"reflect"
	"testing"
)

func Test_generateHMAC(t *testing.T) {
	type args struct {
		method     string
		path       string
		body       []byte
		clientId   string
		timestamp  int64
		userSecret string
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "valid1",
			want: "e9b2aa1deb13b2abd078353a5e335b2f50307159ad28b433157d2c74dbab2072",
			args: args{
				method:     http.MethodGet,
				path:       apiV1Feeds,
				clientId:   "clientId",
				userSecret: "userSecret",
				timestamp:  1718885772,
			},
		},
		{
			name: "valid2",
			want: "31b48ebdb13802b58978cd89eca0c3c68ddccf85392e703b55942544e7203d3d",
			args: args{
				method:     http.MethodPost,
				path:       apiV1Feeds,
				clientId:   "clientId1",
				userSecret: "secret1",
				timestamp:  12000,
			},
		},
		{
			name: "valid3",
			want: "37190febe20b6f3662f6abbfa3a7085ad705ac64e88bde8c1a01a635859e6cf7",
			args: args{
				method:     http.MethodPost,
				path:       apiV1ReportsBulk,
				clientId:   "clientId2",
				userSecret: "secret2",
				timestamp:  1718885772,
				body:       []byte(`{"attr1": "value1","attr2": [1,2,3]}`),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := generateHMAC(tt.args.method, tt.args.path, tt.args.body, tt.args.clientId, tt.args.timestamp, tt.args.userSecret); got != tt.want {
				t.Errorf("generateHMAC() = %v, want %v", got, tt.want)
			}
		})
	}
}

func Test_generateAuthHeaders(t *testing.T) {
	type args struct {
		method     string
		path       string
		body       []byte
		clientId   string
		userSecret string
		timestamp  int64
	}
	tests := []struct {
		name string
		args args
		want http.Header
	}{
		{
			name: "valid1",
			want: http.Header{
				authzHeader:    {"authzHeader"},
				authzTSHeader:  {"1718885772"},
				authzSigHeader: {"53373f7564f6c53905a3943ef3f3491709fac1b864a2991b63d0d3048b47317c"},
			},
			args: args{
				method:     http.MethodGet,
				path:       apiV1Feeds,
				clientId:   "authzHeader",
				userSecret: "userSecret",
				timestamp:  1718885772,
			},
		},
		{
			name: "valid2",
			want: http.Header{
				authzHeader:    {"authzHeader"},
				authzTSHeader:  {"12000"},
				authzSigHeader: {"4bb71f74be80aba504107893b90324858bea82189c600e336e219702c15f2660"},
			},
			args: args{
				method:     http.MethodPost,
				path:       apiV1Feeds,
				clientId:   "authzHeader",
				userSecret: "userSecret",
				timestamp:  12000,
			},
		},
		{
			name: "valid3",
			want: http.Header{
				authzHeader:    {"authzHeader"},
				authzTSHeader:  {"1718885772"},
				authzSigHeader: {"adfdba180f94d4e1445f08e7a65d3c3cc34d9885aa67527a68789661147897ed"},
			},
			args: args{
				method:     http.MethodPost,
				path:       apiV1ReportsBulk,
				clientId:   "authzHeader",
				userSecret: "userSecret",
				timestamp:  1718885772,
				body:       []byte(`{"attr1": "value1","attr2": [1,2,3]}`),
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {

			got := http.Header{}
			generateAuthHeaders(got, tt.args.method, tt.args.path, tt.args.body, tt.args.clientId, tt.args.userSecret, tt.args.timestamp)
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("generateAuthHeaders() = %v, want %v", got, tt.want)
			}
		})
	}
}
