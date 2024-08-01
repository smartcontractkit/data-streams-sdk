package streams

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
)

func generateHMAC(method string, path string, body []byte, clientId string, timestamp int64, userSecret string) string {
	serverBodyHash := sha256.New()
	serverBodyHash.Write(body)
	serverBodyHashString := fmt.Sprintf("%s %s %s %s %d",
		method,
		path,
		hex.EncodeToString(serverBodyHash.Sum(nil)),
		clientId,
		timestamp)
	signedMessage := hmac.New(sha256.New, []byte(userSecret))
	signedMessage.Write([]byte(serverBodyHashString))
	userHmac := hex.EncodeToString(signedMessage.Sum(nil))
	return userHmac
}

func generateAuthHeaders(h http.Header, method string, path string, body []byte, clientId string, userSecret string, timestamp int64) {
	hmacString := generateHMAC(method, path, body, clientId, timestamp, userSecret)
	h.Add(authzHeader, clientId)
	h.Add(authzTSHeader, strconv.FormatInt(timestamp, 10))
	h.Add(authzSigHeader, hmacString)
}
