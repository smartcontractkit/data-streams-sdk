import { Config } from "./types/client";
import { WS_CONSTANTS, DEFAULT_TIMEOUT, DEFAULT_RETRY_ATTEMPTS, DEFAULT_RETRY_DELAY } from "./utils/constants";

/**
 * Default configuration for the Data Streams client
 */
export const DEFAULT_CONFIG: Partial<Config> = {
  endpoint: "https://api.testnet-dataengine.chain.link",
  wsEndpoint: "wss://ws.testnet-dataengine.chain.link",
  retryAttempts: DEFAULT_RETRY_ATTEMPTS,
  retryDelay: DEFAULT_RETRY_DELAY,
  timeout: DEFAULT_TIMEOUT,
  // HA mode defaults
  haMode: false, // Disabled by default
  haConnectionTimeout: WS_CONSTANTS.CONNECT_TIMEOUT,
  // Logging defaults
  logging: undefined, // Silent by default
} as const;
