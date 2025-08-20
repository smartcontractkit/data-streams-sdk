import { X_CLL_AVAILABLE_ORIGINS_HEADER, WS_CONSTANTS } from "./constants";
import { generateAuthHeaders } from "./auth";
import { OriginDiscoveryError, InsufficientConnectionsError } from "../types/errors";
import { SDKLogger } from "./logger";

/**
 * Parses comma-separated WebSocket URLs
 * @param wsUrl Comma-separated WebSocket URLs like "wss://url1,wss://url2"
 * @returns Array of individual WebSocket URLs
 */
export function parseCommaSeparatedUrls(wsUrl: string): string[] {
  return wsUrl
    .split(",")
    .map(url => url.trim())
    .filter(url => url.length > 0);
}

/**
 * Converts WebSocket URL scheme to HTTP for HEAD requests
 * @param wsUrl WebSocket URL (ws:// or wss://)
 * @returns HTTP URL (http:// or https://)
 */
export function convertWebSocketToHttpScheme(wsUrl: string): string {
  if (wsUrl.startsWith("wss://")) {
    return wsUrl.replace("wss://", "https://");
  } else if (wsUrl.startsWith("ws://")) {
    return wsUrl.replace("ws://", "http://");
  }
  return wsUrl; // Already HTTP/HTTPS
}

/**
 * Parses the X-Cll-Available-Origins header value
 * @param headerValue Raw header value like "{origin1,origin2}" or "origin1,origin2"
 * @returns Array of origin URLs
 */
export function parseOriginsHeader(headerValue: string): string[] {
  if (!headerValue) {
    return [];
  }

  let cleaned = headerValue.trim();

  // Remove surrounding brackets if present
  if (cleaned.startsWith("{")) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.endsWith("}")) {
    cleaned = cleaned.slice(0, -1);
  }

  return cleaned
    .split(",")
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
}

/**
 * Discovers available origins via HEAD request
 * @param baseUrl Base WebSocket URL to discover origins for
 * @param apiKey API key for authentication
 * @param userSecret User secret for authentication
 * @param timeout Request timeout in milliseconds
 * @returns Promise resolving to array of discovered origin URLs
 */
export async function discoverOrigins(
  baseUrl: string,
  apiKey: string,
  userSecret: string,
  timeout: number = WS_CONSTANTS.CONNECT_TIMEOUT,
  logger?: SDKLogger
): Promise<string[]> {
  logger?.debug(`Starting origin discovery for ${baseUrl}`);

  try {
    // Convert WebSocket URL to HTTP for HEAD request
    const httpUrl = convertWebSocketToHttpScheme(baseUrl);
    logger?.debug(`Converted WebSocket URL to HTTP: ${httpUrl}`);
    const url = new URL("/", httpUrl);

    // Generate authentication headers
    const headers = generateAuthHeaders(apiKey, userSecret, "HEAD", url.toString());

    // Make HEAD request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url.toString(), {
        method: "HEAD",
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Extract and parse origins header
      const originsHeader = response.headers.get(X_CLL_AVAILABLE_ORIGINS_HEADER);
      if (!originsHeader) {
        logger?.info("No origins header found in response");
        return []; // No origins available
      }

      const origins = parseOriginsHeader(originsHeader);
      logger?.info(`Origin discovery successful: found ${origins.length} origins`);
      return origins;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    logger?.error(`Origin discovery failed for ${baseUrl}:`, error);
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new OriginDiscoveryError(`Origin discovery timed out after ${timeout}ms`, error);
      }
      throw new OriginDiscoveryError(`Failed to discover origins: ${error.message}`, error);
    }
    throw new OriginDiscoveryError("Unknown error during origin discovery");
  }
}

/**
 * Gets available origins using both static and dynamic discovery
 * @param wsUrl WebSocket URL (may be comma-separated)
 * @param apiKey API key for authentication
 * @param userSecret User secret for authentication
 * @param haEnabled Whether High Availability mode is enabled
 * @param timeout Request timeout in milliseconds
 * @returns Promise resolving to array of available origin URLs
 */
export async function getAvailableOrigins(
  wsUrl: string,
  apiKey: string,
  userSecret: string,
  haEnabled: boolean = true,
  timeout: number = WS_CONSTANTS.CONNECT_TIMEOUT,
  logger?: SDKLogger
): Promise<string[]> {
  logger?.debug(`Getting available origins for ${wsUrl}, dynamic discovery: ${haEnabled}`);

  // First, parse any comma-separated URLs
  const staticOrigins = parseCommaSeparatedUrls(wsUrl);
  logger?.debug(`Found ${staticOrigins.length} static origins`);

  // If dynamic discovery is disabled or we have multiple static origins, use static
  if (!haEnabled || staticOrigins.length > 1) {
    logger?.info(`Using static origins: ${staticOrigins.join(", ")}`);
    return staticOrigins;
  }

  try {
    // Attempt dynamic discovery
    const dynamicOrigins = await discoverOrigins(
      staticOrigins[0], // Use first URL as base for discovery
      apiKey,
      userSecret,
      timeout,
      logger
    );

    // Use dynamic origins if available, otherwise fall back to static
    let finalOrigins = dynamicOrigins.length > 0 ? dynamicOrigins : staticOrigins;

    if (dynamicOrigins.length > 0 && !dynamicOrigins[0].startsWith("ws")) {
      const baseUrl = staticOrigins[0];
      finalOrigins = dynamicOrigins.map(originId => `${baseUrl}#${originId}`);
    }

    // Validate we have at least one origin (both SDKs fail with 0 connections)
    if (finalOrigins.length === 0) {
      throw new InsufficientConnectionsError(
        "No origins available for connection",
        0, // availableConnections
        1 // requiredConnections (minimum to operate)
      );
    }

    logger?.info(`Dynamic discovery completed: ${finalOrigins.length} origins available`);
    return finalOrigins;
  } catch (error) {
    logger?.warn(`Dynamic discovery failed, falling back to static origins:`, error);
    // If dynamic discovery fails, fall back to static origins

    // Validate static origins are sufficient
    if (staticOrigins.length === 0) {
      throw new InsufficientConnectionsError(
        "No origins available for connection after discovery failure",
        0, // availableConnections
        1 // requiredConnections (minimum to operate)
      );
    }

    return staticOrigins;
  }
}
