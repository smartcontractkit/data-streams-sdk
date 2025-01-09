package streams

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/smartcontractkit/data-streams-sdk/go/feed"
)

// Client is the data streams client interface.
type Client interface {
	// GetFeeds lists all feeds available to this client.
	GetFeeds(ctx context.Context) (r []*feed.Feed, err error)

	// GetLatestReport fetches the latest report available for the given feedID.
	GetLatestReport(ctx context.Context, id feed.ID) (r *ReportResponse, err error)

	// GetReports fetches the reports for the given feedIDs and timestamp.
	GetReports(ctx context.Context, ids []feed.ID, timestamp uint64) ([]*ReportResponse, error)

	// GetReportPage paginates the reports for the given feedID and start timestamp.
	GetReportPage(ctx context.Context, id feed.ID, startTS uint64) (*ReportPage, error)

	// Stream creates realtime report stream for the given feedIDs.
	Stream(ctx context.Context, feedIDs []feed.ID) (Stream, error)

	// Stream creates realtime report stream for the given feedIDs.
	StreamWithStatusCallback(ctx context.Context, feedIDs []feed.ID,
		connStatusCallback func(isConnected bool, host string, origin string)) (Stream, error)
}

// LogPrintf implements a LogFunction using fmt.Printf
func LogPrintf(format string, a ...any) {
	fmt.Printf(time.Now().Format(time.RFC3339)+" "+format+"\n", a...)
}

var _ Client = (*client)(nil)

type client struct {
	config Config
	http   *http.Client
}

// New creates a new Client with the given config.
// New does not initialize any connection to the Data Streams service.
func New(cfg Config) (c Client, err error) {
	if cfg.RestURL == "" && cfg.WsURL == "" {
		return nil, fmt.Errorf("client: no server url provided")
	}

	if cfg.restURL, err = url.Parse(cfg.RestURL); err != nil {
		return nil, fmt.Errorf("client: error parsing rest URL: %w", err)
	}

	if cfg.wsURL, err = url.Parse(cfg.WsURL); err != nil {
		return nil, fmt.Errorf("client: error parsing websocket URL: %w", err)
	}

	if cfg.ApiKey == "" {
		return nil, fmt.Errorf("client: empty api key")
	}

	if cfg.ApiSecret == "" {
		return nil, fmt.Errorf("client: empty api secret")
	}

	if cfg.WsMaxReconnect == 0 {
		cfg.WsMaxReconnect = maxWSReconnectAttempts
	}

	c = &client{
		config: cfg,
		http: &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					// disable linting since this is intentional
					InsecureSkipVerify: cfg.InsecureSkipVerify}, //nolint:gosec
			},
		},
	}

	return c, nil
}

// ReportPage implements the server pagination response.
// NextPageTS is the timestamp to be used when requesting the next page.
type ReportPage struct {
	Reports    []*ReportResponse
	NextPageTS uint64
}

func (c *client) Stream(ctx context.Context, ids []feed.ID) (s Stream, err error) {
	return c.StreamWithStatusCallback(ctx, ids, nil)
}

func (c *client) StreamWithStatusCallback(ctx context.Context, ids []feed.ID,
	connStatusCallback func(isConnected bool, host string, origin string)) (s Stream, err error) {
	var origins []string

	// Only fetch origins if websocket high availability mode is enabled
	if c.config.WsHA {
		h, err := c.serverHeaders(ctx, c.config.wsURL)
		if err != nil {
			c.config.logInfo("client: Unable to retrieve server headers, error: %w", err)
			// Return nil if the context has been timed out or been canceled
			if ctx.Err() != nil {
				return nil, err
			}
		}

		origins = extractOrigins(h)
		if origins == nil {
			c.config.logInfo("client: no origins found, the websocket connections are not running in HA mode")
		}
	}

	return c.newStream(ctx, c.http, ids, origins, connStatusCallback)
}

func (c *client) GetLatestReport(ctx context.Context, id feed.ID) (r *ReportResponse, err error) {
	type response struct {
		Report *ReportResponse `json:"report"`
	}

	resp := &response{}
	req := &request{
		method: http.MethodGet,
		path:   apiV1ReportsLatest,
		params: url.Values{
			"feedID": {id.String()},
		},
	}
	err = c.rest(ctx, req, resp)
	if err == nil && resp.Report == nil {
		err = errors.New("client: response data error: latest report object not found")
	}
	return resp.Report, err
}

// ReportResponse implements the report envelope that contains the full report payload,
// its FeedID and timestamps. For decoding the Report Payload use report.Decode().
type ReportResponse struct {
	FeedID                feed.ID `json:"feedID"`
	FullReport            []byte  `json:"fullReport"`
	ValidFromTimestamp    uint64  `json:"validFromTimestamp"`
	ObservationsTimestamp uint64  `json:"observationsTimestamp"`
}

func (r *ReportResponse) UnmarshalJSON(b []byte) (err error) {
	type Alias ReportResponse
	aux := &struct {
		FullReport string `json:"fullReport"`
		*Alias
	}{
		Alias: (*Alias)(r),
	}

	if err := json.Unmarshal(b, aux); err != nil {
		return err
	}

	if len(aux.FullReport) < 3 {
		return nil
	}

	if r.FullReport, err = hex.DecodeString(aux.FullReport[2:]); err != nil {
		return nil
	}

	return nil
}

func (r *ReportResponse) MarshalJSON() ([]byte, error) {
	type Alias ReportResponse
	return json.Marshal(&struct {
		FullReport string `json:"fullReport"`
		*Alias
	}{
		FullReport: "0x" + hex.EncodeToString(r.FullReport),
		Alias:      (*Alias)(r),
	})
}

func (r *ReportResponse) String() (s string) {
	b, _ := r.MarshalJSON()
	return string(b)
}

type reportsResponse struct {
	Reports []*ReportResponse `json:"reports"`
}

func feedIdsToStringList(ids []feed.ID) (s []string) {
	s = make([]string, len(ids))
	for x := 0; x < len(ids); x++ {
		s[x] = ids[x].String()
	}
	return s
}

func (c *client) GetReports(ctx context.Context, ids []feed.ID, ts uint64) (r []*ReportResponse, err error) {
	rs := &reportsResponse{}
	req := &request{
		method: http.MethodGet,
		path:   apiV1ReportsBulk,
		params: url.Values{
			"timestamp": {strconv.FormatUint(ts, 10)},
			"feedIDs":   {strings.Join(feedIdsToStringList(ids), ",")},
		},
	}

	err = c.rest(ctx, req, &rs)
	if err == nil && rs.Reports == nil {
		err = errors.New("client: response data error: reports list not found")
	}
	return rs.Reports, err
}

func (c *client) GetReportPage(ctx context.Context, id feed.ID, pageTS uint64) (r *ReportPage, err error) {
	r = &ReportPage{}
	req := &request{
		method: http.MethodGet,
		path:   apiV1ReportsPage,
		params: url.Values{
			"feedID":         {id.String()},
			"startTimestamp": {strconv.FormatUint(pageTS, 10)},
		},
	}
	err = c.rest(ctx, req, r)
	if err == nil && r.Reports == nil {
		err = errors.New("client: response data error: reports page list not found")
	}
	r.NextPageTS = 0
	if len(r.Reports) > 0 {
		r.NextPageTS = r.Reports[len(r.Reports)-1].ObservationsTimestamp + 1
	}
	return r, err
}

type feedsResponse struct {
	Feeds []*feed.Feed `json:"feeds"`
}

func (c *client) GetFeeds(ctx context.Context) (r []*feed.Feed, err error) {

	resp := &feedsResponse{}
	req := &request{
		method: http.MethodGet,
		path:   apiV1Feeds,
	}
	err = c.rest(ctx, req, resp)
	if err == nil && resp.Feeds == nil {
		err = errors.New("client: response data error: feeds list not found")
	}
	return resp.Feeds, err
}

type request struct {
	method string
	path   string
	params url.Values
	body   []byte
}

func (c *client) rest(ctx context.Context, d *request, dst interface{}) (err error) {
	reqURL := c.config.restURL.ResolveReference(&url.URL{Path: d.path})
	if d.params != nil {
		reqURL.RawQuery = d.params.Encode()
	}

	var req *http.Request
	req, err = http.NewRequestWithContext(ctx, d.method, reqURL.String(), bytes.NewReader(d.body))
	if err != nil {
		return err
	}

	generateAuthHeaders(req.Header, req.Method, reqURL.RequestURI(), d.body,
		c.config.ApiKey, c.config.ApiSecret, time.Now().UnixMilli())

	if value := ctx.Value(CustomHeadersCtxKey); value != nil {
		if h, ok := value.(http.Header); ok {
			for k, v := range h {
				switch {
				// See https://github.com/golang/go/blob/7dff743/src/net/http/request.go#L98
				case k == hostHeader:
					req.Host = v[0]
				default:
					req.Header.Add(k, v[0])
				}
			}
		}
	}

	c.config.logDebug(
		"client rest request url: %s, method: %s, query: %s headers: %s, body: %s",
		req.URL.String(), req.Method, req.URL.Query().Encode(), req.Header, string(d.body))

	var resp *http.Response
	resp, err = c.http.Do(req)
	if err != nil {
		return fmt.Errorf("client: error performing http request: %w", err)
	}

	buf, err := io.ReadAll(resp.Body)
	resp.Body.Close()

	// defer inspect if enabled with a bytes.Reader from the read above.
	// do this before checking for read errors to ensure the response gets inspected.
	// If an error is caught and `buf` is nil, the reader will return io.EOF
	if c.config.InspectHttpResponse != nil {
		// Reset the response body, so it can be read again by InspectHttpResponse if needed
		resp.Body = io.NopCloser(bytes.NewReader(buf))
		defer c.config.InspectHttpResponse(resp)
	}

	if resp.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("client: http status code: %d, response body %s", resp.StatusCode, string(buf))
	}

	// check for body read errors
	if err != nil {
		return fmt.Errorf("client: error reading response body: %w", err)
	}

	if err = json.Unmarshal(buf, dst); err != nil {
		return fmt.Errorf("client: deserializing response error: %w, body: %s", err, string(buf))
	}

	return nil
}

func (c *client) serverHeaders(ctx context.Context, u *url.URL) (h http.Header, err error) {
	reqURL := u.ResolveReference(&url.URL{Path: "/"})
	// HEAD method doesn't support 'ws' or 'wss' scheme
	switch reqURL.Scheme {
	case "ws":
		reqURL.Scheme = "http"
	case "wss":
		reqURL.Scheme = "https"
	default:
	}

	var req *http.Request
	req, err = http.NewRequestWithContext(ctx, http.MethodHead, reqURL.String(), nil)
	if err != nil {
		return nil, err
	}

	generateAuthHeaders(req.Header, req.Method, reqURL.RequestURI(), nil,
		c.config.ApiKey, c.config.ApiSecret, time.Now().UnixMilli())

	c.config.logDebug(
		"client headers request url: %s, method: %s, query: %s headers: %s",
		req.URL.String(), req.Method, req.URL.Query().Encode(), req.Header)

	var resp *http.Response
	resp, err = c.http.Do(req)
	if err != nil {
		c.config.logDebug("client headers request error: %s", err)
		return nil, err
	}

	defer resp.Body.Close()
	c.config.logDebug("client headers response: %s", resp.Header)
	return resp.Header, nil
}

func extractOrigins(h http.Header) (origins []string) {
	if len(h) == 0 {
		return nil
	}

	o := h.Get(cllAvailOriginsHeader)
	if o == "" {
		return nil
	}

	if o[0] == '{' {
		o = o[1:]
	}

	if o[len(o)-1] == '}' {
		o = o[:len(o)-1]
	}

	return strings.Split(o, ",")
}
