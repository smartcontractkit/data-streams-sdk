import { EventEmitter } from "events";
import { Config } from "../types/client";
import { Report } from "../types/report";
import { StreamStats } from "./stats";
import { MetricsSnapshot, ConnectionStatus } from "../types/metrics";
import { WS_CONSTANTS } from "../utils/constants";
import { ConnectionManager } from "./connection-manager";
import { ReportDeduplicator } from "./deduplication";
import { OriginDiscoveryError, InsufficientConnectionsError } from "../types/errors";
import { SDKLogger } from "../utils/logger";

/**
 * Connection type enum for distinguishing single vs multiple connection modes
 */
export enum ConnectionType {
  /** Single WebSocket connection (traditional mode) */
  Single = "single",
  /** Multiple WebSocket connections (High Availability mode) */
  Multiple = "multiple",
}

/**
 * Configuration options for customizing Stream behavior.
 *
 * These options allow fine-tuning of connection management, reconnection logic,
 * and performance characteristics for different use cases.
 */
export interface StreamOptions {
  /**
   * Interval between reconnection attempts in milliseconds.
   *
   * Controls how long to wait before attempting to reconnect after a connection loss.
   * Longer intervals reduce server load but increase recovery time.
   *
   * Base for exponential backoff. Actual delay grows as base * 2^(attempt-1), capped at 10000ms.
   *
   * @default 1000 (1 second)
   * @range 1000-30000
   * @example 5000 // Wait 5 seconds between reconnection attempts
   */
  reconnectInterval?: number;

  /**
   * Maximum number of reconnection attempts before giving up.
   *
   * In HA mode, this applies per connection. If one connection exhausts its attempts
   * but others remain active, the stream continues. Only when all connections
   * exhaust attempts does the stream fail.
   *
   * @default 5
   * @range 1-100
   * @example 15 // Allow up to 15 reconnection attempts per connection
   */
  maxReconnectAttempts?: number;
}

/**
 * Real-time WebSocket stream for Chainlink Data Streams with full developer control.
 *
 * This class provides a complete event-driven API for streaming reports, giving developers
 * full control over connection management, error handling, and monitoring. Supports both
 * single-connection and High Availability modes with automatic failover.
 *
 * @example Basic Usage
 * ```typescript
 * const stream = client.createStream(['0x00037da06d56d083670...']);
 * stream.on('report', (report) => {
 *   console.log(`Price: ${report.price}, Feed: ${report.feedID}`);
 * });
 * await stream.connect();
 * ```
 *
 * @example High Availability Mode
 * ```typescript
 * const client = createClient({
 *   wsEndpoint: "wss://ws1.example.com,wss://ws2.example.com",
 *   haMode: true,
 * });
 * const stream = client.createStream(feedIds);
 * stream.on('report', (report) => processReport(report));
 * await stream.connect();
 * ```
 */
export class Stream extends EventEmitter {
  private config: Config;
  private feedIds: string[];
  private options: Required<StreamOptions>;
  private isClosing = false;
  private stats: StreamStats;
  private connectionType: ConnectionType;
  private connectionManager: ConnectionManager;
  private deduplicator: ReportDeduplicator;
  private origins: string[] = [];
  private logger: SDKLogger;

  constructor(config: Config, feedIds: string[], options: StreamOptions = {}) {
    super();
    this.config = config;
    this.feedIds = feedIds;
    this.logger = new SDKLogger(config.logging);
    this.options = {
      reconnectInterval: options.reconnectInterval || WS_CONSTANTS.RECONNECT_DELAY,
      maxReconnectAttempts: options.maxReconnectAttempts || WS_CONSTANTS.MAX_RECONNECTS,
    };

    this.logger.debug(`Creating stream for feeds: ${feedIds.join(", ")}`);
    this.logger.debug(
      `Stream options: reconnectInterval=${this.options.reconnectInterval}ms, maxReconnectAttempts=${this.options.maxReconnectAttempts}`
    );

    // Determine connection type based on HA mode configuration
    const useHAMode = config.haMode && this.parseOrigins().length > 1;
    this.connectionType = useHAMode ? ConnectionType.Multiple : ConnectionType.Single;

    this.logger.info(`Initializing stream in ${this.connectionType} mode`);

    // Initialize stats with appropriate connection count
    const expectedConnections = useHAMode ? this.parseOrigins().length : 1;
    this.stats = new StreamStats(expectedConnections);
    this.logger.debug(`Expected connections: ${expectedConnections}`);

    // Initialize ConnectionManager for both single and multiple connections
    const managerConfig = {
      feedIds: this.feedIds,
      maxReconnectAttempts: this.options.maxReconnectAttempts,
      reconnectInterval: this.options.reconnectInterval,
      connectTimeout: config.haConnectionTimeout || WS_CONSTANTS.CONNECT_TIMEOUT,
      haMode: config.haMode || false,
      haConnectionTimeout: config.haConnectionTimeout || WS_CONSTANTS.CONNECT_TIMEOUT,
      statusCallback: config.connectionStatusCallback,
    };

    this.connectionManager = new ConnectionManager(config, managerConfig);

    // Initialize deduplicator for HA mode (single mode can also benefit from deduplication)
    this.deduplicator = new ReportDeduplicator();

    // Inject StreamStats into ConnectionManager for unified metrics
    this.connectionManager.setStreamStats(this.stats);

    this.setupConnectionManagerEvents();
  }

  /**
   * Parse WebSocket endpoints from config, supporting comma-separated URLs
   */
  private parseOrigins(): string[] {
    if (!this.config.wsEndpoint) {
      return [];
    }

    // Support comma-separated URLs
    return this.config.wsEndpoint
      .split(",")
      .map(url => url.trim())
      .filter(url => url.length > 0);
  }

  /**
   * Setup event listeners for ConnectionManager
   */
  private setupConnectionManagerEvents(): void {
    this.connectionManager.on("connection-established", connection => {
      this.stats.setOriginStatus(connection.origin, ConnectionStatus.CONNECTED);
    });

    this.connectionManager.on("connection-lost", (connection, error) => {
      this.stats.setOriginStatus(connection.origin, ConnectionStatus.DISCONNECTED);

      // Re-emit for external listeners (tests, monitoring, etc.)
      this.emit("connection-lost", connection, error);
    });

    this.connectionManager.on("message", (data, connection) => {
      try {
        const message = JSON.parse(data.toString());
        if (message && message.report) {
          const report = {
            feedID: message.report.feedID,
            fullReport: message.report.fullReport,
            validFromTimestamp: message.report.validFromTimestamp,
            observationsTimestamp: message.report.observationsTimestamp,
          };
          this.logger.debug(`Received report for feed ${report.feedID} from ${connection.origin}`);
          this.handleReport(report, connection.origin);
        } else {
          this.logger.warn(`Invalid message format received from ${connection.origin}`);
          this.emit("error", new Error("Invalid message format"));
        }
      } catch (error) {
        this.logger.error(`Failed to parse WebSocket message from ${connection.origin}:`, error);
        this.emit("error", new Error("Failed to parse WebSocket message"));
      }
    });

    // Re-emit reconnecting for external listeners (maintains IStream contract)
    this.connectionManager.on("reconnecting", info => {
      // info: { attempt, delayMs, origin, host }
      this.emit("reconnecting", info);
    });

    this.connectionManager.on("all-connections-lost", () => {
      this.logger.error("All connections lost - stream disconnected");
      this.emit("disconnected");
      // Re-emit for external listeners (tests, monitoring, etc.)
      this.emit("all-connections-lost");
    });

    this.connectionManager.on("partial-failure", (failedCount, totalCount) => {
      this.logger.warn(`Partial connection failure: ${failedCount}/${totalCount} connections failed`);
      // Note: ConnectionManager already increments these counters, no need to double-count
    });

    this.connectionManager.on("connection-restored", connection => {
      this.stats.setOriginStatus(connection.origin, ConnectionStatus.CONNECTED);

      // Re-emit for external listeners (tests, monitoring, etc.)
      this.emit("connection-restored", connection);
    });
  }

  /**
   * Handle incoming reports with deduplication
   */
  private handleReport(report: Report, origin?: string): void {
    // Use deduplicator for both single and multiple connections
    // This provides consistency and prevents any edge case duplicates
    const result = this.deduplicator.processReport({
      feedID: report.feedID,
      observationsTimestamp: report.observationsTimestamp,
      validFromTimestamp: report.validFromTimestamp,
      fullReport: report.fullReport,
    });

    const originInfo = origin ? ` from ${new URL(origin).host}` : "";

    if (result.isAccepted) {
      this.stats.incrementAccepted();
      this.logger.debug(
        `Report accepted for feed ${report.feedID}${originInfo} (timestamp: ${report.observationsTimestamp})`
      );
      this.emit("report", report);
    } else {
      this.stats.incrementDeduplicated();
      this.logger.debug(
        `Report deduplicated for feed ${report.feedID}${originInfo} (timestamp: ${report.observationsTimestamp})`
      );
    }
  }

  /**
   * Start listening for WebSocket messages
   */
  async connect(): Promise<void> {
    this.logger.info(`Connecting stream in ${this.connectionType} mode`);

    try {
      // Initialize connections - ConnectionManager handles origin discovery and connection establishment in parallel
      await this.connectionManager.initialize();

      // Update origins from successful connections
      const connectionDetails = this.connectionManager.getConnectionDetails();
      this.origins = connectionDetails.map(conn => conn.origin);

      if (this.origins.length === 0) {
        this.logger.error("No origins available for connection");
        throw new InsufficientConnectionsError("No origins available for connection", 0, 1);
      }

      // Update connection type based on actual established connections
      this.connectionType =
        this.origins.length > 1 && this.config.haMode ? ConnectionType.Multiple : ConnectionType.Single;

      // Update stats with actual connection count
      this.stats.setConfiguredConnections(this.origins.length);
      this.stats.setActiveConnections(this.connectionManager.getActiveConnectionCount());

      this.logger.info(`Stream connected successfully with ${this.origins.length} origins: ${this.origins.join(", ")}`);
    } catch (error) {
      if (error instanceof OriginDiscoveryError) {
        this.logger.warn("Origin discovery failed, falling back to single connection mode");

        // Fall back to single connection if origin discovery fails
        this.connectionType = ConnectionType.Single;

        // Get fallback origins from static configuration
        this.origins = this.parseOrigins().slice(0, 1);
        this.stats.setConfiguredConnections(1);
        this.stats.setActiveConnections(this.connectionManager.getActiveConnectionCount());

        this.logger.info(`Fallback connection established to: ${this.origins[0]}`);
      } else {
        this.logger.error("Failed to connect stream:", error);
        throw error;
      }
    }
  }

  /**
   * Close all WebSocket connections
   */
  async close(): Promise<void> {
    this.logger.info("Closing stream and shutting down connections");
    this.isClosing = true;
    await this.connectionManager.shutdown();
    this.deduplicator.stop();
    this.stats.setActiveConnections(0);
    this.logger.info("Stream closed successfully");
  }

  /**
   * Read the next report from any active connection
   */
  async read(): Promise<Report> {
    return new Promise((resolve, reject) => {
      const onReport = (report: Report) => {
        cleanup();
        resolve(report);
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        this.removeListener("report", onReport);
        this.removeListener("error", onError);
      };

      this.once("report", onReport);
      this.once("error", onError);
    });
  }

  /**
   * Get comprehensive stream metrics snapshot.
   *
   * Returns a complete metrics snapshot, including report processing statistics, connection health, and operational counters.
   *
   * The returned object is immutable and safe for serialization to monitoring systems.
   *
   * @returns Immutable metrics snapshot with all available data
   *
   * @example Basic Monitoring
   * ```typescript
   * const metrics = stream.getMetrics();
   * console.log(`Efficiency: ${metrics.accepted}/${metrics.totalReceived} reports processed`);
   * console.log(`Redundancy: ${metrics.activeConnections}/${metrics.configuredConnections} connections active`);
   * ```
   *
   * @example Dashboard
   * ```typescript
   * const metrics = stream.getMetrics();
   *
   * // Connection health
   * monitoring.gauge('datastreams.connections.active', metrics.activeConnections);
   * monitoring.gauge('datastreams.connections.configured', metrics.configuredConnections);
   *
   * // Report processing
   * monitoring.counter('datastreams.reports.accepted', metrics.accepted);
   * monitoring.counter('datastreams.reports.deduplicated', metrics.deduplicated);
   *
   * // Reliability metrics
   * monitoring.counter('datastreams.reconnects.partial', metrics.partialReconnects);
   * monitoring.counter('datastreams.reconnects.full', metrics.fullReconnects);
   * ```
   */
  getMetrics(): MetricsSnapshot {
    // Update active connections count and origin statuses from ConnectionManager
    this.stats.setActiveConnections(this.connectionManager.getActiveConnectionCount());
    this.stats.updateOriginStatuses(this.connectionManager.getOriginStatusMap());

    // Return unified stats from StreamStats
    return this.stats.getStats();
  }

  /**
   * Get the connection type being used
   */
  getConnectionType(): ConnectionType {
    return this.connectionType;
  }

  /**
   * Get the origins being used for connections
   */
  getOrigins(): string[] {
    return [...this.origins];
  }

  /**
   * Get detailed connection information from the manager
   */
  getConnectionDetails() {
    return this.connectionManager.getConnectionDetails();
  }

  /**
   * Get connection states for monitoring
   */
  getConnectionStates() {
    return this.connectionManager.getConnectionStates();
  }
}
