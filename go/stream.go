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
	httpClient         *http.Client
	customHeaders      http.Header
	config             Config
	output             chan *ReportResponse
	feedIDs            []feed.ID
	conns              []*wsConn
	streamCtx          context.Context
	streamCtxCancel    context.CancelFunc
	closeError         atomic.Value
	connStatusCallback func(isConneccted bool, host string, origin string)

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

	closed       atomic.Bool
	closingMutex sync.RWMutex
}

func (c *client) newStream(ctx context.Context, httpClient *http.Client, feedIDs []feed.ID,
	origins []string, connStatusCallback func(isConnected bool, host string, origin string)) (s *stream, err error) {
	streamCtx, streamCtxCancel := context.WithCancel(ctx)
	s = &stream{
		httpClient:         httpClient,
		connStatusCallback: connStatusCallback,
		config:             c.config,
		output:             make(chan *ReportResponse, 1),
		feedIDs:            feedIDs,
		waterMark:          make(map[string]uint64),
		streamCtx:          streamCtx,
		streamCtxCancel:    streamCtxCancel,
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
		var errs []error
		for x := 0; x < len(origins); x++ {
			s.stats.configuredConnections.Add(1)
			conn, err := s.newWSconn(ctx, origins[x])
			if err != nil {
				c.config.logInfo("client: failed to connect to origin %s: %s", origins[x], err)
				errs = append(errs, fmt.Errorf("origin %s: %w", origins[x], err))
				// Retry connecting to the origin in the background
				go func() {
					conn, err := s.newWSconnWithRetry(origins[x])
					if err != nil {
						return
					}
					go s.monitorConn(conn)
					// Lock is aquired here to prevent race condition with Close() occuring
					// during this background reconnect attempt
					s.closingMutex.Lock()
					s.conns = append(s.conns, conn)
					s.closingMutex.Unlock()
				}()
				continue
			}
			go s.monitorConn(conn)
			s.conns = append(s.conns, conn)
		}

		// Only fail if we couldn't connect to ANY origins
		if len(s.conns) == 0 {
			err = fmt.Errorf("failed to connect to any origins in HA mode: %v", errs)
			s.closeError.CompareAndSwap(nil, err)
			s.Close()
			return nil, err
		}
		c.config.logInfo("client: connected to %d out of %d origins in HA mode", len(s.conns), len(origins))
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
	if s.connStatusCallback != nil {
		go s.connStatusCallback(true, conn.host, conn.origin)
	}
	for !s.closed.Load() {
		ctx, cancel := context.WithCancel(s.streamCtx)

		// start pinging the server in the background and ensure we fail
		// an unresponsive connection fast
		go s.pingConn(ctx, conn)

		// Set this conn to active
		s.stats.activeConnections.Add(1)

		// read blocks until conn is closed or errors out
		err := conn.read(ctx, &s.closingMutex, s.accept)
		cancel()
		// `Add(^uint64(0))` will decrement activeConnections
		s.stats.activeConnections.Add(^uint64(0))
		if s.connStatusCallback != nil {
			go s.connStatusCallback(false, conn.host, conn.origin)
		}

		// check for stream close conditions before reconnect attempts
		if ctxErr := s.streamCtx.Err(); ctxErr != nil || s.closed.Load() {
			if ctxErr != nil {
				s.config.logInfo(
					"client: stream websocket %s context done: %s",
					conn.origin, s.streamCtx.Err(),
				)
				conn.close()
			}
			return
		}

		// reconnect protocol
		if s.stats.activeConnections.Load() == 0 {
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

		re, err := s.newWSconnWithRetry(conn.origin)
		if err != nil {
			s.closeError.CompareAndSwap(nil, fmt.Errorf("stream has no active connections, last error: %w", err))
			s.Close()
			return
		}
		conn.replace(re.conn)
		if s.connStatusCallback != nil {
			go s.connStatusCallback(true, conn.host, conn.origin)
		}
		s.config.logInfo(
			"client: stream websocket %s: reconnected",
			conn.origin,
		)
	}
}

func (s *stream) newWSconnWithRetry(origin string) (conn *wsConn, err error) {
	// reconnect loop
	// will try to reconnect until client is closed or
	// we have no active connections and have exceeded maxWSReconnectAttempts
	var attempts int
	for {
		if s.closed.Load() || s.streamCtx.Err() != nil {
			return nil, fmt.Errorf("Retry cancelled, stream is closed")
		}

		// fail the stream if we are over the maxWSReconnectAttempts
		// and there are no other active connection
		if attempts >= s.config.WsMaxReconnect && s.stats.activeConnections.Load() == 0 {
			return nil, err
		}
		attempts++

		ctx, cancel := context.WithTimeout(context.Background(), defaultWSConnectTimeout)
		conn, err = s.newWSconn(ctx, origin)
		cancel()

		if err != nil {
			interval := time.Millisecond * time.Duration(
				rand.Intn(maxWSReconnectIntervalMIllis-minWSReconnectIntervalMillis)+minWSReconnectIntervalMillis) //nolint:gosec
			s.config.logInfo(
				"client: stream websocket %s: error reconnecting: %s, backing off: %s",
				origin, err, interval.String(),
			)
			time.Sleep(interval)
			continue
		}
		return conn, nil
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
	s.streamCtxCancel()
	// this lock ensures websocket readers stop in a safe spot for closing
	s.closingMutex.Lock()
	defer s.closingMutex.Unlock()

	for x := 0; x < len(s.conns); x++ {
		_ = s.conns[x].close()
	}
	close(s.output)
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
	host   string
	origin string
	conn   *websocket.Conn
}

func (ws *wsConn) close() (err error) {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	return ws.conn.CloseNow()
}

func (ws *wsConn) read(ctx context.Context, closingMutex *sync.RWMutex, accept func(context.Context, *message) error) (err error) {
	var lastErr error
	for {
		// coordinates with a potential Close function call from client
		closingMutex.RLock()
		_, b, err := ws.conn.Read(ctx)
		if err != nil {
			lastErr = err
			break
		}

		m := &message{}
		if err = json.Unmarshal(b, m); err != nil {
			lastErr = err
			break
		}

		if err = accept(ctx, m); err != nil {
			lastErr = err
			break
		}
		closingMutex.RUnlock()
	}
	closingMutex.RUnlock()
	return lastErr
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
		host:   reqURL.Host,
		origin: origin,
		conn:   conn,
	}

	return ws, nil
}
