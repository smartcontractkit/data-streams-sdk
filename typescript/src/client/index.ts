import { Config, DataStreamsClient } from "../types/client";
import { DataStreamsClientImpl } from "./implementation";

/**
 * Create a new Data Streams client
 * @param config Client configuration
 * @returns A Data Streams client instance
 */
export function createClient(config: Config): DataStreamsClient {
  return new DataStreamsClientImpl(config);
}

export { DataStreamsClientImpl };
export type { DataStreamsClient };
