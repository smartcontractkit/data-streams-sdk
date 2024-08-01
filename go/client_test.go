package streams

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strconv"
	"testing"

	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/smartcontractkit/data-streams-sdk/go/feed"
)

func mustFeedIDfromString(s string) (f feed.ID) {
	err := f.FromString(s)
	if err != nil {
		panic(fmt.Errorf("failed to parse FeedID: %s", err))
	}
	return f
}

var (
	feed1str = "0x00020ffa644e6c585a5bec0e25ca476b6666666666e22b6240957720dcba0e14"
	feed1    = mustFeedIDfromString(feed1str)
	feed2str = "0x00020ffa644e6c585a88888825ca476b6666666666e22b6240957720dcba0e14"
	feed2    = mustFeedIDfromString(feed2str)
)

func TestClient_GetFeeds(t *testing.T) {
	expectedFeeds := []*feed.Feed{
		{FeedID: feed1},
		{FeedID: feed2},
	}

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET request, got %s", r.Method)
		}

		w.Header().Set("Content-Type", "application/json")
		err := json.NewEncoder(w).Encode(feedsResponse{
			Feeds: expectedFeeds,
		})
		if err != nil {
			t.Errorf("failed to encode response: %s", err)
		}
	})
	defer ms.Close()

	client, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	ctx := context.Background()
	feeds, err := client.GetFeeds(ctx)
	if err != nil {
		t.Fatalf("GetFeeds() error = %v", err)
	}
	if !reflect.DeepEqual(feeds, expectedFeeds) {
		t.Errorf("GetFeeds() = %#v, want %#v", feeds, expectedFeeds)
	}
}

func TestClient_GetReports(t *testing.T) {
	expectedReports := []*ReportResponse{
		{FeedID: feed1, ObservationsTimestamp: 12344},
		{FeedID: feed2, ObservationsTimestamp: 12344},
	}
	expectedFeedIdListStr := fmt.Sprintf("%s,%s", feed1.String(), feed2.String())

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET request, got %s", r.Method)
		}

		if r.URL.Query().Get("feedIDs") != expectedFeedIdListStr {
			t.Errorf("expected feedIDs %s, got %s", expectedFeedIdListStr, r.URL.Query().Get("feedIDs"))
		}

		if r.URL.Query().Get("timestamp") != "12344" {
			t.Errorf("expected timestamp 12344, got %s", r.URL.Query().Get("timestamp"))
		}

		w.Header().Set("Content-Type", "application/json")
		err := json.NewEncoder(w).Encode(reportsResponse{
			Reports: expectedReports,
		})

		if err != nil {
			t.Errorf("failed to encode response: %s", err)
		}

	})
	defer ms.Close()

	client, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	ctx := context.Background()
	reports, err := client.GetReports(ctx, []feed.ID{feed1, feed2}, 12344)
	if err != nil {
		t.Fatalf("GetFeeds() error = %v", err)
	}

	fmt.Println(expectedReports[0], reports[0])

	if !reflect.DeepEqual(reports, expectedReports) {
		t.Errorf("GetFeeds() = %v, want %v", reports, expectedReports)
	}
}

func TestClient_GetLatestReport(t *testing.T) {
	expectedReport := &ReportResponse{
		FeedID:     feed1,
		FullReport: hexutil.Bytes(`report1 payload`),
	}

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET request, got %s", r.Method)
		}

		if r.URL.Query().Get("feedID") != feed1str {
			t.Errorf("expected feedID, %s got %s", feed1str, r.URL.Query().Get("feedID"))
		}
		w.Header().Set("Content-Type", "application/json")

		err := json.NewEncoder(w).Encode(struct {
			Report *ReportResponse `json:"report"`
		}{
			Report: expectedReport,
		})

		if err != nil {
			t.Errorf("failed to encode response: %s", err)
		}
	})
	defer ms.Close()

	client, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	ctx := context.Background()
	report, err := client.GetLatestReport(ctx, feed1)
	if err != nil {
		t.Fatalf("GetLatestReport() error = %v", err)
	}

	if !reflect.DeepEqual(report, expectedReport) {
		t.Errorf("GetLatestReport() = %v, want %v", report, expectedReport)
	}
}

func TestClient_GetReportPage(t *testing.T) {
	expectedInitialTS := uint64(1234567891)

	expectedReportPage1 := &ReportPage{
		Reports: []*ReportResponse{
			{FeedID: feed1, FullReport: hexutil.Bytes(`report1 payload`)},
			{FeedID: feed1, FullReport: hexutil.Bytes(`report2 payload`)},
		},
		NextPageTS: 1234567899,
	}

	expectedReportPage2 := &ReportPage{
		Reports: []*ReportResponse{
			{FeedID: feed1, FullReport: hexutil.Bytes(`report3 payload`)},
			{FeedID: feed1, FullReport: hexutil.Bytes(`report4 payload`)},
		},
		NextPageTS: 1234567999,
	}

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET request, got %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")

		if r.URL.Query().Get("feedID") != feed1str {
			t.Errorf("expected feedID, %s got %s", feed1str, r.URL.Query().Get("feedID"))
		}

		startTS, err := strconv.ParseUint(r.URL.Query().Get("startTimestamp"), 10, 64)
		if err != nil {
			t.Errorf("error parsing startTimestamp: %s", err)
		}

		if startTS == expectedInitialTS {
			err := json.NewEncoder(w).Encode(expectedReportPage1)
			if err != nil {
				t.Errorf("failed to encode response: %s", err)
			}
			return
		}

		startTS, err = strconv.ParseUint(r.URL.Query().Get("startTimestamp"), 10, 64)
		if err != nil {
			t.Errorf("error parsing startTimestamp: %s", err)
		}

		if startTS == expectedReportPage1.NextPageTS {
			err := json.NewEncoder(w).Encode(expectedReportPage2)
			if err != nil {
				t.Errorf("failed to encode response: %s", err)
			}
			return
		}

		t.Errorf("none of expected conditions are met")

	})
	defer ms.Close()

	client, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	reportPage, err := client.GetReportPage(context.Background(), feed1, expectedInitialTS)
	if err != nil {
		t.Fatalf("GetReportPage() error = %v", err)
	}

	if !reflect.DeepEqual(reportPage, expectedReportPage1) {
		t.Errorf("GetReportPage() = %v, want %v", reportPage, expectedReportPage1)
	}

	reportPage, err = client.GetReportPage(context.Background(), feed1, reportPage.NextPageTS)
	if err != nil {
		t.Fatalf("GetReportPage() error = %v", err)
	}

	if !reflect.DeepEqual(reportPage, expectedReportPage2) {
		t.Errorf("GetReportPage() = %v, want %v", reportPage, expectedReportPage2)
	}
}

func TestClient_CustomHeadersInspect(t *testing.T) {
	expectedReport := &ReportResponse{
		FeedID:     feed1,
		FullReport: hexutil.Bytes(`report1 payload`),
	}
	expectedCllIntHeader := "01J1A1Q7AZ5MTJEHQ95Z85PYVQ"
	expectedCllHostHeader := "theHost"

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET request, got %s", r.Method)
		}

		if r.URL.Query().Get("feedID") != feed1.String() {
			t.Errorf("expected feedID, %s got %s", feed1.String(), r.URL.Query().Get("feedID"))
		}

		if r.Header.Get(cllIntHeader) != expectedCllIntHeader {
			t.Errorf("expected %s, %s got %s", cllIntHeader, expectedCllIntHeader, r.Header.Get(cllIntHeader))
		}

		if r.Host != expectedCllHostHeader {
			t.Errorf("expected request host, %s got %s", expectedCllHostHeader, r.Host)
		}

		w.Header().Set("Content-Type", "application/json")
		err := json.NewEncoder(w).Encode(struct {
			Report *ReportResponse `json:"report"`
		}{
			Report: expectedReport,
		})

		if err != nil {
			t.Errorf("failed to encode response: %s", err)
		}
	})
	defer ms.Close()

	clnt, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	c := clnt.(*client)
	c.config.InspectHttpResponse = func(r *http.Response) {
		if r.StatusCode != http.StatusOK {
			t.Errorf("expected %s, %s got %s", cllIntHeader, expectedCllIntHeader, r.Header.Get(cllIntHeader))
		}
	}

	ctx := context.WithValue(
		context.Background(),
		CustomHeadersCtxKey, http.Header{
			cllIntHeader: {expectedCllIntHeader},
			hostHeader:   {expectedCllHostHeader},
		})
	_, err = clnt.GetLatestReport(ctx, feed1)
	if err != nil {
		t.Fatalf("GetLatestReport() error = %v", err)
	}
}

func TestClient_serverHeaders(t *testing.T) {
	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodHead {
			t.Errorf("expected GET request, got %s", r.Method)
		}

		if r.URL.Path != "/" {
			t.Errorf("expected path /, got %s", r.URL.Path)
		}

		w.Header().Set(cllAvailOriginsHeader, "{origin1,originA}")
		w.Header().Set("Content-Type", "application/json")
	})
	defer ms.Close()

	clnt, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	c := clnt.(*client)
	h, err := c.serverHeaders(context.Background(), c.config.wsURL)
	if err != nil {
		t.Fatalf("error calling serverHeaders %s", err)
	}

	if h.Get(cllAvailOriginsHeader) != "{origin1,originA}" {
		t.Errorf(
			"serverHeader %s, want {origin1,originA}, got %s",
			cllAvailOriginsHeader, h.Get(cllAvailOriginsHeader))
	}

	if h.Get("Content-Type") != "application/json" {
		t.Errorf(
			"serverHeader Content-Type, want application/json, got %s", h.Get("Content-Type"))
	}
}

func TestNew(t *testing.T) {
	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{
			name:    "valid config",
			wantErr: false,
			cfg: Config{
				ApiKey:    "mykey",
				ApiSecret: "mysecret",
				RestURL:   "https://rest.domain.link",
				WsURL:     "https://ws.domain.link",
			},
		},
		{
			name:    "empty api key",
			wantErr: true,
			cfg: Config{
				ApiKey:    "",
				ApiSecret: "mysecret",
				RestURL:   "https://rest.domain.link",
				WsURL:     "https://ws.domain.link",
			},
		},
		{
			name:    "empty api secret",
			wantErr: true,
			cfg: Config{
				ApiKey:    "mykey",
				ApiSecret: "",
				RestURL:   "https://rest.domain.link",
				WsURL:     "https://ws.domain.link",
			},
		},
		{
			name:    "no url provided",
			wantErr: true,
			cfg: Config{
				ApiKey:    "mykey",
				ApiSecret: "mysecret",
			},
		},
		{
			name:    "invalid rest url",
			wantErr: true,
			cfg: Config{
				ApiKey:    "mykey",
				ApiSecret: "mysecret",
				RestURL:   ":rest.domain.link",
				WsURL:     "https://ws.domain.link",
			},
		},
		{
			name:    "invalid websocket url",
			wantErr: true,
			cfg: Config{
				ApiKey:    "mykey",
				ApiSecret: "mysecret",
				RestURL:   "https://rest.domain.link",
				WsURL:     ":ws.domain.link",
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := New(tt.cfg)
			if (err != nil) != tt.wantErr {
				t.Errorf("New() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
		})
	}
}

func Test_extractOrigins(t *testing.T) {
	tests := []struct {
		name        string
		h           http.Header
		wantOrigins []string
	}{
		{
			name: "single origin",
			h: http.Header{
				cllAvailOriginsHeader: {"{origin1}"},
			},
			wantOrigins: []string{"origin1"},
		},
		{
			name: "multiple origins",
			h: http.Header{
				cllAvailOriginsHeader: {"{origin1,originA,origin3}"},
			},
			wantOrigins: []string{"origin1", "originA", "origin3"},
		},
		{
			name: "valid no list",
			h: http.Header{
				cllAvailOriginsHeader: {"origin1,originA,origin3"},
			},
			wantOrigins: []string{"origin1", "originA", "origin3"},
		},
		{
			name:        "empty header",
			h:           http.Header{},
			wantOrigins: nil,
		},
		{
			name:        "nil reader",
			h:           http.Header{},
			wantOrigins: nil,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if gotOrigins := extractOrigins(tt.h); !reflect.DeepEqual(gotOrigins, tt.wantOrigins) {
				t.Errorf("extractOrigins() = %v, want %v", gotOrigins, tt.wantOrigins)
			}
		})
	}
}

type mockServer struct {
	server *httptest.Server
}

func newMockServer(handler func(w http.ResponseWriter, r *http.Request)) *mockServer {
	ms := &mockServer{}
	ms.server = httptest.NewServer(http.HandlerFunc(handler))
	return ms
}

func (ms *mockServer) Close() {
	ms.server.Close()
}

func (ms *mockServer) Client() (c Client, err error) {
	return New(Config{
		RestURL:   ms.server.URL,
		WsURL:     ms.server.URL,
		ApiKey:    "apiKey",
		ApiSecret: "apiSecret",
	})
}
