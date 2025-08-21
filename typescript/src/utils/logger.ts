import { LoggingConfig, LogLevel } from "../types/logger";

/**
 * Simple and efficient internal logger for the Data Streams SDK.
 *
 * Provides configurable logging
 *
 * @example Basic usage
 * ```typescript
 * const logger = new SDKLogger({
 *   logger: { info: console.log, error: console.error },
 *   logLevel: LogLevel.INFO
 * });
 * logger.info('Client initialized');
 * ```
 *
 * @example Debugging WebSocket connections
 * ```typescript
 * const logger = new SDKLogger({
 *   logger: myLogger,
 *   enableConnectionDebug: true
 * });
 * logger.connectionDebug('Ping received from origin');
 * ```
 */
export class SDKLogger {
  private config: LoggingConfig;

  constructor(config: LoggingConfig = {}) {
    this.config = config;
  }

  /** General debug logs */
  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  /** Information logs */
  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  /** Warning logs */
  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  /** Error logs */
  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  /** Specialized debug logs for WebSocket connections */
  connectionDebug(message: string, ...args: any[]): void {
    if (this.config.enableConnectionDebug) {
      this.debug(`[Connection] ${message}`, ...args);
    }
  }

  /** Internal logging method with level verification */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    // Zero overhead if no logger configured
    if (!this.config.logger) {
      return;
    }

    // Check minimum level
    const minLevel = this.config.logLevel ?? LogLevel.INFO;
    if (level < minLevel) {
      return;
    }

    // Route to appropriate function
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [DataStreams] ${message}`;

    try {
      switch (level) {
        case LogLevel.DEBUG:
          this.config.logger.debug?.(formattedMessage, ...args);
          break;
        case LogLevel.INFO:
          this.config.logger.info?.(formattedMessage, ...args);
          break;
        case LogLevel.WARN:
          this.config.logger.warn?.(formattedMessage, ...args);
          break;
        case LogLevel.ERROR:
          this.config.logger.error?.(formattedMessage, ...args);
          break;
      }
    } catch {
      // Silent if external logger fails
      // Do not crash SDK due to logging issues
    }
  }
}
