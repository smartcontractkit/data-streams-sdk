package streams

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/smartcontractkit/data-streams-sdk/go/feed"
	"nhooyr.io/websocket"
)

const (
	defaultWSConnectTimeout      = time.Second * 5
	minWSReconnectIntervalMillis = 1000
	maxWSReconnectIntervalMIllis = 10000
	maxWSReconnectAttempts       = 5
)

var (
	ErrStreamClosed = fmt.Errorf("client: use of closed Stream")
)

type message struct {
	Report *ReportResponse `json:"report"`
}

// Stream represents a realtime report stream.
// Safe for concurrent usage.
//
// The Stream will maintain at least 2 concurrent connections to different instances
// to ensure high availability, fault tolerance and minimize the risk of report gaps.
type Stream interface {
	// Read the next available report on the Stream.
	// Read blocks until a report is received, the context is canceled or
	// all underlying connections are in a error state.
	Read(context.Context) (*ReportResponse, error)

	// Stats return basic stats about the Stream.
	Stats() Stats

	// Close the Stream. Is the caller responsibility to call close when
	// the stream is no longer needed.
	Close() error
}

// Stats for the Stream
type Stats struct {
	Accepted              uint64 // Total number of accepted reports
	Deduplicated          uint64 // Total number of deduplicated reports when in HA
	TotalReceived         uint64 // Total number of received reports
	PartialReconnects     uint64 // Total number of partial reconnects when in HA
	FullReconnects        uint64 // Total number of full reconnects
	ConfiguredConnections uint64 // Number of configured connections if in HA
	ActiveConnections     uint64 // Current number of active connections
}

func (s Stats) String() (st string) {
	return fmt.Sprintf(
		"accepted: %d, deduplicated: %d, total_received %d, partial_reconnects: %d, full_reconnects: %d, configured_connections: %d, active_connections %d",
		s.Accepted, s.Deduplicated,
		s.TotalReceived, s.PartialReconnects,
		s.FullReconnects, s.ConfiguredConnections, s.ActiveConnections,
	)
}

type stream struct {
	httpClient    *http.Client
	customHeaders http.Header
	config        Config
	output        chan *ReportResponse
	feedIDs       []feed.ID
	conns         []*wsConn
	closeError    atomic.Value

	waterMarkMu sync.Mutex
	waterMark   map[string]uint64

	stats struct {
		accepted              atomic.Uint64
		skipped               atomic.Uint64
		partialReconnects     atomic.Uint64
		fullReconnects        atomic.Uint64
		activeConnections     atomic.Uint64
		configuredConnections atomic.Uint64
	}

	closed atomic.Bool
}

func (c *client) newStream(ctx context.Context, httpClient *http.Client, feedIDs []feed.ID, origins []string) (s *stream, err error) {
	s = &stream{
		httpClient: httpClient,
		config:     c.config,
		output:     make(chan *ReportResponse, 1),
		feedIDs:    feedIDs,
		waterMark:  make(map[string]uint64),
	}

	if value := ctx.Value(CustomHeadersCtxKey); value != nil {
		if h, ok := value.(http.Header); ok {
			s.customHeaders = h
		}
	}

	// only creates a HA stream if
	// more than a single origin is provided
	// and ws ha is enabled
	if len(origins) > 0 && c.config.WsHA {
		c.config.logDebug("client: attempting to connect websockets in HA mode")
		for x := 0; x < len(origins); x++ {
			conn, err := s.newWSconn(ctx, origins[x])
			if err != nil {
				return nil, err
			}
			go s.monitorConn(conn)
			s.conns = append(s.conns, conn)
			s.stats.configuredConnections.Add(1)
		}
	} else {
		conn, err := s.newWSconn(ctx, "")
		if err != nil {
			return nil, err
		}
		go s.monitorConn(conn)
		s.conns = append(s.conns, conn)
		s.stats.configuredConnections.Add(1)
	}

	return s, nil
}

func (s *stream) pingConn(ctx context.Context, conn *wsConn) {
	ticker := time.NewTicker(time.Second * 2)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return

		case <-ticker.C:
			pctx, pcancel := context.WithTimeout(context.Background(), 2*time.Second)
			err := conn.conn.Ping(pctx)
			pcancel()

			if s.closed.Load() {
				return
			}

			if err != nil {
				s.config.logInfo(
					"client: stream websocket %s ping error: %s, closing client: %s",
					conn.origin, err, conn.close(),
				)
				return
			}
		}
	}
}

func (s *stream) monitorConn(conn *wsConn) {
	for !s.closed.Load() {
		ctx, cancel := context.WithCancel(context.Background())

		// start pinging the server in the background and ensure we fail
		// an unresponsive connection fast
		go s.pingConn(ctx, conn)

		// Set this conn to active
		s.stats.activeConnections.Add(1)

		// read blocks until conn is closed or errors out
		err := conn.read(ctx, s.accept)
		cancel()

		// stream closed
		if s.closed.Load() {
			return
		}

		// reconnect protocol
		// `Add(^uint64(0))` will decrement activeConnections
		if s.stats.activeConnections.Add(^uint64(0)) == 0 {
			s.stats.fullReconnects.Add(1)
		} else {
			s.stats.partialReconnects.Add(1)
		}

		s.config.logInfo(
			"client: stream websocket %s error: %s",
			conn.origin, err,
		)
		s.config.logInfo(
			"client: reconnecting stream websocket %s",
			conn.origin,
		)

		// ensure the current connection is closed
		_ = conn.close()

		// reconnect loop
		// will try to reconnect until client is closed or
		// we have no active connections and have exceeded maxWSReconnectAttempts
		var attempts int
		for {
			var re *wsConn
			var err error

			if s.closed.Load() {
				return
			}

			// fail the stream if we are over the maxWSReconnectAttempts
			// and there are no other active connection
			if attempts >= s.config.WsMaxReconnect && s.stats.activeConnections.Load() == 0 {
				s.closeError.CompareAndSwap(nil, fmt.Errorf("stream has no active connections, last error: %w", err))
				s.Close()
				return
			}
			attempts++

			ctx, cancel = context.WithTimeout(context.Background(), defaultWSConnectTimeout)
			re, err = s.newWSconn(ctx, conn.origin)
			cancel()

			if err != nil {
				interval := time.Millisecond * time.Duration(
					rand.Intn(maxWSReconnectIntervalMIllis-minWSReconnectIntervalMillis)+minWSReconnectIntervalMillis) //nolint:gosec
				s.config.logInfo(
					"client: stream websocket %s: error reconnecting: %s, backing off: %s",
					conn.origin, err, interval.String(),
				)
				time.Sleep(interval)
				continue
			}

			conn.replace(re.conn)
			s.config.logInfo(
				"client: stream websocket %s: reconnected",
				conn.origin,
			)
			break
		}
	}
}

func (s *stream) Stats() (st Stats) {
	st.Accepted = s.stats.accepted.Load()
	st.Deduplicated = s.stats.skipped.Load()
	st.TotalReceived = st.Accepted + st.Deduplicated
	st.PartialReconnects = s.stats.partialReconnects.Load()
	st.FullReconnects = s.stats.fullReconnects.Load()
	st.ConfiguredConnections = s.stats.configuredConnections.Load()
	st.ActiveConnections = s.stats.activeConnections.Load()

	return st
}

func (s *stream) Read(ctx context.Context) (r *ReportResponse, err error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case r := <-s.output:
		// return a valid report even if stream is closed
		// errstreamClosed will be returned on next call to Read()
		if s.closed.Load() && r == nil {
			if err, ok := s.closeError.Load().(error); ok {
				return nil, err
			}
			return nil, ErrStreamClosed
		}
		return r, nil
	}
}

func (s *stream) Close() (err error) {
	if !s.closed.CompareAndSwap(false, true) {
		return nil
	}
	defer close(s.output)

	for x := 0; x < len(s.conns); x++ {
		_ = s.conns[x].close()
	}

	// return a pending error
	if err, ok := s.closeError.Load().(error); ok {
		return err
	}

	return nil
}

func (s *stream) accept(ctx context.Context, m *message) (err error) {
	id := m.Report.FeedID.String()

	s.waterMarkMu.Lock()
	if s.waterMark[id] >= m.Report.ObservationsTimestamp {
		s.stats.skipped.Add(1)
		s.waterMarkMu.Unlock()
		return nil
	}

	s.stats.accepted.Add(1)
	s.waterMark[id] = m.Report.ObservationsTimestamp
	s.waterMarkMu.Unlock()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case s.output <- m.Report:
		return nil
	}
}

type wsConn struct {
	mu     sync.Mutex
	origin string
	conn   *websocket.Conn
}

func (ws *wsConn) close() (err error) {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	return ws.conn.CloseNow()
}

func (ws *wsConn) read(ctx context.Context, accept func(context.Context, *message) error) (err error) {
	for {
		_, b, err := ws.conn.Read(ctx)
		if err != nil {
			return err
		}

		m := &message{}
		if err = json.Unmarshal(b, m); err != nil {
			return err
		}

		if err = accept(ctx, m); err != nil {
			return err
		}
	}
}

func (ws *wsConn) replace(c *websocket.Conn) {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.conn = c
}

func (s *stream) newWSconn(ctx context.Context, origin string) (ws *wsConn, err error) {
	reqURL := s.config.wsURL.ResolveReference(&url.URL{Path: apiV1WS})
	reqURL.RawQuery = url.Values{"feedIDs": {strings.Join(feedIdsToStringList(s.feedIDs), ",")}}.Encode()

	headers := http.Header{}
	generateAuthHeaders(headers, http.MethodGet, reqURL.RequestURI(), nil,
		s.config.ApiKey, s.config.ApiSecret, time.Now().UnixMilli())

	if origin != "" {
		headers.Add(cllOriginHeader, origin)
	}

	if len(s.customHeaders) > 0 {
		for k, v := range s.customHeaders {
			headers.Add(k, v[0])
		}
	}

	opts := &websocket.DialOptions{
		HTTPHeader:      headers,
		CompressionMode: websocket.CompressionContextTakeover,
		HTTPClient:      s.httpClient,
		Host:            s.customHeaders.Get("Host"),
	}
	s.config.logDebug("client: stream websocket dial request url: %s, opts: %s", reqURL.String(), opts)
	conn, resp, err := websocket.Dial(ctx, reqURL.String(), opts)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("client: invalid status code %d", resp.StatusCode)
	}

	ws = &wsConn{
		origin: origin,
		conn:   conn,
	}

	return ws, nil
}
