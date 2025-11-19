/**
 * Chainlink Data Streams TypeScript SDK
 *
 * A comprehensive SDK for accessing Chainlink Data Streams with full developer control.
 * Features event-driven architecture, High Availability mode, automatic failover,
 * and monitoring capabilities.
 *
 * @example Basic Usage
 * ```typescript
 * import { createClient } from '@chainlink/data-streams-sdk';
 *
 * const client = createClient({
 *   apiKey: 'your_api_key',
 *   userSecret: 'your_user_secret',
 *   endpoint: 'https://api.testnet-dataengine.chain.link',
 *   wsEndpoint: 'wss://ws.testnet-dataengine.chain.link'
 * });
 *
 * // Event-driven streaming with full developer control
 * const stream = client.createStream(['0x00037da06d56d083670...']);
 * stream.on('report', (report) => {
 *   console.log(`Price: ${report.price}, Feed: ${report.feedID}`);
 * });
 * stream.on('error', (error) => console.error('Error:', error));
 * await stream.connect();
 * ```
 *
 * @example High Availability Mode
 * ```typescript
 * const client = createClient({
 *   // ... auth config
 *   wsEndpoint: 'wss://ws1.example.com,wss://ws2.example.com',
 *   haMode: true,
 * });
 *
 * const stream = client.createStream(feedIds);
 * stream.on('report', (report) => processReport(report));
 * await stream.connect();
 * ```
 */

// Core functionality
export { createClient } from "./client";
export { decodeReport } from "./decoder";
export { Stream } from "./stream";

// Types
export type { Config, DataStreamsClient } from "./types/client";
export type {
  Feed,
  Report,
  DecodedReport,
  DecodedV2Report,
  DecodedV3Report,
  DecodedV4Report,
  DecodedV5Report,
  DecodedV6Report,
  DecodedV7Report,
  DecodedV8Report,
  DecodedV9Report,
  DecodedV10Report,
  DecodedV11Report,
  DecodedV13Report,
  MarketStatus,
} from "./types/report";
export type { Logger, LoggingConfig } from "./types/logger";
export { LogLevel } from "./types/logger";
export type { StreamOptions } from "./stream";
export type { MetricsSnapshot } from "./types/metrics";
export { ConnectionStatus } from "./types/metrics";
export * from "./types/errors";

// Utility Functions
export {
  // Report utilities
  getReportVersion,
  formatReport,
  // Time utilities
  getCurrentTimestamp,
  // Authentication Headers
  generateAuthHeaders,
} from "./utils";

// Constants
export { DEFAULT_CONFIG } from "./defaultConfig";
export { DEFAULT_TIMEOUT, DEFAULT_RETRY_ATTEMPTS, DEFAULT_RETRY_DELAY } from "./utils/constants";
