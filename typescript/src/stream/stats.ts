import { MetricsSnapshot, ConnectionStatus } from "../types/metrics";

/**
 * Class for tracking WebSocket connection and report statistics
 */
export class StreamStats {
  private _accepted = 0;
  private _deduplicated = 0;
  private _partialReconnects = 0;
  private _fullReconnects = 0;
  private _configuredConnections = 0;
  private _activeConnections = 0;
  private _originStatus: Record<string, ConnectionStatus> = {};
  private _totalReceived = 0; // accepted + deduplicated

  constructor(configuredConnections = 1) {
    this._configuredConnections = configuredConnections;
  }

  /**
   * Increment the number of accepted reports (messages that passed deduplication)
   */
  incrementAccepted(): void {
    this._accepted++;
    this._totalReceived++;
  }

  /**
   * Increment the number of deduplicated reports (duplicate messages filtered out)
   */
  incrementDeduplicated(): void {
    this._deduplicated++;
    this._totalReceived++;
  }

  /**
   * Increment the number of partial reconnects (some connections lost but not all)
   */
  incrementPartialReconnects(): void {
    this._partialReconnects++;
  }

  /**
   * Increment the number of full reconnects (all connections lost)
   */
  incrementFullReconnects(): void {
    this._fullReconnects++;
  }

  /**
   * Set the number of active connections
   */
  setActiveConnections(count: number): void {
    this._activeConnections = count;
  }

  /**
   * Set the number of configured connections
   */
  setConfiguredConnections(count: number): void {
    this._configuredConnections = count;
  }

  /**
   * Update connection status for a specific origin
   */
  setOriginStatus(origin: string, status: ConnectionStatus): void {
    this._originStatus[origin] = status;
  }

  /**
   * Remove origin status tracking (when origin is no longer used)
   */
  removeOriginStatus(origin: string): void {
    delete this._originStatus[origin];
  }

  /**
   * Get connection status for a specific origin
   */
  getOriginStatus(origin: string): ConnectionStatus {
    return this._originStatus[origin] || ConnectionStatus.DISCONNECTED;
  }

  /**
   * Get all origin statuses
   */
  getAllOriginStatuses(): Record<string, ConnectionStatus> {
    return { ...this._originStatus };
  }

  /**
   * Update all origin statuses from ConnectionManager (for unified metrics)
   */
  updateOriginStatuses(originStatus: Record<string, ConnectionStatus>): void {
    this._originStatus = { ...originStatus };
  }

  /**
   * Reset all statistics (useful for testing or reconnection scenarios)
   */
  reset(): void {
    this._accepted = 0;
    this._deduplicated = 0;
    this._partialReconnects = 0;
    this._fullReconnects = 0;
    this._totalReceived = 0;
    this._activeConnections = 0;
    this._originStatus = {};
  }

  /**
   * Get a snapshot of current stream metrics.
   *
   * Returns an immutable snapshot of all metrics
   * The returned object follows the MetricsSnapshot interface for type safety
   *
   * @returns Immutable metrics snapshot
   */
  getStats(): MetricsSnapshot {
    return {
      accepted: this._accepted,
      deduplicated: this._deduplicated,
      partialReconnects: this._partialReconnects,
      fullReconnects: this._fullReconnects,
      configuredConnections: this._configuredConnections,
      activeConnections: this._activeConnections,
      totalReceived: this._totalReceived,
      originStatus: Object.freeze({ ...this._originStatus }),
    };
  }
}
