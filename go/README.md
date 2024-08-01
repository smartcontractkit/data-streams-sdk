

# streams
`import "github.com/smartcontractkit/data-streams-sdk/go"`

* [Overview](#pkg-overview)
* [Index](#pkg-index)
* [Examples](#pkg-examples)
* [Subdirectories](#pkg-subdirectories)

## <a name="pkg-overview">Overview</a>
Package streams implements a client library for the Data Streams API providing
a domain oriented abstraction for both report Streams and point in time
retrieval with fault tolerant capabilities.




## <a name="pkg-index">Index</a>
* [Variables](#pkg-variables)
* [func LogPrintf(format string, a ...any)](#LogPrintf)
* [type Client](#Client)
  * [func New(cfg Config) (c Client, err error)](#New)
* [type Config](#Config)
* [type CtxKey](#CtxKey)
* [type ReportPage](#ReportPage)
* [type ReportResponse](#ReportResponse)
  * [func (r *ReportResponse) MarshalJSON() ([]byte, error)](#ReportResponse.MarshalJSON)
  * [func (r *ReportResponse) String() (s string)](#ReportResponse.String)
  * [func (r *ReportResponse) UnmarshalJSON(b []byte) (err error)](#ReportResponse.UnmarshalJSON)
* [type Stats](#Stats)
  * [func (s Stats) String() (st string)](#Stats.String)
* [type Stream](#Stream)

#### <a name="pkg-examples">Examples</a>
* [Client](#example-client)
* [Stream](#example-stream)

#### <a name="pkg-files">Package files</a>
[auth.go](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/auth.go) [client.go](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/client.go) [config.go](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/config.go) [doc.go](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/doc.go) [endpoints.go](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/endpoints.go) [stream.go](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/stream.go)



## <a name="pkg-variables">Variables</a>
``` go
var (
    ErrStreamClosed = fmt.Errorf("client: use of closed Stream")
)
```


## <a name="LogPrintf">func</a> [LogPrintf](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/client.go?s=1087:1126#L39)
``` go
func LogPrintf(format string, a ...any)
```
LogPrintf implements a LogFunction using fmt.Printf




## <a name="Client">type</a> [Client](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/client.go?s=267:1030#L21)
``` go
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
}
```
Client is the data streams client interface.



##### Example Client:
``` go
cfg := streams.Config{
    ApiKey:    "mykey",
    ApiSecret: "mysecret",
    RestURL:   "https://streams.url",
    WsURL:     "https://streams.url",
    Logger:    streams.LogPrintf,
}

streamsClient, err := streams.New(cfg)
if err != nil {
    streams.LogPrintf("error creating client: %s", err)
    os.Exit(1)
}

ctx, cancel := context.WithTimeout(context.Background(), time.Second)
availableFeeds, err := streamsClient.GetFeeds(ctx)
cancel()
if err != nil {
    streams.LogPrintf("error fetching feeds: %s", err)
    os.Exit(1)
}

f := availableFeeds[0]
ctx, cancel = context.WithTimeout(context.Background(), time.Second)
report, err := streamsClient.GetLatestReport(ctx, f.FeedID)
cancel()
if err != nil {
    streams.LogPrintf("error fetching latest report: %s", err)
    os.Exit(1)
}

streams.LogPrintf("report feedID: %s, observations_timestamp: %d, valid_from_timestamp: %d",
    report.FeedID, report.ObservationsTimestamp, report.ValidFromTimestamp)

ctx, cancel = context.WithTimeout(context.Background(), time.Second)
reports, err := streamsClient.GetReports(
    ctx, []feed.ID{availableFeeds[0].FeedID, availableFeeds[1].FeedID}, uint64(time.Now().Unix())-3)
cancel()
if err != nil {
    streams.LogPrintf("error fetching reports: %s", err)
    os.Exit(1)
}

for _, report = range reports {
    decoded, err := streamsReport.Decode[v3.Data](report.FullReport)
    if err != nil {
        streams.LogPrintf("error decoding decoded: %s", err)
        os.Exit(1)
    }

    streams.LogPrintf("report feedID: %s, observations_timestamp: %d, valid_from_timestamp: %d",
        report.FeedID, report.ObservationsTimestamp, report.ValidFromTimestamp)
    streams.LogPrintf(
        "FeedID: %s, FeedVersion: %d, Bid: %s, Ask: %s, BenchMark: %s, LinkFee: %s, NativeFee: %s, ValidFromTS: %d, ExpiresAt: %d",
        decoded.Data.FeedID.String(),
        decoded.Data.FeedID.Version(),
        decoded.Data.Bid.String(),
        decoded.Data.Ask.String(),
        decoded.Data.BenchmarkPrice.String(),
        decoded.Data.LinkFee.String(),
        decoded.Data.NativeFee.String(),
        decoded.Data.ValidFromTimestamp,
        decoded.Data.ExpiresAt,
    )
}
```





### <a name="New">func</a> [New](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/client.go?s=1412:1454#L52)
``` go
func New(cfg Config) (c Client, err error)
```
New creates a new Client with the given config.
New does not initialize any connection to the Data Streams service.





## <a name="Config">type</a> [Config](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/config.go?s=202:1276#L10)
``` go
type Config struct {
    ApiKey    string // Client Api key
    ApiSecret string // Client Api secret
    RestURL   string // Rest Api url

    WsURL string // Websocket Api url

    WsHA               bool                          // Use concurrent connections to multiple Streams servers
    WsMaxReconnect     int                           // Maximum number of reconnection attempts for Stream underlying connections
    LogDebug           bool                          // Log debug information
    InsecureSkipVerify bool                          // Skip server certificate chain and host name verification
    Logger             func(format string, a ...any) // Logger function

    // InspectHttp intercepts http responses for rest requests.
    // The response object must not be modified.
    InspectHttpResponse func(*http.Response)
    // contains filtered or unexported fields
}

```
Config specifies the client configuration and dependencies.
If specified the Logger function will be used to log informational client activity.










## <a name="CtxKey">type</a> [CtxKey](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/endpoints.go?s=1179:1197#L30)
``` go
type CtxKey string
```
CtxKey type for context values


``` go
const (

    // CustomHeadersCtxKey is used as key in the context.Context object
    // to pass in a custom http headers in a http.Header to be used by the client.
    // Custom header values will overwrite client headers if they have the same key.
    CustomHeadersCtxKey CtxKey = "CustomHeaders"
)
```









## <a name="ReportPage">type</a> [ReportPage](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/client.go?s=2462:2537#L93)
``` go
type ReportPage struct {
    Reports    []*ReportResponse
    NextPageTS uint64
}

```
ReportPage implements the server pagination response.
NextPageTS is the timestamp to be used when requesting the next page.










## <a name="ReportResponse">type</a> [ReportResponse](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/client.go?s=3769:4018#L140)
``` go
type ReportResponse struct {
    FeedID                feed.ID `json:"feedID"`
    FullReport            []byte  `json:"fullReport"`
    ValidFromTimestamp    uint64  `json:"validFromTimestamp"`
    ObservationsTimestamp uint64  `json:"observationsTimestamp"`
}

```
ReportResponse implements the report envelope that contains the full report payload,
its FeedID and timestamps. For decoding the Report Payload use report.Decode().










### <a name="ReportResponse.MarshalJSON">func</a> (\*ReportResponse) [MarshalJSON](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/client.go?s=4426:4480#L171)
``` go
func (r *ReportResponse) MarshalJSON() ([]byte, error)
```



### <a name="ReportResponse.String">func</a> (\*ReportResponse) [String](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/client.go?s=4683:4727#L182)
``` go
func (r *ReportResponse) String() (s string)
```



### <a name="ReportResponse.UnmarshalJSON">func</a> (\*ReportResponse) [UnmarshalJSON](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/client.go?s=4020:4080#L147)
``` go
func (r *ReportResponse) UnmarshalJSON(b []byte) (err error)
```



## <a name="Stats">type</a> [Stats](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/stream.go?s=1235:1758#L54)
``` go
type Stats struct {
    Accepted              uint64 // Total number of accepted reports
    Deduplicated          uint64 // Total number of deduplicated reports when in HA
    TotalReceived         uint64 // Total number of received reports
    PartialReconnects     uint64 // Total number of partial reconnects when in HA
    FullReconnects        uint64 // Total number of full reconnects
    ConfiguredConnections uint64 // Number of configured connections if in HA
    ActiveConnections     uint64 // Current number of active connections
}

```
Stats for the Stream










### <a name="Stats.String">func</a> (Stats) [String](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/stream.go?s=1760:1795#L64)
``` go
func (s Stats) String() (st string)
```



## <a name="Stream">type</a> [Stream](https://github.com/smartcontractkit/data-streams-sdk/tree/master/go/stream.go?s=777:1209#L39)
``` go
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
```
Stream represents a realtime report stream.
Safe for concurrent usage.

The Stream will maintain at least 2 concurrent connections to different instances
to ensure high availability, fault tolerance and minimize the risk of report gaps.



##### Example Stream:
``` go
cfg := streams.Config{
    ApiKey:    "mykey",
    ApiSecret: "mysecret",
    RestURL:   "https://streams.url",
    WsURL:     "https://streams.url",
    Logger:    streams.LogPrintf,
}

client, err := streams.New(cfg)
if err != nil {
    streams.LogPrintf("error creating client: %s", err)
    os.Exit(1)
}

ctx, cancel := context.WithTimeout(context.Background(), time.Second)
availableFeeds, err := client.GetFeeds(ctx)
cancel()
if err != nil {
    streams.LogPrintf("error fetching feeds: %s", err)
    os.Exit(1)
}

ctx, cancel = context.WithTimeout(context.Background(), time.Second)
stream, err := client.Stream(
    ctx, []feed.ID{availableFeeds[0].FeedID, availableFeeds[1].FeedID})
cancel()
if err != nil {
    streams.LogPrintf("error subscribing: %s", err)
    os.Exit(1)
}

defer stream.Close()
for stream.Stats().Accepted < 100 {
    report, err := stream.Read(context.Background())
    if err != nil {
        streams.LogPrintf("error reading from stream: %s", err)
        os.Exit(1)
    }

    streams.LogPrintf("report feedID: %s, observations_timestamp: %d, valid_from_timestamp: %d",
        report.FeedID, report.ObservationsTimestamp, report.ValidFromTimestamp)

    decoded, err := streamsReport.Decode[v3.Data](report.FullReport)
    if err != nil {
        streams.LogPrintf("error decoding decoded: %s", err)
        os.Exit(1)
    }

    streams.LogPrintf(
        "FeedID: %s, FeedVersion: %d, Bid: %s, Ask: %s, BenchMark: %s, LinkFee: %s, NativeFee: %s, ValidFromTS: %d, ExpiresAt: %d",
        decoded.Data.FeedID.String(),
        decoded.Data.FeedID.Version(),
        decoded.Data.Bid.String(),
        decoded.Data.Ask.String(),
        decoded.Data.BenchmarkPrice.String(),
        decoded.Data.LinkFee.String(),
        decoded.Data.NativeFee.String(),
        decoded.Data.ValidFromTimestamp,
        decoded.Data.ExpiresAt,
    )

    streams.LogPrintf("stream stats: %s", stream.Stats().String())
}
```












- - -
Generated by [godoc2md](http://godoc.org/github.com/davecheney/godoc2md)
