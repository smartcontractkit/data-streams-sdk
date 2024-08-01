package streams

import "net/textproto"

const (
	apiV1WS            = "/api/v1/ws"
	apiV1Feeds         = "/api/v1/feeds"
	apiV1Reports       = "/api/v1/reports"
	apiV1ReportsBulk   = "/api/v1/reports/bulk"
	apiV1ReportsPage   = "/api/v1/reports/page"
	apiV1ReportsLatest = "/api/v1/reports/latest"

	// CustomHeadersCtxKey is used as key in the context.Context object
	// to pass in a custom http headers in a http.Header to be used by the client.
	// Custom header values will overwrite client headers if they have the same key.
	CustomHeadersCtxKey CtxKey = "CustomHeaders"
)

var (
	cllAvailOriginsHeader = textproto.CanonicalMIMEHeaderKey("X-Cll-Available-Origins")
	cllOriginHeader       = textproto.CanonicalMIMEHeaderKey("X-Cll-Origin")
	cllIntHeader          = textproto.CanonicalMIMEHeaderKey("X-Cll-Eng-Int")
	authzHeader           = textproto.CanonicalMIMEHeaderKey("Authorization")
	authzTSHeader         = textproto.CanonicalMIMEHeaderKey("X-Authorization-Timestamp")
	authzSigHeader        = textproto.CanonicalMIMEHeaderKey("X-Authorization-Signature-SHA256")
	hostHeader            = textproto.CanonicalMIMEHeaderKey("Host")
)

// CtxKey type for context values
type CtxKey string
