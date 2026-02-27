package streams

import (
	"runtime/debug"
	"strings"
	"sync"
)

const modulePath = "github.com/smartcontractkit/data-streams-sdk/go"

func matchesModule(path string) bool {
	return path == modulePath || strings.HasPrefix(path, modulePath+"/v")
}

// userAgent returns this Go SDK version and is appended to the User-Agent header for all requests.
// this is wrapped in sync.OnceValue to avoid repeated expensive calls to debug.ReadBuildInfo.
var userAgent = sync.OnceValue(func() string {
	version := "unknown"
	bi, ok := debug.ReadBuildInfo()
	if ok {
		for _, dep := range bi.Deps {
			if matchesModule(dep.Path) {
				version = dep.Version
				break
			}
		}
	}
	return "data-streams-sdk-go/" + version
})
