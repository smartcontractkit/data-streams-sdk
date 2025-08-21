import { createHash, createHmac } from "crypto";

/**
 * Generate authentication headers for a request
 * @param apiKey API key (UUID) for authentication
 * @param userSecret User secret for signing
 * @param method HTTP method
 * @param url Full URL of the request
 * @param body Request body (if any)
 * @param timestamp Optional timestamp for testing (milliseconds since epoch)
 * @returns Authentication headers
 */
export function generateAuthHeaders(
  apiKey: string,
  userSecret: string,
  method: string,
  url: string,
  body?: string,
  timestamp?: number
): Record<string, string> {
  const ts = timestamp || Date.now();
  const pathWithQuery = new URL(url).pathname + new URL(url).search;
  const bodyHash = createHash("sha256")
    .update(body || "")
    .digest("hex");

  const hmacBaseString = `${method} ${pathWithQuery} ${bodyHash} ${apiKey} ${ts}`;
  const hmac = createHmac("sha256", userSecret);
  const signature = hmac.update(hmacBaseString).digest("hex");

  return {
    Authorization: apiKey,
    "X-Authorization-Timestamp": ts.toString(),
    "X-Authorization-Signature-SHA256": signature,
  };
}
