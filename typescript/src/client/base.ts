import { DEFAULT_TIMEOUT, DEFAULT_RETRY_ATTEMPTS, DEFAULT_RETRY_DELAY } from "../utils/constants";
import { Config } from "../types/client";
import { APIError, ValidationError } from "../types/errors";
import { LoggingConfig, LogLevel } from "../types/logger";
import { generateAuthHeaders } from "../utils/auth";
import { SDKLogger } from "../utils/logger";

/**
 * Base client class with common functionality
 */
export abstract class BaseClient {
  protected config: Config;
  protected logger: SDKLogger;

  constructor(config: Config) {
    this.config = config;
    this.logger = new SDKLogger(config.logging);
    this.validateConfig(config);
  }

  /**
   * Validate the configuration object
   * @param config Configuration to validate
   * @throws {ValidationError} If configuration is invalid
   */
  private validateConfig(config: Config): void {
    this.logger.debug("Starting configuration validation");

    // Check if config exists
    if (!config || typeof config !== "object") {
      throw new ValidationError("Configuration object is required");
    }

    // Validate required string fields
    this.validateRequiredString(config.apiKey, "apiKey");
    this.validateRequiredString(config.userSecret, "userSecret");
    this.validateRequiredString(config.endpoint, "endpoint");
    this.validateRequiredString(config.wsEndpoint, "wsEndpoint");

    // Validate URLs
    this.validateUrl(config.endpoint, "endpoint", ["http:", "https:"]);
    this.validateWebSocketUrls(config.wsEndpoint);

    // Validate optional numeric fields
    if (config.timeout !== undefined) {
      this.validatePositiveNumber(config.timeout, "timeout");
    }
    if (config.retryAttempts !== undefined) {
      this.validateNonNegativeNumber(config.retryAttempts, "retryAttempts");
    }
    if (config.retryDelay !== undefined) {
      this.validateNonNegativeNumber(config.retryDelay, "retryDelay");
    }
    if (config.haConnectionTimeout !== undefined) {
      this.validatePositiveNumber(config.haConnectionTimeout, "haConnectionTimeout");
    }

    // Validate boolean fields
    if (config.haMode !== undefined && typeof config.haMode !== "boolean") {
      throw new ValidationError("haMode must be a boolean");
    }

    // Validate callback function
    if (config.connectionStatusCallback !== undefined && typeof config.connectionStatusCallback !== "function") {
      throw new ValidationError("connectionStatusCallback must be a function");
    }

    // Validate logging config
    this.validateLoggingConfig(config.logging);

    this.logger.debug("Configuration validation completed successfully");
  }

  /**
   * Validate a required string field
   */
  private validateRequiredString(value: unknown, fieldName: string): void {
    if (value === undefined || value === null) {
      throw new ValidationError(`${fieldName} is required`);
    }
    if (typeof value !== "string") {
      throw new ValidationError(`${fieldName} must be a string`);
    }
    if (value.trim() === "") {
      throw new ValidationError(`${fieldName} cannot be empty`);
    }
  }

  /**
   * Validate a URL field
   */
  private validateUrl(value: string, fieldName: string, allowedProtocols: string[]): void {
    try {
      const url = new URL(value);
      if (!allowedProtocols.includes(url.protocol)) {
        throw new ValidationError(`${fieldName} must use one of these protocols: ${allowedProtocols.join(", ")}`);
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`${fieldName} must be a valid URL`);
    }
  }

  /**
   * Validate WebSocket URLs
   */
  private validateWebSocketUrls(wsEndpoint: string): void {
    const urls = wsEndpoint
      .split(",")
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urls.length === 0) {
      throw new ValidationError("wsEndpoint cannot be empty");
    }

    for (const url of urls) {
      this.validateUrl(url, "wsEndpoint", ["ws:", "wss:"]);
    }
  }

  /**
   * Validate a positive number
   */
  private validatePositiveNumber(value: unknown, fieldName: string): void {
    if (typeof value !== "number" || isNaN(value)) {
      throw new ValidationError(`${fieldName} must be a number`);
    }
    if (value <= 0) {
      throw new ValidationError(`${fieldName} must be positive`);
    }
  }

  /**
   * Validate a non-negative number
   */
  private validateNonNegativeNumber(value: unknown, fieldName: string): void {
    if (typeof value !== "number" || isNaN(value)) {
      throw new ValidationError(`${fieldName} must be a number`);
    }
    if (value < 0) {
      throw new ValidationError(`${fieldName} cannot be negative`);
    }
  }

  /**
   * Validate logging configuration
   */
  private validateLoggingConfig(logging?: LoggingConfig): void {
    if (!logging) {
      return;
    }

    // Validate logLevel
    if (logging.logLevel !== undefined) {
      if (!Object.values(LogLevel).includes(logging.logLevel)) {
        throw new ValidationError(
          `Invalid logLevel: ${logging.logLevel}. Must be one of: ${Object.values(LogLevel).join(", ")}`
        );
      }
    }

    // Validate logger functions
    if (logging.logger) {
      const logger = logging.logger;
      const validLevels = ["debug", "info", "warn", "error"] as const;

      validLevels.forEach(level => {
        if (logger[level] && typeof logger[level] !== "function") {
          throw new ValidationError(`Logger.${level} must be a function, got ${typeof logger[level]}`);
        }
      });
    }

    // Validate enableConnectionDebug
    if (logging.enableConnectionDebug !== undefined && typeof logging.enableConnectionDebug !== "boolean") {
      throw new ValidationError("enableConnectionDebug must be a boolean");
    }
  }

  /**
   * Make an authenticated HTTP request
   * @param path The API path
   * @param options Request options
   * @returns The response data
   * @throws {APIError} If the request fails
   */
  protected async makeRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = new URL(path, this.config.endpoint);
    const method = options.method || "GET";
    const body = typeof options.body === "string" ? options.body : undefined;

    this.logger.debug(`Making ${method} request to ${url}`);

    // Generate auth headers
    const authHeaders = generateAuthHeaders(this.config.apiKey, this.config.userSecret, method, url.toString(), body);

    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    Object.entries(authHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    const response = await fetch(url.toString(), {
      ...options,
      headers,
      signal: AbortSignal.timeout(this.config.timeout ?? DEFAULT_TIMEOUT),
    });

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || response.statusText;
      } catch {
        errorMessage = response.statusText;
      }
      this.logger.error(`Request failed: ${method} ${url} - ${response.status} ${errorMessage}`);
      throw new APIError(errorMessage, response.status);
    }

    this.logger.info(`Request successful: ${method} ${url} - ${response.status}`);
    return response.json() as Promise<T>;
  }

  /**
   * Retry a function with exponential backoff
   * @param fn The function to retry
   * @returns The function result
   * @throws The last error encountered
   */
  protected async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxAttempts = this.config.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
    const baseDelay = this.config.retryDelay ?? DEFAULT_RETRY_DELAY;

    this.logger.debug(`Starting retry logic: max ${maxAttempts} attempts`);

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (attempt === maxAttempts) {
          this.logger.error(`All retry attempts failed (${maxAttempts}/${maxAttempts}):`, lastError);
          break;
        }

        // Skip retry for client errors (validation/authentication)
        if (error instanceof APIError && (error.statusCode === 400 || error.statusCode === 401)) {
          this.logger.warn(`Not retrying client error ${error.statusCode}: ${error.message}`);
          throw error;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
        this.logger.warn(`Retry attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(delay)}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}
