package streams

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/smartcontractkit/data-streams-sdk/go/v2/feed"
)

func TestClient_Subscribe(t *testing.T) {
	expectedReports := []*ReportResponse{
		{FeedID: feed1, ObservationsTimestamp: time.Unix(12344, 0)},
		{FeedID: feed2, ObservationsTimestamp: time.Unix(12344, 0)},
	}
	expectedFeedIdListStr := fmt.Sprintf("%s,%s", feed1.String(), feed2.String())

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			return
		}

		if r.URL.Path != apiV2WS {
			t.Errorf("expected path %s, got %s", apiV2WS, r.URL.Path)
		}

		if r.URL.Query().Get("feedIDs") != expectedFeedIdListStr {
			t.Errorf("expected feedIDs %s, got %s", expectedFeedIdListStr, r.URL.Query().Get("feedIDs"))
		}

		conn, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)

		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}
		defer func() { _ = conn.CloseNow() }()

		for x := 0; x < len(expectedReports); x++ {
			b, err := json.Marshal(&message{expectedReports[x]})
			if err != nil {
				t.Errorf("failed to serialize message: %s", err)
			}

			err = conn.Write(context.Background(), websocket.MessageBinary, b)
			if err != nil {
				t.Errorf("failed to write message: %s", err)
			}
		}

		waitCount := 5
		for {
			if waitCount == 0 {
				t.Errorf("timed out waiting for client close: %s", err)
			}
			if err := conn.Ping(context.Background()); err != nil {
				return
			}

			waitCount--
			time.Sleep(100 * time.Millisecond)
		}

	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}
	cc := streamsClient.(*client)
	cc.config.Logger = LogPrintf
	cc.config.LogDebug = true

	sub, err := streamsClient.Stream(context.Background(), []feed.ID{feed1, feed2})
	if err != nil {
		t.Fatalf("error subscribing %s", err)
	}
	defer sub.Close()

	var reports []*ReportResponse
	for x := 0; x < len(expectedReports); x++ {
		rep, err := sub.Read(context.Background())
		t.Log("read", rep.FeedID.String())
		if err != nil {
			t.Fatalf("error reading report %s", err)
		}

		reports = append(reports, rep)
	}

	if !reportResponsesEqual(reports, expectedReports) {
		t.Errorf("Read() = %v, want %v", reports, expectedReports)
	}

	stats := sub.Stats()
	if stats.Accepted != uint64(len(expectedReports)) {
		t.Errorf("stats expected %d, want %d", stats.Accepted, len(expectedReports))
	}

	// must be safe to close multiple times.
	sub.Close()
	sub.Close()
}

func TestClient_SubscribeWithCallback(t *testing.T) {
	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			return
		}
		if r.URL.Path != apiV2WS {
			t.Errorf("expected path %s, got %s", apiV2WS, r.URL.Path)
		}
		_, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)
		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}
	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	cc := streamsClient.(*client)
	cc.config.Logger = LogPrintf
	cc.config.LogDebug = true

	callbackMu := sync.Mutex{}
	callbackTriggerCount := atomic.Uint64{}
	callbackConnected := false
	callbackOrigin := "default"
	expectedOrigin := ""
	callbackHost := "default"
	expectedHost := cc.config.wsURL.Host
	statusCallbackFunc := func(connected bool, host string, origin string) {
		callbackMu.Lock()
		defer callbackMu.Unlock()
		callbackConnected = connected
		callbackHost = host
		callbackOrigin = origin
		callbackTriggerCount.Add(1)
	}

	sub, err := streamsClient.StreamWithStatusCallback(context.Background(), []feed.ID{feed1, feed2}, statusCallbackFunc)
	if err != nil {
		t.Fatalf("error subscribing %s", err)
	}
	defer sub.Close()

	waitCount := 5
	for callbackTriggerCount.Load() == 0 {
		if waitCount == 0 {
			t.Errorf("timed out waiting for callback call")
		}
		waitCount--
		time.Sleep(100 * time.Millisecond)
	}
	stats := sub.Stats()
	if stats.ActiveConnections != 1 {
		t.Errorf("ActiveConnections = %v, want 1", stats.ActiveConnections)
	}
	callbackMu.Lock()
	if !callbackConnected {
		t.Errorf("callbackConnected = %v, want true", callbackConnected)
	}
	if callbackHost != expectedHost {
		t.Errorf("callbackHost = %v, want %v", callbackHost, expectedHost)
	}
	if callbackOrigin != expectedOrigin {
		t.Errorf("callbackOrigin = %v, want %v", callbackOrigin, expectedOrigin)
	}
	callbackMu.Unlock()

	callbackOrigin = "default"
	callbackHost = "default"
	sub.Close()
	waitCount = 5
	for callbackTriggerCount.Load() == 1 {
		if waitCount == 0 {
			t.Errorf("timed out waiting for callback call")
		}
		waitCount--
		time.Sleep(100 * time.Millisecond)
	}
	stats = sub.Stats()
	if stats.ActiveConnections != 0 {
		t.Errorf("ActiveConnections = %v, want 0", stats.ActiveConnections)
	}
	callbackMu.Lock()
	if callbackConnected {
		t.Errorf("callbackConnected = %v, want false", callbackConnected)
	}
	if callbackHost != expectedHost {
		t.Errorf("callbackHost = %v, want %v", callbackHost, expectedHost)
	}
	if callbackOrigin != expectedOrigin {
		t.Errorf("callbackOrigin = %v, want %v", callbackOrigin, expectedOrigin)
	}
	callbackMu.Unlock()
}

func TestClient_SubscribeCanceledContext(t *testing.T) {
	ctx, ctxCancel := context.WithCancel(context.Background())
	expectedFeedIdListStr := fmt.Sprintf("%s,%s", feed1.String(), feed2.String())

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			// simulates the context being canceled during the server headers request
			ctxCancel()
			return
		}

		if r.URL.Path != apiV2WS {
			t.Errorf("expected path %s, got %s", apiV2WS, r.URL.Path)
		}

		if r.URL.Query().Get("feedIDs") != expectedFeedIdListStr {
			t.Errorf("expected feedIDs %s, got %s", expectedFeedIdListStr, r.URL.Query().Get("feedIDs"))
		}

		conn, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)

		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}
		defer func() { _ = conn.CloseNow() }()
	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}
	cc := streamsClient.(*client)
	cc.config.WsHA = true

	_, err = streamsClient.Stream(ctx, []feed.ID{feed1, feed2})
	if err == nil || !errors.Is(err, context.Canceled) {
		t.Fatalf("Expected error due to context cancellation, got err: %s", err)
	}
}

func TestClient_StreamReconnectMerge(t *testing.T) {
	expectedReports := []*ReportResponse{
		{FeedID: feed1, ObservationsTimestamp: time.Unix(12344, 0)},
		{FeedID: feed2, ObservationsTimestamp: time.Unix(12344, 0)},
	}
	expectedFeedIdListStr := fmt.Sprintf("%s,%s", feed1.String(), feed2.String())

	connCount := &atomic.Int32{}
	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			return
		}

		if r.URL.Path != apiV2WS {
			t.Errorf("expected path %s, got %s", apiV2WS, r.URL.Path)
		}

		if r.URL.Query().Get("feedIDs") != expectedFeedIdListStr {
			t.Errorf("expected feedIDs %s, got %s", expectedFeedIdListStr, r.URL.Query().Get("feedIDs"))
		}

		conn, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)

		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}
		defer func() { _ = conn.CloseNow() }()

		for x := 0; x < len(expectedReports); x++ {
			b, err := json.Marshal(&message{expectedReports[x]})
			if err != nil {
				t.Errorf("failed to serialize message: %s", err)
			}

			err = conn.Write(context.Background(), websocket.MessageBinary, b)
			if err != nil {
				t.Errorf("failed to write message: %s", err)
			}
		}

		connCount.Add(1)
		if connCount.Load() < 2 {
			return
		}

		waitCount := 5
		for {
			if waitCount == 0 {
				t.Errorf("timed out waiting for client close: %s", err)
			}
			if err := conn.Ping(context.Background()); err != nil {
				return
			}

			waitCount--
			time.Sleep(100 * time.Millisecond)
		}

	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	cc := streamsClient.(*client)
	cc.config.Logger = LogPrintf
	cc.config.LogDebug = true

	sub, err := streamsClient.Stream(context.Background(), []feed.ID{feed1, feed2})
	if err != nil {
		t.Fatalf("error subscribing %s", err)
	}
	defer sub.Close()

	var reports []*ReportResponse
	for x := 0; sub.Stats().TotalReceived < 4; x++ {
		ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond*100)
		rep, err := sub.Read(ctx)
		cancel()
		if err != nil && !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("error reading report %s", err)
			return
		}

		if rep != nil {
			reports = append(reports, rep)
		}
	}

	stats := sub.Stats()
	sub.Close()

	if !reportResponsesEqual(reports, expectedReports) {
		t.Errorf("Read() = %v, want %v", reports, expectedReports)
	}

	if stats.Accepted != uint64(len(expectedReports)) {
		t.Errorf("stats accepted %d, want %d", stats.Accepted, len(expectedReports))
	}

	if stats.TotalReceived != uint64(len(expectedReports)*2) {
		t.Errorf("stats total %d, want %d", stats.TotalReceived, len(expectedReports)*2)
	}
}

func TestClient_StreamHA(t *testing.T) {
	expectedReports1 := []*ReportResponse{
		{FeedID: feed1, ObservationsTimestamp: time.Unix(12344, 0)},
		{FeedID: feed2, ObservationsTimestamp: time.Unix(12344, 0)},
	}
	expectedReports2 := []*ReportResponse{
		{FeedID: feed1, ObservationsTimestamp: time.Unix(12344, 0)},
		{FeedID: feed2, ObservationsTimestamp: time.Unix(12344, 0)},
		{FeedID: feed1, ObservationsTimestamp: time.Unix(12345, 0)},
		{FeedID: feed2, ObservationsTimestamp: time.Unix(12346, 0)},
	}
	expectedFeedIdListStr := fmt.Sprintf("%s,%s", feed1.String(), feed2.String())

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			w.Header().Add(cllAvailOriginsHeader, "{001,002}")
			w.WriteHeader(200)
			return
		}

		if r.URL.Path != apiV2WS {
			t.Errorf("expected path %s, got %s", apiV2WS, r.URL.Path)
		}

		if r.URL.Query().Get("feedIDs") != expectedFeedIdListStr {
			t.Errorf("expected feedIDs %s, got %s", expectedFeedIdListStr, r.URL.Query().Get("feedIDs"))
		}

		conn, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)

		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}
		defer func() { _ = conn.CloseNow() }()

		var expectedReports []*ReportResponse
		switch h := r.Header.Get(cllOriginHeader); h {
		case "001":
			expectedReports = expectedReports1
		case "002":
			expectedReports = expectedReports2
		default:
			t.Errorf("no %s header found", cllOriginHeader)
		}

		for x := 0; x < len(expectedReports); x++ {
			b, err := json.Marshal(&message{expectedReports[x]})
			if err != nil {
				t.Errorf("failed to serialize message: %s", err)
			}

			err = conn.Write(context.Background(), websocket.MessageBinary, b)
			if err != nil {
				t.Errorf("failed to write message: %s", err)
			}
		}

		waitCount := 5
		for {
			if waitCount == 0 {
				t.Errorf("timed out waiting for client close: %s", err)
			}
			if err := conn.Ping(context.Background()); err != nil {
				return
			}

			waitCount--
			time.Sleep(100 * time.Millisecond)
		}

	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}
	cc := streamsClient.(*client)
	cc.config.Logger = LogPrintf
	cc.config.LogDebug = true
	cc.config.WsHA = true

	sub, err := streamsClient.Stream(context.Background(), []feed.ID{feed1, feed2})
	if err != nil {
		t.Fatalf("error subscribing %s", err)
	}
	defer sub.Close()

	var reports []*ReportResponse
	for x := 0; x < len(expectedReports2); x++ {
		rep, err := sub.Read(context.Background())
		t.Log("read", rep.FeedID.String())
		if err != nil {
			t.Fatalf("error reading report %s", err)
		}

		reports = append(reports, rep)
	}

	if !reportResponsesEqual(reports, expectedReports2) {
		t.Errorf("Read() = %v, want %v", reports, expectedReports2)
	}

	stats := sub.Stats()
	if stats.Accepted != uint64(len(expectedReports2)) {
		t.Errorf("stats got %d, want %d", stats.Accepted, len(expectedReports2))
	}

	sub.Close()
}

func TestClient_ReadCancel(t *testing.T) {
	expectedReports := []*ReportResponse{
		{FeedID: feed1, ObservationsTimestamp: time.Unix(12344, 0)},
		{FeedID: feed2, ObservationsTimestamp: time.Unix(12344, 0)},
	}
	expectedFeedIdListStr := fmt.Sprintf("%s,%s", feed1.String(), feed2.String())

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			return
		}

		if r.URL.Path != apiV2WS {
			t.Errorf("expected path %s, got %s", apiV2WS, r.URL.Path)
		}

		if r.URL.Query().Get("feedIDs") != expectedFeedIdListStr {
			t.Errorf("expected feedIDs %s, got %s", expectedFeedIdListStr, r.URL.Query().Get("feedIDs"))
		}

		conn, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)

		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}
		defer func() { _ = conn.CloseNow() }()

		send := func() {
			for x := 0; x < len(expectedReports); x++ {
				b, err := json.Marshal(&message{expectedReports[x]})
				if err != nil {
					t.Errorf("failed to serialize message: %s", err)
				}

				err = conn.Write(context.Background(), websocket.MessageBinary, b)
				if err != nil {
					t.Errorf("failed to write message: %s", err)
				}
			}
		}

		send()
		send()

		waitCount := 5
		for {
			if waitCount == 0 {
				t.Errorf("timed out waiting for client close: %s", err)
			}
			if err := conn.Ping(context.Background()); err != nil {
				return
			}

			waitCount--
			time.Sleep(100 * time.Millisecond)
		}

	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}
	cc := streamsClient.(*client)
	cc.config.Logger = LogPrintf
	cc.config.LogDebug = true

	sub, err := streamsClient.Stream(context.Background(), []feed.ID{feed1, feed2})
	if err != nil {
		t.Fatalf("error subscribing %s", err)
	}
	defer sub.Close()

	var reports []*ReportResponse
	for x := 0; x < len(expectedReports); x++ {
		rep, err := sub.Read(context.Background())
		t.Log("read", rep.FeedID.String())
		if err != nil {
			t.Fatalf("error reading report %s", err)
		}

		reports = append(reports, rep)
	}

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(100 * time.Millisecond)
		cancel()
	}()

	rep, err := sub.Read(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected error context.Canceled, got %s", err)
	}

	if rep != nil {
		t.Errorf("expected nil report, got %#v", rep)
	}

	if !reportResponsesEqual(reports, expectedReports) {
		t.Errorf("Read() = %v, want %v", reports, expectedReports)
	}

	stats := sub.Stats()
	if stats.Accepted != uint64(len(expectedReports)) {
		t.Errorf("stats expected %d, want %d", stats.Accepted, len(expectedReports))
	}

	sub.Close()
}

func TestClient_StreamHAPartialReconnect(t *testing.T) {
	connects := &atomic.Uint64{}

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			w.Header().Add(cllAvailOriginsHeader, "{001,002}")
			w.WriteHeader(200)
			return
		}

		if r.URL.Path != apiV2WS {
			t.Errorf("expected path %s, got %s", apiV2WS, r.URL.Path)
		}

		conn, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)

		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}
		defer func() { _ = conn.CloseNow() }()

		if connects.Add(1) == 2 {
			_ = conn.CloseNow()
			return
		}

		for conn.Ping(context.Background()) == nil {
			time.Sleep(100 * time.Millisecond)
		}

	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}
	cc := streamsClient.(*client)
	cc.config.Logger = LogPrintf
	cc.config.LogDebug = true
	cc.config.WsHA = true

	sub, err := streamsClient.Stream(context.Background(), []feed.ID{feed1, feed2})
	if err != nil {
		t.Fatalf("error subscribing %s", err)
	}
	defer sub.Close()

	for connects.Load() != 3 {
		time.Sleep(time.Millisecond)
	}

	stats := sub.Stats()
	if stats.PartialReconnects != 1 {
		t.Errorf("stats expected partial reconnects %d, got %d", 1, stats.PartialReconnects)
	}

}

func TestClient_StreamCustomHeader(t *testing.T) {
	connects := &atomic.Uint64{}

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			w.Header().Add(cllAvailOriginsHeader, "{001,002}")
			w.WriteHeader(200)
			return
		}

		if r.URL.Path != apiV2WS {
			t.Errorf("expected path %s, got %s", apiV2WS, r.URL.Path)
		}

		if r.Header.Get("custom-header") != "custom-value" {
			t.Fatalf("missing custom header")
		}

		conn, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)

		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}
		defer func() { _ = conn.CloseNow() }()

		if connects.Add(1) == 2 {
			_ = conn.CloseNow()
			return
		}

		for conn.Ping(context.Background()) == nil {
			time.Sleep(100 * time.Millisecond)
		}

	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}
	cc := streamsClient.(*client)
	cc.config.Logger = LogPrintf
	cc.config.LogDebug = true
	cc.config.WsHA = true

	ctx := context.WithValue(context.Background(), CustomHeadersCtxKey, http.Header{"custom-header": {"custom-value"}})
	sub, err := streamsClient.Stream(ctx, []feed.ID{feed1, feed2})
	if err != nil {
		t.Fatalf("error subscribing %s", err)
	}
	defer sub.Close()

	for connects.Load() != 3 {
		time.Sleep(time.Millisecond)
	}

	stats := sub.Stats()
	if stats.PartialReconnects != 1 {
		t.Errorf("stats expected partial reconnects %d, got %d", 1, stats.PartialReconnects)
	}

}

// TestClient_StreamHA_OneOriginDown tests that when in HA mode with multiple origins,
// if one origin is down during initial connection, the stream should still be created
func TestClient_StreamHA_OneOriginDown(t *testing.T) {
	connectAttempts := &atomic.Uint64{}

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			w.Header().Add(cllAvailOriginsHeader, "{001,002}")
			w.WriteHeader(200)
			return
		}

		if r.URL.Path != apiV2WS {
			t.Errorf("expected path %s, got %s", apiV2WS, r.URL.Path)
		}

		origin := r.Header.Get(cllOriginHeader)
		connectAttempts.Add(1)

		// Simulate origin 002 being down by timing out the connection
		if origin == "002" {
			w.WriteHeader(http.StatusGatewayTimeout)
			return
		}

		// Origin 001 works fine
		conn, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)

		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}
		defer func() { _ = conn.CloseNow() }()

		// Keep the connection alive for testing
		for conn.Ping(context.Background()) == nil {
			time.Sleep(100 * time.Millisecond)
		}
	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	cc := streamsClient.(*client)
	cc.config.Logger = LogPrintf
	cc.config.LogDebug = true
	cc.config.WsHA = true

	// Attempt to create a stream - this should succeed with origin 001 even though 002 is down
	sub, err := streamsClient.Stream(context.Background(), []feed.ID{feed1, feed2})

	// In HA mode, the stream should succeed even if one origin is down
	if err != nil {
		t.Errorf("Stream creation failed: %v", err)
		t.Errorf("BUG DETECTED: In HA mode, stream should succeed with available origins")
		t.Errorf("Connect attempts made: %d", connectAttempts.Load())
		t.Errorf("Expected: Stream should succeed with 1 active connection from origin 001")
		t.Errorf("Actual: Stream creation failed completely when origin 002 was unavailable")
		t.Fatalf("Test reveals bug: HA mode is not resilient to individual origin failures during initial connection")
	}
	defer sub.Close()

	// Give connections time to establish
	time.Sleep(200 * time.Millisecond)

	stats := sub.Stats()

	// In HA mode with 2 origins configured but 1 down, we should have:
	// - ConfiguredConnections: 2 (we tried to connect to both)
	// - ActiveConnections: 1 (only origin 001 is up)
	if stats.ConfiguredConnections != 2 {
		t.Errorf("expected 2 configured connections, got %d", stats.ConfiguredConnections)
	}

	if stats.ActiveConnections != 1 {
		t.Errorf("expected 1 active connection, got %d", stats.ActiveConnections)
	}

}

// TestClient_StreamHA_AllOriginsFailInitialConnect covers HA mode when every origin
// rejects the WebSocket: newStream spawns retry goroutines then returns an error.
// Those goroutines must not close over the named result *stream (which becomes nil
// on return), or the first newWSconnWithRetry iteration panics on s.closed.Load().
func TestClient_StreamHA_AllOriginsFailInitialConnect(t *testing.T) {
	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			w.Header().Add(cllAvailOriginsHeader, "{001,002}")
			w.WriteHeader(http.StatusOK)
			return
		}
		if r.URL.Path != apiV2WS {
			return
		}
		w.WriteHeader(http.StatusForbidden)
	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	cc := streamsClient.(*client)
	cc.config.WsHA = true

	_, err = streamsClient.Stream(context.Background(), []feed.ID{feed1})
	if err == nil {
		t.Fatal("expected Stream error when every origin rejects the websocket")
	}

	// Allow retry goroutines to run; a nil *stream receiver would fault immediately.
	time.Sleep(300 * time.Millisecond)
}

func TestClient_StreamReconnectExhaustedReturnsNoActiveConnectionsError(t *testing.T) {
	connectAttempts := &atomic.Uint64{}

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.URL.Path != apiV2WS {
			t.Errorf("expected path %s, got %s", apiV2WS, r.URL.Path)
		}

		attempt := connectAttempts.Add(1)
		if attempt > 1 {
			// After the initial successful subscribe, force reconnect attempts to fail.
			w.WriteHeader(http.StatusForbidden)
			return
		}

		conn, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)
		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}

		// Close immediately so client enters reconnect flow.
		_ = conn.CloseNow()
	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	cc := streamsClient.(*client)
	cc.config.WsMaxReconnect = 1

	sub, err := streamsClient.Stream(t.Context(), []feed.ID{feed1})
	if err != nil {
		t.Fatalf("error subscribing %s", err)
	}
	defer sub.Close()

	readCtx, cancel := context.WithTimeout(t.Context(), maxWSReconnectIntervalSeconds)
	defer cancel()

	_, err = sub.Read(readCtx)
	if err == nil {
		t.Fatal("expected Read to fail after reconnect attempts are exhausted")
	}

	if !errors.Is(err, ErrStreamNoActiveConnections) {
		t.Fatalf("expected errors.Is(err, ErrStreamNoActiveConnections) to be true, got err: %v", err)
	}

	if !strings.Contains(err.Error(), fmt.Sprintf("%d", http.StatusForbidden)) {
		t.Fatalf("expected error to include underlying reconnect status code %d, got err: %v", http.StatusForbidden, err)
	}
}

func TestClient_StreamOutOfOrder(t *testing.T) {
	reports := []*ReportResponse{
		{FeedID: feed1, ObservationsTimestamp: time.Unix(100, 0)},
		{FeedID: feed1, ObservationsTimestamp: time.Unix(102, 0)},
		{FeedID: feed1, ObservationsTimestamp: time.Unix(101, 0)}, // out-of-order
	}

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			return
		}

		conn, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)
		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}
		defer func() { _ = conn.CloseNow() }()

		for _, rpt := range reports {
			b, err := json.Marshal(&message{rpt})
			if err != nil {
				t.Errorf("failed to serialize message: %s", err)
			}
			if err := conn.Write(context.Background(), websocket.MessageBinary, b); err != nil {
				t.Errorf("failed to write message: %s", err)
			}
		}

		for conn.Ping(context.Background()) == nil {
			time.Sleep(100 * time.Millisecond)
		}
	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	cc := streamsClient.(*client)
	cc.config.Logger = LogPrintf
	cc.config.LogDebug = true
	cc.config.WsAllowOutOfOrder = true

	sub, err := streamsClient.Stream(context.Background(), []feed.ID{feed1})
	if err != nil {
		t.Fatalf("error subscribing %s", err)
	}
	defer sub.Close()

	var received []*ReportResponse
	for i := 0; i < len(reports); i++ {
		rep, err := sub.Read(context.Background())
		if err != nil {
			t.Fatalf("error reading report %s", err)
		}
		received = append(received, rep)
	}

	if !reportResponsesEqual(received, reports) {
		t.Errorf("Read() = %v, want %v", received, reports)
	}

	stats := sub.Stats()
	if stats.Accepted != 3 {
		t.Errorf("stats.Accepted = %d, want 3", stats.Accepted)
	}
	if stats.OutOfOrder != 1 {
		t.Errorf("stats.OutOfOrder = %d, want 1", stats.OutOfOrder)
	}
	if stats.Deduplicated != 0 {
		t.Errorf("stats.Deduplicated = %d, want 0", stats.Deduplicated)
	}
}

func TestClient_StreamOutOfOrder_DefaultDrop(t *testing.T) {
	reports := []*ReportResponse{
		{FeedID: feed1, ObservationsTimestamp: time.Unix(100, 0)},
		{FeedID: feed1, ObservationsTimestamp: time.Unix(102, 0)},
		{FeedID: feed1, ObservationsTimestamp: time.Unix(101, 0)}, // out-of-order, should be dropped
	}

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			return
		}

		conn, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)
		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}
		defer func() { _ = conn.CloseNow() }()

		for _, rpt := range reports {
			b, err := json.Marshal(&message{rpt})
			if err != nil {
				t.Errorf("failed to serialize message: %s", err)
			}
			if err := conn.Write(context.Background(), websocket.MessageBinary, b); err != nil {
				t.Errorf("failed to write message: %s", err)
			}
		}

		for conn.Ping(context.Background()) == nil {
			time.Sleep(100 * time.Millisecond)
		}
	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	cc := streamsClient.(*client)
	cc.config.Logger = LogPrintf
	cc.config.LogDebug = true

	sub, err := streamsClient.Stream(context.Background(), []feed.ID{feed1})
	if err != nil {
		t.Fatalf("error subscribing %s", err)
	}
	defer sub.Close()

	var received []*ReportResponse
	for i := 0; i < 2; i++ {
		rep, err := sub.Read(context.Background())
		if err != nil {
			t.Fatalf("error reading report %s", err)
		}
		received = append(received, rep)
	}

	// Wait for the third message to be processed by accept (it should be dropped)
	time.Sleep(50 * time.Millisecond)

	expectedDelivered := reports[:2]
	if !reportResponsesEqual(received, expectedDelivered) {
		t.Errorf("Read() = %v, want %v", received, expectedDelivered)
	}

	stats := sub.Stats()
	if stats.Accepted != 2 {
		t.Errorf("stats.Accepted = %d, want 2", stats.Accepted)
	}
	if stats.Deduplicated != 1 {
		t.Errorf("stats.Deduplicated = %d, want 1", stats.Deduplicated)
	}
	if stats.OutOfOrder != 1 {
		t.Errorf("stats.OutOfOrder = %d, want 1", stats.OutOfOrder)
	}
}

func TestClient_StreamDuplicateAlwaysDropped(t *testing.T) {
	// Exact timestamp duplicates must be dropped regardless of WsAllowOutOfOrder.
	reports := []*ReportResponse{
		{FeedID: feed1, ObservationsTimestamp: time.Unix(100, 0)},
		{FeedID: feed1, ObservationsTimestamp: time.Unix(100, 0)}, // exact duplicate
	}

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			return
		}

		conn, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)
		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}
		defer func() { _ = conn.CloseNow() }()

		for _, rpt := range reports {
			b, err := json.Marshal(&message{rpt})
			if err != nil {
				t.Errorf("failed to serialize message: %s", err)
			}
			if err := conn.Write(context.Background(), websocket.MessageBinary, b); err != nil {
				t.Errorf("failed to write message: %s", err)
			}
		}

		for conn.Ping(context.Background()) == nil {
			time.Sleep(100 * time.Millisecond)
		}
	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	cc := streamsClient.(*client)
	cc.config.WsAllowOutOfOrder = true // duplicate must still be dropped even with flag set

	sub, err := streamsClient.Stream(context.Background(), []feed.ID{feed1})
	if err != nil {
		t.Fatalf("error subscribing %s", err)
	}
	defer sub.Close()

	rep, err := sub.Read(context.Background())
	if err != nil {
		t.Fatalf("error reading report %s", err)
	}
	if !rep.ObservationsTimestamp.Equal(time.Unix(100, 0)) {
		t.Errorf("unexpected report timestamp: %v", rep.ObservationsTimestamp)
	}

	time.Sleep(50 * time.Millisecond)

	stats := sub.Stats()
	if stats.Accepted != 1 {
		t.Errorf("stats.Accepted = %d, want 1", stats.Accepted)
	}
	if stats.Deduplicated != 1 {
		t.Errorf("stats.Deduplicated = %d, want 1", stats.Deduplicated)
	}
	if stats.OutOfOrder != 0 {
		t.Errorf("stats.OutOfOrder = %d, want 0", stats.OutOfOrder)
	}
}

func TestClient_StreamMultipleOutOfOrder_Allowed(t *testing.T) {
	// With WsAllowOutOfOrder=true, every report is delivered even when several
	// arrive out of order after the watermark advances.
	reports := []*ReportResponse{
		{FeedID: feed1, ObservationsTimestamp: time.Unix(100, 0)},
		{FeedID: feed1, ObservationsTimestamp: time.Unix(105, 0)}, // advances watermark to 105
		{FeedID: feed1, ObservationsTimestamp: time.Unix(103, 0)}, // OOO
		{FeedID: feed1, ObservationsTimestamp: time.Unix(102, 0)}, // OOO
		{FeedID: feed1, ObservationsTimestamp: time.Unix(104, 0)}, // OOO
	}

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			return
		}

		conn, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)
		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}
		defer func() { _ = conn.CloseNow() }()

		for _, rpt := range reports {
			b, err := json.Marshal(&message{rpt})
			if err != nil {
				t.Errorf("failed to serialize message: %s", err)
			}
			if err := conn.Write(context.Background(), websocket.MessageBinary, b); err != nil {
				t.Errorf("failed to write message: %s", err)
			}
		}

		for conn.Ping(context.Background()) == nil {
			time.Sleep(100 * time.Millisecond)
		}
	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	cc := streamsClient.(*client)
	cc.config.WsAllowOutOfOrder = true

	sub, err := streamsClient.Stream(context.Background(), []feed.ID{feed1})
	if err != nil {
		t.Fatalf("error subscribing %s", err)
	}
	defer sub.Close()

	var received []*ReportResponse
	for i := 0; i < len(reports); i++ {
		rep, err := sub.Read(context.Background())
		if err != nil {
			t.Fatalf("error reading report %s", err)
		}
		received = append(received, rep)
	}

	if !reportResponsesEqual(received, reports) {
		t.Errorf("Read() = %v, want %v", received, reports)
	}

	stats := sub.Stats()
	if stats.Accepted != 5 {
		t.Errorf("stats.Accepted = %d, want 5", stats.Accepted)
	}
	if stats.OutOfOrder != 3 {
		t.Errorf("stats.OutOfOrder = %d, want 3", stats.OutOfOrder)
	}
	if stats.Deduplicated != 0 {
		t.Errorf("stats.Deduplicated = %d, want 0", stats.Deduplicated)
	}
}

// Tests that when in HA mode both origins are up after a recovery period even if one origin is down on initial connection
func TestClient_StreamHA_OneOriginDownRecovery(t *testing.T) {
	connectAttempts := &atomic.Uint64{}
	reconnectAttemptsBeforeRecovery := uint64(4)

	ms := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead {
			w.Header().Add(cllAvailOriginsHeader, "{001,002}")
			w.WriteHeader(200)
			return
		}

		if r.URL.Path != apiV2WS {
			t.Errorf("expected path %s, got %s", apiV2WS, r.URL.Path)
		}

		origin := r.Header.Get(cllOriginHeader)
		connectAttempts.Add(1)

		// Simulate origin 002 being down for the first reconnectAttemptsBeforeRecovery attempts
		// Add one to count for 001 connection
		if origin == "002" && connectAttempts.Load() <= reconnectAttemptsBeforeRecovery+1 {
			w.WriteHeader(http.StatusGatewayTimeout)
			return
		}

		conn, err := websocket.Accept(
			w, r, &websocket.AcceptOptions{CompressionMode: websocket.CompressionContextTakeover},
		)

		if err != nil {
			t.Fatalf("error accepting connection: %s", err)
		}
		defer func() { _ = conn.CloseNow() }()

		// Keep the connection alive for testing
		for {
			_, _, err := conn.Read(context.Background())
			if err != nil {
				break
			}
		}
	})
	defer ms.Close()

	streamsClient, err := ms.Client()
	if err != nil {
		t.Fatalf("error creating client %s", err)
	}

	cc := streamsClient.(*client)
	cc.config.Logger = LogPrintf
	cc.config.LogDebug = true
	cc.config.WsHA = true

	sub, err := streamsClient.StreamWithStatusCallback(context.Background(), []feed.ID{feed1, feed2}, func(connected bool, host string, origin string) {
		t.Logf("status callback: connected=%v, host=%s, origin=%s", connected, host, origin)
	})
	if err != nil {
		t.Fatalf("error subscribing %s", err)
	}
	defer sub.Close()

	for connectAttempts.Load() != 2 {
		time.Sleep(time.Millisecond)
	}

	time.Sleep(time.Millisecond * 5)
	stats := sub.Stats()
	if stats.ActiveConnections != 1 {
		t.Errorf("expected 1 active connection before recovery, got %d", stats.ActiveConnections)
	}

	if stats.ConfiguredConnections != 2 {
		t.Errorf("expected 2 configured connections before recovery, got %d", stats.ConfiguredConnections)
	}

	// Add two to count one for 001 connection and one for 002 connection
	for connectAttempts.Load() != reconnectAttemptsBeforeRecovery+2 {
		time.Sleep(time.Millisecond)
	}

	time.Sleep(time.Millisecond * 5)
	stats = sub.Stats()
	if stats.ActiveConnections != 2 {
		t.Errorf("expected 2 active connection after recovery, got %d", stats.ActiveConnections)
	}

	if stats.ConfiguredConnections != 2 {
		t.Errorf("expected 2 configured connections after recovery, got %d", stats.ConfiguredConnections)
	}
}
