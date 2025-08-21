import { Report, Feed } from "./report";
import { LoggingConfig } from "./logger";
import { MetricsSnapshot } from "./metrics";

// Forward declare types to avoid circular imports
export interface StreamOptions {
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface IStream {
  on(event: "report", listener: (report: Report) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "disconnected", listener: () => void): this;
  on(
    event: "reconnecting",
    listener: (info: { attempt: number; delayMs: number; origin?: string; host?: string }) => void
  ): this;
  on(event: string, listener: (...args: any[]) => void): this;
  connect(): Promise<void>;
  close(): Promise<void>;

  /**
   * Get comprehensive stream metrics snapshot.
   *
   * @returns Immutable metrics snapshot
   */
  getMetrics(): MetricsSnapshot;

  getConnectionType(): string;
  getOrigins(): string[];
}

/**
 * Connection status callback function type for real-time monitoring of WebSocket connections.
 *
 * Called whenever a connection state changes in both single and High Availability modes.
 * In HA mode, you'll receive callbacks for each origin connection independently.
 *
 * @param isConnected - Whether the connection is established (true) or lost (false)
 * @param host - The hostname of the WebSocket server (e.g., "ws.example.com")
 * @param origin - The full WebSocket origin URL (e.g., "wss://ws.example.com")
 */
export type ConnectionStatusCallback = (isConnected: boolean, host: string, origin: string) => void;

/**
 * Configuration options for the Chainlink Data Streams client with High Availability support.
 *
 * Supports both basic single-connection usage and advanced High Availability (HA) mode
 * for mission-critical applications requiring zero-downtime data delivery.
 */
export interface Config {
  /**
   * API key for authentication with Chainlink Data Streams.
   *
   * @required
   * @example "your_api_key_here"
   */
  apiKey: string;

  /**
   * User secret for HMAC authentication with Chainlink Data Streams.
   *
   * @required
   * @example "your_user_secret_here"
   */
  userSecret: string;

  /**
   * Base URL for the Data Streams REST API.
   *
   * @required
   * @example "https://api.testnet-dataengine.chain.link" // Testnet
   * @example "https://api.dataengine.chain.link" // Mainnet
   */
  endpoint: string;

  /**
   * WebSocket endpoint for real-time data streaming.
   *
   * When HA mode is enabled and single URL is provided, the client will discover
   * available origins and establish concurrent connections to all endpoints for fault tolerance.
   *
   * @required
   * @example "wss://ws.testnet-dataengine.chain.link"
   */
  wsEndpoint: string;

  /**
   * Number of retry attempts for failed REST API requests.
   *
   * Does not affect WebSocket reconnection attempts (see HA configuration).
   *
   * @default 1
   * @range 0-10
   * @example 5
   */
  retryAttempts?: number;

  /**
   * Base delay between retry attempts in milliseconds.
   *
   * Uses exponential backoff: delay = retryDelay * (2 ^ attempt) with jitter.
   *
   * @default 1000
   * @range 100-10000
   * @example 2000
   */
  retryDelay?: number;

  /**
   * Request timeout for REST API calls in milliseconds.
   *
   * Does not affect WebSocket connection timeouts (see haConnectionTimeout).
   *
   * @default 30000
   * @range 1000-120000
   * @example 45000
   */
  timeout?: number;

  /**
   * Enable High Availability mode with multiple simultaneous WebSocket connections.
   *
   * When enabled, the SDK automatically discovers and connects to multiple origins
   *
   * @default false
   */
  haMode?: boolean;

  /**
   * Connection timeout for individual WebSocket connections in HA mode (milliseconds).
   *
   * @default 10000
   * @range 1000-60000
   */
  haConnectionTimeout?: number;

  /**
   * SDK logging system configuration.
   *
   * Silent by default. Activated only when configured.
   *
   * @example
   * ```typescript
   * // Basic logging
   * logging: {
   *   logger: {
   *     info: console.log,
   *     error: console.error
   *   }
   * }
   *
   * // With debug control
   * logging: {
   *   logger: {
   *     debug: (msg, ...args) => myLogger.debug(msg, ...args),
   *     info: (msg, ...args) => myLogger.info(msg, ...args),
   *     error: (msg, ...args) => myLogger.error(msg, ...args)
   *   },
   *   logLevel: LogLevel.INFO,
   *   enableConnectionDebug: true
   * }
   * ```
   */
  logging?: LoggingConfig;

  /**
   * Callback function for real-time WebSocket connection status monitoring.
   *
   * Called whenever connection state changes. In HA mode, called for each origin separately.
   * If used, will block connection manager until callback execution is complete
   */
  connectionStatusCallback?: ConnectionStatusCallback;
}

/**
 * Interface for the Data Streams client
 */
export interface DataStreamsClient {
  /**
   * Lists all available feeds
   *
   * @returns {Promise<Feed[]>} Array of available feeds
   */
  listFeeds(): Promise<Feed[]>;

  /**
   * Returns a single report with the latest timestamp for a feed
   *
   * @param {string} feedId - A Data Streams feed ID
   * @returns {Promise<Report>} The latest report for the specified feed
   */
  getLatestReport(feedId: string): Promise<Report>;

  /**
   * Returns a single report for a feed at a given timestamp
   *
   * @param {string} feedId - A Data Streams feed ID (hex string starting with 0x)
   * @param {number} timestamp - The Unix timestamp for the report (in seconds)
   * @returns {Promise<Report>} The report for the specified feed and timestamp
   */
  getReportByTimestamp(feedId: string, timestamp: number): Promise<Report>;

  /**
   * Get up to 'limit' reports for a feed from startTime onwards
   *
   * @param {string} feedId - The feed ID to get reports for
   * @param {number} startTime - The start timestamp
   * @param {number} [limit] - Maximum number of reports to return. Reports are returned in ascending order by timestamp, starting from startTime.
   * @returns {Promise<Report[]>} Array of reports for the specified feed
   */
  getReportsPage(feedId: string, startTime: number, limit?: number): Promise<Report[]>;

  /**
   * Get reports for multiple feeds at a specific timestamp
   *
   * @param {string[]} feedIds - List of feed IDs to get reports for
   * @param {number} timestamp - The timestamp to get reports for
   * @returns {Promise<Report[]>} Array of reports for the specified feeds
   *
   * @warning Reports are not guaranteed to be returned in the same order as input feedIds.
   * Always use `report.feedID` to identify each report rather than relying on array position.
   */
  getReportsBulk(feedIds: string[], timestamp: number): Promise<Report[]>;

  /**
   * Create a new Stream instance with full developer control over event handling.
   *
   * This is the primary streaming API that gives developers complete control over
   * connection events, error handling, and monitoring.
   *
   * @param {string|string[]} feedIds - Feed ID(s) to stream. Supports single feed, array of feeds, or comma-separated string.
   * @param {StreamOptions} [options] - Optional configuration for stream behavior
   * @returns {IStream} Stream instance with full event control
   *
   * @example Basic Usage
   * ```typescript
   * const stream = client.createStream(['0x00037da06d56d083670...']);
   * stream.on('report', (report) => console.log(report.feedID));
   * await stream.connect();
   * ```
   */
  createStream(feedIds: string | string[], options?: StreamOptions): IStream;
}
