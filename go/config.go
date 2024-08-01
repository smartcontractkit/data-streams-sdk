package streams

import (
	"net/http"
	"net/url"
)

// Config specifies the client configuration and dependencies.
// If specified the Logger function will be used to log informational client activity.
type Config struct {
	ApiKey             string                        // Client Api key
	ApiSecret          string                        // Client Api secret
	RestURL            string                        // Rest Api url
	restURL            *url.URL                      // Rest Api url
	WsURL              string                        // Websocket Api url
	wsURL              *url.URL                      // Websocket Api url
	WsHA               bool                          // Use concurrent connections to multiple Streams servers
	WsMaxReconnect     int                           // Maximum number of reconnection attempts for Stream underlying connections
	LogDebug           bool                          // Log debug information
	InsecureSkipVerify bool                          // Skip server certificate chain and host name verification
	Logger             func(format string, a ...any) // Logger function

	// InspectHttp intercepts http responses for rest requests.
	// The response object must not be modified.
	InspectHttpResponse func(*http.Response)
}

func (c Config) logInfo(format string, a ...any) {
	if c.Logger != nil {
		c.Logger(format, a...)
	}
}

func (c Config) logDebug(format string, a ...any) {
	if c.Logger != nil && c.LogDebug {
		c.Logger(format, a...)
	}
}
