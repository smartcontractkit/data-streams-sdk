import { BaseClient } from "./base";
import { Config, DataStreamsClient, IStream, StreamOptions } from "../types/client";
import { Feed, Report } from "../types/report";
import { validateFeedId, validateFeedIds, validateTimestamp } from "../utils/validation";
import { Stream } from "../stream";

/**
 * Main implementation of the Data Streams client
 */
export class DataStreamsClientImpl extends BaseClient implements DataStreamsClient {
  constructor(config: Config) {
    super(config);
    this.validateHAConfiguration(config);
    this.logger.info("Data Streams client initialized");
  }

  /**
   * Validate HA mode configuration
   */
  private validateHAConfiguration(config: Config): void {
    if (config.haMode) {
      const origins = this.parseOrigins(config.wsEndpoint);

      if (origins.length === 0) {
        throw new Error("HA mode enabled but no WebSocket endpoints provided");
      }
    }

    // Validate comma-separated URLs format
    if (config.wsEndpoint) {
      const origins = this.parseOrigins(config.wsEndpoint);
      for (const origin of origins) {
        if (!origin.startsWith("ws://") && !origin.startsWith("wss://")) {
          throw new Error(`Invalid WebSocket URL format: ${origin}. Must start with ws:// or wss://`);
        }
      }
    }
  }

  /**
   * Parse comma-separated WebSocket URLs
   */
  private parseOrigins(wsEndpoint: string): string[] {
    if (!wsEndpoint) {
      return [];
    }

    return wsEndpoint
      .split(",")
      .map(url => url.trim())
      .filter(url => url.length > 0);
  }

  /**
   * List all available feeds
   * @returns Array of available feeds
   */
  async listFeeds(): Promise<Feed[]> {
    this.logger.debug("Fetching available feeds");
    const response = await this.withRetry(() => this.makeRequest<{ feeds: Feed[] }>("/api/v1/feeds"));
    this.logger.debug(`Retrieved ${response.feeds.length} feeds`);
    return response.feeds;
  }

  /**
   * Get the latest report for a feed
   * @param feedId The feed ID to get the report for
   * @returns The raw report data
   */
  async getLatestReport(feedId: string): Promise<Report> {
    validateFeedId(feedId);
    this.logger.debug(`Fetching latest report for feed ${feedId}`);

    const response = await this.withRetry(() =>
      this.makeRequest<{ report: Report }>(`/api/v1/reports/latest?feedID=${feedId}`)
    );

    this.logger.debug(
      `Retrieved latest report for feed ${feedId} (timestamp: ${response.report.observationsTimestamp})`
    );
    return response.report;
  }

  /**
   * Get a report for a feed at a specific timestamp
   * @param feedId The feed ID to get the report for
   * @param timestamp The timestamp to get the report for
   * @returns The raw report data
   */
  async getReportByTimestamp(feedId: string, timestamp: number): Promise<Report> {
    validateFeedId(feedId);
    validateTimestamp(timestamp);
    this.logger.debug(`Fetching report for feed ${feedId} at timestamp ${timestamp}`);

    const response = await this.withRetry(() =>
      this.makeRequest<{ report: Report }>(`/api/v1/reports?feedID=${feedId}&timestamp=${timestamp}`)
    );

    this.logger.debug(`Retrieved report for feed ${feedId} at timestamp ${timestamp}`);
    return response.report;
  }

  /**
   * Get a range of reports for a feed
   * @param feedId The feed ID to get reports for
   * @param startTime The start timestamp, inclusive
   * @param limit Maximum number of reports to return
   * @returns Array of raw report data
   */
  async getReportsPage(feedId: string, startTime: number, limit = 10): Promise<Report[]> {
    validateFeedId(feedId);
    validateTimestamp(startTime);
    this.logger.debug(`Fetching ${limit} reports for feed ${feedId} starting from timestamp ${startTime}`);

    const response = await this.withRetry(() =>
      this.makeRequest<{ reports: Report[] }>(
        `/api/v1/reports/page?feedID=${feedId}&startTimestamp=${startTime}&limit=${limit}`
      )
    );

    this.logger.info(`Retrieved ${response.reports.length} reports for feed ${feedId} (requested: ${limit})`);
    return response.reports;
  }

  /**
   * Get reports for multiple feeds at a specific timestamp
   * @param feedIds List of feed IDs to get reports for
   * @param timestamp The timestamp to get reports for
   * @returns Array of raw report data
   * @warning Reports are not guaranteed to be returned in the same order as input feedIds.
   * Always use `report.feedID` to identify each report rather than relying on array position.
   */
  async getReportsBulk(feedIds: string[], timestamp: number): Promise<Report[]> {
    validateFeedIds(feedIds);
    validateTimestamp(timestamp);
    this.logger.debug(`Fetching bulk reports for ${feedIds.length} feeds at timestamp ${timestamp}`);

    const response = await this.withRetry(() =>
      this.makeRequest<{ reports: Report[] }>(
        `/api/v1/reports/bulk?feedIDs=${feedIds.join(",")}&timestamp=${timestamp}`
      )
    );

    this.logger.info(`Retrieved ${response.reports.length} bulk reports for timestamp ${timestamp}`);
    return response.reports;
  }

  /**
   * Create a new Stream instance for real-time data streaming.
   *
   * @param feedIds Feed ID(s) to stream
   * @param options Optional stream configuration
   * @returns Stream instance for real-time report processing
   */
  createStream(feedIds: string | string[], options?: StreamOptions): IStream {
    const feedIdArray = Array.isArray(feedIds) ? feedIds : [feedIds];
    feedIdArray.forEach(validateFeedId);

    this.logger.debug(`Creating stream for ${feedIdArray.length} feeds: ${feedIdArray.join(", ")}`);

    const streamOptions = options
      ? {
          reconnectInterval: options.reconnectInterval,
          maxReconnectAttempts: options.maxReconnectAttempts,
        }
      : {};

    const stream = new Stream(this.config, feedIdArray, streamOptions);
    this.logger.info(`Stream created successfully for ${feedIdArray.length} feed(s)`);
    return stream as IStream;
  }
}
