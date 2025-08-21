/**
 * Connection status for individual origins in the metrics system
 */
export enum ConnectionStatus {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
}

/**
 * Comprehensive metrics snapshot for Data Streams SDK operations.
 *
 * This interface provides detailed visibility into the SDK's runtime behavior,
 * enabling integration with monitoring systems and operational dashboards.
 *
 * @example Basic Usage
 * ```typescript
 * const metrics = client.getMetrics();
 * console.log(`Reports processed: ${metrics.accepted}`);
 * console.log(`Active connections: ${metrics.activeConnections}/${metrics.configuredConnections}`);
 * ```
 *
 * @example Monitoring
 * ```typescript
 * const metrics = stream.getMetrics();
 *
 * // Send to monitoring system
 * monitoring.gauge('datastreams.reports.accepted', metrics.accepted);
 * monitoring.gauge('datastreams.connections.active', metrics.activeConnections);
 * monitoring.gauge('datastreams.reconnects.full', metrics.fullReconnects);
 * ```
 */
export interface MetricsSnapshot {
  /**
   * Total number of reports successfully processed and emitted to the application.
   *
   * This represents unique reports that passed deduplication and were delivered
   * to the consumer via the 'report' event or read() method.
   */
  readonly accepted: number;

  /**
   * Total number of duplicate reports filtered out by the deduplication system.
   *
   * In High Availability mode with multiple connections, the same report may be
   * received from multiple origins. This counter tracks how many duplicates
   * were detected and filtered to prevent double-processing.
   */
  readonly deduplicated: number;

  /**
   * Total number of reports received across all connections.
   *
   * This is the sum of accepted + deduplicated reports, representing the
   * complete volume of data received from the Data Streams service.
   */
  readonly totalReceived: number;

  /**
   * Number of partial reconnection events in High Availability mode.
   *
   * A partial reconnect occurs when some (but not all) connections are lost
   * and need to be re-established. The stream continues operating with the
   * remaining healthy connections during this process.
   */
  readonly partialReconnects: number;

  /**
   * Number of full reconnection events.
   *
   * A full reconnect occurs when all connections are lost simultaneously,
   * causing a complete service interruption until at least one connection
   * is successfully re-established.
   */
  readonly fullReconnects: number;

  /**
   * Number of WebSocket connections configured for the stream.
   *
   * In single-connection mode, this is always 1. In High Availability mode,
   * this represents the total number of origins configured for redundancy.
   */
  readonly configuredConnections: number;

  /**
   * Number of WebSocket connections currently active and healthy.
   *
   * This number may be less than configuredConnections if some connections
   * are temporarily down or in the process of reconnecting.
   */
  readonly activeConnections: number;

  /**
   * Detailed status of each origin connection, keyed by origin URL.
   *
   * Provides granular visibility into the health of individual connections
   * in High Availability mode. Useful for debugging connectivity issues
   * and monitoring connection stability.
   *
   * @example
   * ```typescript
   * const metrics = stream.getMetrics();
   * Object.entries(metrics.originStatus).forEach(([origin, status]) => {
   *   console.log(`${origin}: ${status}`);
   * });
   * ```
   */
  readonly originStatus: Readonly<Record<string, ConnectionStatus>>;
}
