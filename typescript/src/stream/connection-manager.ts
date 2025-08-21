import WebSocket, { RawData } from "ws";
import { EventEmitter } from "events";
import { generateAuthHeaders } from "../utils/auth";
import { getAvailableOrigins } from "../utils/origin-discovery";
import { WS_CONSTANTS, X_CLL_ORIGIN_HEADER } from "../utils/constants";
import { WebSocketError, MultiConnectionError, InsufficientConnectionsError } from "../types/errors";
import { Config, ConnectionStatusCallback } from "../types/client";
import { SDKLogger } from "../utils/logger";
import { ConnectionStatus } from "../types/metrics";
import { StreamStats } from "./stats";

/**
 * Connection state enum
 */
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
}

/**
 * Individual connection wrapper with metadata
 */
export interface ManagedConnection {
  id: string;
  origin: string;
  host: string;
  ws: WebSocket | null;
  state: ConnectionState;
  reconnectAttempts: number;
  lastError?: Error;
  connectedAt?: number;
  lastReconnectAt?: number;
  // Health monitoring
  pingInterval?: NodeJS.Timeout;
  pongTimeout?: NodeJS.Timeout;
}

/**
 * Connection management events
 */
export interface ConnectionManagerEvents {
  "connection-established": (connection: ManagedConnection) => void;
  "connection-lost": (connection: ManagedConnection, error?: Error) => void;
  "connection-restored": (connection: ManagedConnection) => void;
  "all-connections-lost": () => void;
  "partial-failure": (failedCount: number, totalCount: number) => void;
  message: (data: RawData, connection: ManagedConnection) => void;
  /** Emitted when a reconnection is scheduled for a connection */
  reconnecting: (
    info: { attempt: number; delayMs: number; origin: string; host: string },
    connection: ManagedConnection
  ) => void;
}

/**
 * Configuration for connection management
 */
export interface ConnectionManagerConfig {
  feedIds: string[];
  maxReconnectAttempts: number;
  reconnectInterval: number;
  connectTimeout: number;
  haMode: boolean;
  haConnectionTimeout: number;
  statusCallback?: ConnectionStatusCallback;
}

/**
 * Connection manager for WebSocket connections
 * Optimized for both single and multi-origin architectures
 */
export class ConnectionManager extends EventEmitter {
  private config: Config;
  private managerConfig: ConnectionManagerConfig;
  private connections: Map<string, ManagedConnection> = new Map();
  private isShuttingDown = false;
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private logger: SDKLogger;

  private streamStats: StreamStats | null = null;

  constructor(config: Config, managerConfig: ConnectionManagerConfig) {
    super();
    this.config = config;
    this.managerConfig = managerConfig;
    this.logger = new SDKLogger(config.logging);
  }

  /**
   * Set the StreamStats reference for unified metrics tracking
   * This method is called by Stream to provide the unified stats instance
   */
  setStreamStats(streamStats: StreamStats): void {
    this.streamStats = streamStats;
  }

  /**
   * Initialize connections to all available origins
   * Requires explicit HA mode configuration
   */
  async initialize(): Promise<void> {
    try {
      // Discover available origins (static + dynamic)
      const origins = await getAvailableOrigins(
        this.config.wsEndpoint,
        this.config.apiKey,
        this.config.userSecret,
        this.managerConfig.haMode,
        this.managerConfig.haConnectionTimeout
      );

      // Determine connection mode based on explicit HA configuration
      const useHAMode = this.managerConfig.haMode && origins.length > 1;
      const originsToUse = useHAMode ? origins : [origins[0]];

      if (useHAMode) {
        this.logger.info(`Initializing in HA mode with ${origins.length} origins`, {
          origins: origins.map(o => new URL(o).host),
        });
      } else {
        if (this.managerConfig.haMode) {
          this.logger.warn(
            `HA mode requested but only ${origins.length} origin available, falling back to single connection`,
            {
              origin: new URL(origins[0]).host,
            }
          );
        } else {
          this.logger.info(`Initializing in single connection mode`, { origin: new URL(origins[0]).host });
        }
      }

      if (!useHAMode && this.managerConfig.haMode) {
        this.emit("ha-fallback-warning", {
          message: "HA mode requested but only one origin available, falling back to single connection",
          requestedOrigins: origins.length,
          actualMode: "single",
        });
      }

      // Create managed connections for each origin
      const connectionPromises = originsToUse.map((origin, index) => this.createConnection(origin, index));

      // Wait for all connection attempts (some may fail)
      const results = await Promise.allSettled(connectionPromises);

      // Count successful connections
      const successfulConnections = results.filter(r => r.status === "fulfilled").length;
      const failedConnections = results.length - successfulConnections;

      // Handle connection results
      if (successfulConnections === 0) {
        throw new InsufficientConnectionsError("Failed to establish any WebSocket connections", 0, 1);
      } else if (failedConnections > 0 && useHAMode) {
        // Partial failure in HA mode - emit warning but continue
        this.emit("partial-failure", failedConnections, results.length);
      }
    } catch (error) {
      throw new MultiConnectionError(
        `Failed to initialize connections: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Update connection state with logging
   */
  private updateConnectionState(connection: ManagedConnection, newState: ConnectionState, reason?: string): void {
    const oldState = connection.state;
    connection.state = newState;

    if (oldState !== newState) {
      const logData = {
        connectionId: connection.id,
        host: connection.host,
        oldState,
        newState,
        reason,
      };

      switch (newState) {
        case ConnectionState.CONNECTING:
          this.logger.connectionDebug(`Connection ${connection.id} transitioning to CONNECTING`, logData);
          break;
        case ConnectionState.CONNECTED:
          this.logger.info(`Connection ${connection.id} established to ${connection.host}`, logData);
          break;
        case ConnectionState.RECONNECTING:
          this.logger.warn(
            `Connection ${connection.id} reconnecting to ${connection.host}: ${reason || "Unknown reason"}`,
            logData
          );
          break;
        case ConnectionState.FAILED:
          this.logger.error(
            `Connection ${connection.id} failed to ${connection.host}: ${reason || "Unknown reason"}`,
            logData
          );
          break;
        case ConnectionState.DISCONNECTED:
          if (oldState === ConnectionState.CONNECTED) {
            this.logger.warn(
              `Connection ${connection.id} lost to ${connection.host}: ${reason || "Unknown reason"}`,
              logData
            );
          } else {
            this.logger.connectionDebug(`Connection ${connection.id} disconnected from ${connection.host}`, logData);
          }
          break;
      }
    }
  }

  /**
   * Create and establish a single connection to an origin
   */
  private async createConnection(origin: string, index: number): Promise<ManagedConnection> {
    const connectionId = `conn-${index}`;
    const url = new URL(origin);

    const connection: ManagedConnection = {
      id: connectionId,
      origin,
      host: url.host,
      ws: null,
      state: ConnectionState.DISCONNECTED,
      reconnectAttempts: 0,
    };

    this.connections.set(connectionId, connection);

    try {
      await this.establishConnection(connection);
      return connection;
    } catch (error) {
      this.updateConnectionState(
        connection,
        ConnectionState.FAILED,
        `Connection setup failed: ${error instanceof Error ? error.message : error}`
      );
      connection.lastError = error instanceof Error ? error : new Error(String(error));
      throw error;
    }
  }

  /**
   * Establish WebSocket connection for a managed connection
   */
  private async establishConnection(connection: ManagedConnection): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.updateConnectionState(connection, ConnectionState.CONNECTING, "WebSocket connection initiated");

        // Build WebSocket URL with feed IDs
        const feedIdsParam = this.managerConfig.feedIds.join(",");

        // Extract base URL and origin identifier
        let baseUrl = connection.origin;
        let originId = "";

        if (connection.origin.includes("#")) {
          // Format: baseUrl#originId
          [baseUrl, originId] = connection.origin.split("#");
        } else if (!connection.origin.startsWith("ws")) {
          baseUrl = this.config.wsEndpoint.split(",")[0];
          originId = connection.origin;
        }

        const wsUrl = `${baseUrl}/api/v1/ws?feedIDs=${feedIdsParam}`;

        // Generate authentication headers
        const headers = generateAuthHeaders(this.config.apiKey, this.config.userSecret, "GET", wsUrl);

        // Add origin as header if we have an identifier
        if (originId) {
          headers[X_CLL_ORIGIN_HEADER] = originId;
        }

        // Create WebSocket with timeout
        const connectTimeout = setTimeout(() => {
          if (connection.ws) {
            connection.ws.terminate();
          }
          reject(new WebSocketError(`Connection timeout after ${this.managerConfig.connectTimeout}ms`));
        }, this.managerConfig.connectTimeout);

        connection.ws = new WebSocket(wsUrl, { headers });

        // Handle connection events
        // Surface clearer auth errors on handshake (401/403)
        connection.ws.once("unexpected-response", (_req: unknown, res: { statusCode?: number }) => {
          clearTimeout(connectTimeout);
          const status = res?.statusCode;
          if (status === 401 || status === 403) {
            reject(
              new WebSocketError(`Authentication failed during WebSocket handshake (${status}). Check API key/secret.`)
            );
          } else {
            reject(new WebSocketError(`Unexpected WebSocket handshake response: ${String(status)}`));
          }
        });

        connection.ws.on("open", () => {
          clearTimeout(connectTimeout);
          this.updateConnectionState(connection, ConnectionState.CONNECTED, "WebSocket connection established");
          connection.connectedAt = Date.now();
          connection.reconnectAttempts = 0; // Reset on successful connection

          // Start health monitoring
          this.startHealthMonitoring(connection);

          // Notify status callback
          if (this.managerConfig.statusCallback) {
            this.managerConfig.statusCallback(true, connection.host, connection.origin);
          }

          this.emit("connection-established", connection);
          resolve();
        });

        connection.ws.on("message", data => {
          this.emit("message", data, connection);
        });

        connection.ws.on("close", () => {
          clearTimeout(connectTimeout);
          this.handleConnectionLoss(connection);
        });

        connection.ws.on("error", error => {
          clearTimeout(connectTimeout);
          connection.lastError = error;

          if (connection.state === ConnectionState.CONNECTING) {
            const message = /401|403/.test(error.message)
              ? `Authentication failed during WebSocket handshake. Check API key/secret. (${error.message})`
              : `Failed to connect to ${connection.origin}: ${error.message}`;
            reject(new WebSocketError(message));
          } else {
            this.handleConnectionLoss(connection, error);
          }
        });

        // Handle ping/pong for connection health
        connection.ws.on("ping", data => {
          this.logger.connectionDebug(`Received ping from ${connection.origin}`);
          if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
            try {
              this.logger.connectionDebug(`Responding with pong to ${connection.origin}`);
              connection.ws.pong(data);
            } catch {
              // Ignore pong errors
            }
          }
        });

        connection.ws.on("pong", () => {
          this.handlePongReceived(connection);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle connection loss and manage reconnection
   */
  private handleConnectionLoss(connection: ManagedConnection, error?: Error): void {
    if (this.isShuttingDown) {
      return;
    }

    const wasConnected = connection.state === ConnectionState.CONNECTED;
    this.updateConnectionState(
      connection,
      ConnectionState.DISCONNECTED,
      error ? `Connection lost: ${error.message}` : "Connection closed"
    );
    connection.lastError = error;

    // Stop health monitoring
    this.stopHealthMonitoring(connection);

    // Notify status callback
    if (this.managerConfig.statusCallback && wasConnected) {
      this.managerConfig.statusCallback(false, connection.host, connection.origin);
    }

    this.emit("connection-lost", connection, error);

    // Check if all connections are lost
    const activeConnections = this.getActiveConnectionCount();
    if (activeConnections === 0) {
      this.emit("all-connections-lost");
    }

    // Schedule reconnection with exponential backoff
    this.scheduleReconnection(connection);
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnection(connection: ManagedConnection): void {
    if (this.isShuttingDown) {
      return;
    }

    connection.reconnectAttempts++;
    this.updateConnectionState(
      connection,
      ConnectionState.RECONNECTING,
      `Reconnect attempt ${connection.reconnectAttempts}/${this.managerConfig.maxReconnectAttempts}`
    );
    connection.lastReconnectAt = Date.now();

    // Increment reconnection counters at the moment of reconnection attempt
    const activeConnections = this.getActiveConnectionCount();
    if (activeConnections === 0) {
      // All connections lost - full reconnect
      if (this.streamStats) {
        this.streamStats.incrementFullReconnects();
      }
      this.logger.debug(`Full reconnection attempt (no active connections)`);
    } else {
      // Some connections remain - partial reconnect
      if (this.streamStats) {
        this.streamStats.incrementPartialReconnects();
      }
      this.logger.debug(`Partial reconnection attempt (${activeConnections} active connections remaining)`);
    }

    // Exponential backoff: start at base, double each time, cap at max
    const baseDelay = this.managerConfig.reconnectInterval || WS_CONSTANTS.RECONNECT_DELAY;
    const delay = Math.min(
      baseDelay * Math.pow(2, connection.reconnectAttempts - 1),
      WS_CONSTANTS.MAX_RECONNECT_INTERVAL
    );

    this.logger.debug(
      `Scheduling reconnection for ${connection.id} in ${delay}ms (attempt ${connection.reconnectAttempts})`
    );

    this.emit(
      "reconnecting",
      {
        attempt: connection.reconnectAttempts,
        delayMs: delay,
        origin: connection.origin,
        host: connection.host,
      },
      connection
    );

    const timeout = setTimeout(async () => {
      this.reconnectTimeouts.delete(connection.id);

      if (this.isShuttingDown) {
        return;
      }

      // Stop reconnection if maximum attempts reached with no active connections
      const activeConnections = this.getActiveConnectionCount();
      if (connection.reconnectAttempts >= this.managerConfig.maxReconnectAttempts && activeConnections === 0) {
        this.updateConnectionState(
          connection,
          ConnectionState.FAILED,
          `Max reconnection attempts (${this.managerConfig.maxReconnectAttempts}) reached with no active connections`
        );
        this.emit("max-reconnect-attempts-reached", {
          origin: connection.origin,
          attempts: connection.reconnectAttempts,
          activeConnections,
          message: `Max reconnection attempts reached for ${connection.origin} with no active connections`,
        });
        this.emit("all-connections-lost");
        return;
      }

      try {
        await this.establishConnection(connection);
        this.emit("connection-restored", connection);
      } catch {
        // Connection failed, schedule another attempt
        this.scheduleReconnection(connection);
      }
    }, delay);

    // Don't keep the process alive just for reconnection attempts
    timeout.unref();
    this.reconnectTimeouts.set(connection.id, timeout);
  }

  /**
   * Get count of currently active connections
   */
  getActiveConnectionCount(): number {
    return Array.from(this.connections.values()).filter(conn => conn.state === ConnectionState.CONNECTED).length;
  }

  /**
   * Get count of configured connections
   */
  getConfiguredConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get all connection states for monitoring
   */
  getConnectionStates(): Record<string, ConnectionState> {
    const states: Record<string, ConnectionState> = {};
    for (const [id, conn] of this.connections) {
      states[id] = conn.state;
    }
    return states;
  }

  /**
   * Get detailed connection information
   */
  getConnectionDetails(): ManagedConnection[] {
    return Array.from(this.connections.values()).map(conn => ({
      ...conn,
      ws: null, // Don't expose WebSocket instance
    }));
  }

  /**
   * Start health monitoring for a connection (ping/pong)
   */
  private startHealthMonitoring(connection: ManagedConnection): void {
    // Start ping interval
    connection.pingInterval = setInterval(() => {
      this.sendPing(connection);
    }, WS_CONSTANTS.PING_INTERVAL);

    // Don't keep the process alive just for health monitoring
    connection.pingInterval.unref();
  }

  /**
   * Send a ping to check connection health
   */
  private sendPing(connection: ManagedConnection): void {
    if (!connection.ws || connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      // Send ping and start pong timeout
      this.logger.connectionDebug(`Sending ping to ${connection.origin}`);
      connection.ws.ping();

      // Set timeout for pong response
      connection.pongTimeout = setTimeout(() => {
        // No pong received within timeout - connection is dead
        this.logger.warn(`Pong timeout for ${connection.origin} - terminating connection`);
        if (connection.ws) {
          connection.ws.terminate();
        }
      }, WS_CONSTANTS.PONG_TIMEOUT);

      // Don't keep the process alive just for pong timeout
      connection.pongTimeout.unref();
    } catch (error) {
      // Ping failed - connection is likely dead
      this.logger.error(`Ping failed for ${connection.origin}:`, error);
      if (connection.ws) {
        connection.ws.terminate();
      }
    }
  }

  /**
   * Handle pong response received
   */
  private handlePongReceived(connection: ManagedConnection): void {
    this.logger.connectionDebug(`Received pong from ${connection.origin}`);

    // Clear pong timeout since we received response
    if (connection.pongTimeout) {
      clearTimeout(connection.pongTimeout);
      connection.pongTimeout = undefined;
    }
  }

  /**
   * Stop health monitoring for a connection
   */
  private stopHealthMonitoring(connection: ManagedConnection): void {
    if (connection.pingInterval) {
      clearInterval(connection.pingInterval);
      connection.pingInterval = undefined;
    }

    if (connection.pongTimeout) {
      clearTimeout(connection.pongTimeout);
      connection.pongTimeout = undefined;
    }
  }

  /**
   * Gracefully shutdown all connections
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Clear all reconnection timeouts
    for (const timeout of this.reconnectTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.reconnectTimeouts.clear();

    // Close all connections gracefully
    const closePromises = Array.from(this.connections.values()).map(connection => this.closeConnection(connection));

    await Promise.allSettled(closePromises);
    this.connections.clear();
  }

  /**
   * Close a single connection gracefully
   */
  private async closeConnection(connection: ManagedConnection): Promise<void> {
    return new Promise<void>(resolve => {
      if (!connection.ws) {
        resolve();
        return;
      }

      const ws = connection.ws;
      this.updateConnectionState(connection, ConnectionState.DISCONNECTED, "Graceful shutdown initiated");

      // Stop health monitoring
      this.stopHealthMonitoring(connection);

      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        const timeout = setTimeout(() => {
          ws.terminate();
          resolve();
        }, 1000);

        ws.once("close", () => {
          clearTimeout(timeout);
          resolve();
        });

        ws.close();
      } else {
        resolve();
      }
    });
  }

  /**
   * Get origin status map for StreamStats
   * @returns Map of origin to connection status
   */
  getOriginStatusMap(): Record<string, ConnectionStatus> {
    const originStatus: Record<string, ConnectionStatus> = {};

    for (const connection of this.connections.values()) {
      // Map ConnectionState to ConnectionStatus for metrics compatibility
      let status: ConnectionStatus;
      switch (connection.state) {
        case ConnectionState.CONNECTED:
          status = ConnectionStatus.CONNECTED;
          break;
        case ConnectionState.CONNECTING:
          status = ConnectionStatus.CONNECTING;
          break;
        case ConnectionState.RECONNECTING:
          status = ConnectionStatus.RECONNECTING;
          break;
        case ConnectionState.FAILED:
          status = ConnectionStatus.FAILED;
          break;
        case ConnectionState.DISCONNECTED:
        default:
          status = ConnectionStatus.DISCONNECTED;
          break;
      }
      originStatus[connection.origin] = status;
    }

    return Object.freeze(originStatus);
  }
}
