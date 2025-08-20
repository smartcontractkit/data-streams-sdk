/**
 * Hierarchical logging levels for the Data Streams SDK.
 *
 * Used to filter logs based on their importance and severity.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Simple logging function compatible with most external loggers.
 *
 * @param message - Primary message to log
 * @param args - Additional arguments (objects, errors, etc.)
 */
export type LogFunction = (message: string, ...args: any[]) => void;

/**
 * Simple logger interface for the Data Streams SDK.
 *
 * All methods are optional for maximum flexibility.
 * Compatible with console, winston, pino, and other popular loggers.
 *
 * @example
 * ```typescript
 * const logger: Logger = {
 *   info: console.log,
 *   error: console.error,
 *   debug: (msg, ...args) => winston.debug(msg, ...args)
 * };
 * ```
 */
export interface Logger {
  debug?: LogFunction;
  info?: LogFunction;
  warn?: LogFunction;
  error?: LogFunction;
}

/**
 * Complete logging system configuration for the SDK.
 *
 * Silent by default. Activated only when explicitly configured.
 *
 * @example Basic logging
 * ```typescript
 * const config: LoggingConfig = {
 *   logger: { info: console.log, error: console.error }
 * };
 * ```
 *
 * @example Advanced logging with fine control
 * ```typescript
 * const config: LoggingConfig = {
 *   logger: myWinstonLogger,
 *   logLevel: LogLevel.INFO,
 *   enableConnectionDebug: true
 * };
 * ```
 */
export interface LoggingConfig {
  /** Logger instance (optional) */
  logger?: Logger;
  /** Minimum logging level */
  logLevel?: LogLevel;
  /** Enable debug logs for WebSocket connections */
  enableConnectionDebug?: boolean;
}
