/**
 * WebSocket connection constants
 */
export const WS_CONSTANTS = {
  /** Maximum time to wait for connection in milliseconds */
  CONNECT_TIMEOUT: 5000,
  /** Ping interval in milliseconds */
  PING_INTERVAL: 30000,
  /** Time to wait for pong response in milliseconds */
  PONG_TIMEOUT: 5000,
  /** Maximum reconnection attempts */
  MAX_RECONNECTS: 5,
  /** Base delay between reconnection attempts in milliseconds */
  RECONNECT_DELAY: 1000,
  /** Maximum delay between reconnection attempts in milliseconds */
  MAX_RECONNECT_INTERVAL: 10000,
} as const;

/**
 * Regular expressions for validation
 */
export const VALIDATION_REGEX = {
  /** Matches valid feed IDs (0x followed by 64 hex characters) */
  FEED_ID: /^0x[0-9a-fA-F]{64}$/,
  /** Matches valid schema versions (0x0002-0x0009, 0x000a, 0x000d) */
  SCHEMA_VERSION: /^0x000([2-9]|a|b|c|d)$/,
} as const;

// Request timeout constants
export const DEFAULT_TIMEOUT = 30000; // 30 seconds
export const DEFAULT_RETRY_DELAY = 1000; // 1 second
export const DEFAULT_RETRY_ATTEMPTS = 1;

// HA Mode Constants
export const X_CLL_AVAILABLE_ORIGINS_HEADER = "X-Cll-Available-Origins";
export const X_CLL_ORIGIN_HEADER = "X-Cll-Origin";
