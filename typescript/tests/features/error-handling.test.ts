/**
 * Comprehensive Error Handling Tests
 *
 * These tests validate the error handling system by:
 * - Testing all custom error types and their properties
 * - Testing error inheritance and instanceof checks
 * - Testing error message formatting and clarity
 * - Testing error context preservation across operations
 * - Testing error recovery scenarios and graceful degradation
 * - Testing error propagation through async operations
 *
 * Goals:
 * - Ensure robust error handling that provides clear debugging information
 * - Test all error scenarios comprehensively
 * - Validate error recovery and graceful degradation
 * - Provide excellent developer experience with meaningful error messages
 * - Build the best possible TypeScript error handling system
 */

import { describe, it, expect } from "@jest/globals";
import {
  DataStreamsError,
  ValidationError,
  AuthenticationError,
  ReportDecodingError,
  WebSocketError,
  APIError,
  OriginDiscoveryError,
  MultiConnectionError,
  PartialConnectionFailureError,
  InsufficientConnectionsError,
} from "../../src/types/errors";

describe("Error Handling Tests", () => {
  describe("custom error types", () => {
    describe("DataStreamsError (base class)", () => {
      it("should create error with message", () => {
        const error = new DataStreamsError("Test error message");

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DataStreamsError);
        expect(error.name).toBe("DataStreamsError");
        expect(error.message).toBe("Test error message");
        expect(error.stack).toBeDefined();
      });

      it("should preserve stack trace", () => {
        const error = new DataStreamsError("Test error");

        expect(error.stack).toBeDefined();
        expect(error.stack).toContain("DataStreamsError");
        expect(error.stack).toContain("Test error");
      });
    });

    describe("ValidationError", () => {
      it("should create validation error", () => {
        const error = new ValidationError("Invalid feed ID format");

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DataStreamsError);
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.name).toBe("ValidationError");
        expect(error.message).toBe("Invalid feed ID format");
      });

      it("should handle feed ID validation errors", () => {
        const feedId = "invalid-feed-id";
        const error = new ValidationError(`Feed ID must be a valid hex string starting with 0x: ${feedId}`);

        expect(error.message).toContain("Feed ID must be a valid hex string");
        expect(error.message).toContain(feedId);
      });

      it("should handle timestamp validation errors", () => {
        const timestamp = -1;
        const error = new ValidationError(`Timestamp cannot be negative: ${timestamp}`);

        expect(error.message).toContain("Timestamp cannot be negative");
        expect(error.message).toContain(String(timestamp));
      });
    });

    describe("AuthenticationError", () => {
      it("should create authentication error", () => {
        const error = new AuthenticationError("Invalid API key");

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DataStreamsError);
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.name).toBe("AuthenticationError");
        expect(error.message).toBe("Invalid API key");
      });

      it("should handle signature validation errors", () => {
        const error = new AuthenticationError("HMAC signature validation failed");

        expect(error.message).toContain("HMAC signature validation failed");
      });

      it("should handle timestamp skew errors", () => {
        const error = new AuthenticationError("Request timestamp too old or too far in the future");

        expect(error.message).toContain("Request timestamp");
      });
    });

    describe("APIError", () => {
      it("should create API error", () => {
        const error = new APIError("Connection timeout");

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DataStreamsError);
        expect(error).toBeInstanceOf(APIError);
        expect(error.name).toBe("APIError");
        expect(error.message).toBe("Connection timeout");
      });

      it("should create API error with status code", () => {
        const error = new APIError("HTTP 500: Internal Server Error", 500);

        expect(error.message).toBe("HTTP 500: Internal Server Error");
        expect(error.statusCode).toBe(500);
      });

      it("should handle missing status code", () => {
        const error = new APIError("Network unreachable");

        expect(error.message).toBe("Network unreachable");
        expect(error.statusCode).toBeUndefined();
      });
    });

    describe("ReportDecodingError", () => {
      it("should create report decoding error", () => {
        const error = new ReportDecodingError("Invalid report format");

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DataStreamsError);
        expect(error).toBeInstanceOf(ReportDecodingError);
        expect(error.name).toBe("ReportDecodingError");
        expect(error.message).toBe("Invalid report format");
      });

      it("should handle ABI decoding errors", () => {
        const error = new ReportDecodingError("Failed to decode V3 report: insufficient data");

        expect(error.message).toContain("Failed to decode V3 report");
        expect(error.message).toContain("insufficient data");
      });

      it("should handle version validation errors", () => {
        const version = "0x0099";
        const error = new ReportDecodingError(`Unknown report version: ${version}`);

        expect(error.message).toContain("Unknown report version");
        expect(error.message).toContain(version);
      });
    });

    describe("WebSocketError", () => {
      it("should create WebSocket error", () => {
        const error = new WebSocketError("WebSocket connection failed");

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DataStreamsError);
        expect(error).toBeInstanceOf(WebSocketError);
        expect(error.name).toBe("WebSocketError");
        expect(error.message).toBe("WebSocket connection failed");
      });

      it("should handle connection errors", () => {
        const url = "wss://example.com";
        const error = new WebSocketError(`Failed to connect to ${url}`);

        expect(error.message).toContain("Failed to connect to");
        expect(error.message).toContain(url);
      });

      it("should handle message parsing errors", () => {
        const error = new WebSocketError("Invalid message format received from stream");

        expect(error.message).toContain("Invalid message format");
      });
    });

    describe("OriginDiscoveryError", () => {
      it("should create origin discovery error", () => {
        const error = new OriginDiscoveryError("Failed to discover origins");

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DataStreamsError);
        expect(error).toBeInstanceOf(OriginDiscoveryError);
        expect(error.name).toBe("OriginDiscoveryError");
        expect(error.message).toBe("Failed to discover origins");
      });

      it("should create origin discovery error with cause", () => {
        const cause = new Error("Network timeout");
        const error = new OriginDiscoveryError("Failed to discover origins", cause);

        expect(error.message).toBe("Failed to discover origins");
        expect(error.cause).toBe(cause);
      });

      it("should handle HEAD request failures", () => {
        const url = "https://api.example.com";
        const error = new OriginDiscoveryError(`HEAD request failed for ${url}: 404 Not Found`);

        expect(error.message).toContain("HEAD request failed");
        expect(error.message).toContain(url);
        expect(error.message).toContain("404 Not Found");
      });

      it("should handle header parsing errors", () => {
        const error = new OriginDiscoveryError("Invalid X-Cll-Available-Origins header format");

        expect(error.message).toContain("X-Cll-Available-Origins header");
      });
    });

    describe("MultiConnectionError", () => {
      it("should create multi-connection error", () => {
        const error = new MultiConnectionError("Failed to establish multiple connections");

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DataStreamsError);
        expect(error).toBeInstanceOf(MultiConnectionError);
        expect(error.name).toBe("MultiConnectionError");
        expect(error.message).toBe("Failed to establish multiple connections");
      });

      it("should handle connection failure details", () => {
        const failedOrigins = ["wss://origin1.example.com", "wss://origin2.example.com"];
        const error = new MultiConnectionError(`Failed to connect to origins: ${failedOrigins.join(", ")}`);

        expect(error.message).toContain("Failed to connect to origins");
        expect(error.message).toContain("origin1.example.com");
        expect(error.message).toContain("origin2.example.com");
      });
    });

    describe("PartialConnectionFailureError", () => {
      it("should create partial connection failure error", () => {
        const error = new PartialConnectionFailureError("Some connections failed", 2, 4);

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DataStreamsError);
        expect(error).toBeInstanceOf(PartialConnectionFailureError);
        expect(error.name).toBe("PartialConnectionFailureError");
        expect(error.message).toBe("Some connections failed");
        expect(error.failedConnections).toBe(2);
        expect(error.totalConnections).toBe(4);
      });

      it("should handle partial failure details", () => {
        const activeCount = 2;
        const totalCount = 4;
        const error = new PartialConnectionFailureError(
          `Partial connection failure: ${activeCount}/${totalCount} connections active`,
          totalCount - activeCount,
          totalCount
        );

        expect(error.message).toContain("Partial connection failure");
        expect(error.message).toContain("2/4 connections active");
        expect(error.failedConnections).toBe(2);
        expect(error.totalConnections).toBe(4);
      });
    });

    describe("InsufficientConnectionsError", () => {
      it("should create insufficient connections error", () => {
        const error = new InsufficientConnectionsError("No active connections available", 0, 2);

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DataStreamsError);
        expect(error).toBeInstanceOf(InsufficientConnectionsError);
        expect(error.name).toBe("InsufficientConnectionsError");
        expect(error.message).toBe("No active connections available");
        expect(error.availableConnections).toBe(0);
        expect(error.requiredConnections).toBe(2);
      });

      it("should handle minimum connection requirements", () => {
        const required = 2;
        const available = 0;
        const error = new InsufficientConnectionsError(
          `Insufficient connections: need ${required}, have ${available}`,
          available,
          required
        );

        expect(error.message).toContain("Insufficient connections");
        expect(error.message).toContain("need 2, have 0");
        expect(error.availableConnections).toBe(0);
        expect(error.requiredConnections).toBe(2);
      });
    });
  });

  describe("error inheritance and instanceof checks", () => {
    it("should properly inherit from base Error class", () => {
      const errors = [
        new DataStreamsError("test"),
        new ValidationError("test"),
        new AuthenticationError("test"),
        new ReportDecodingError("test"),
        new WebSocketError("test"),
        new APIError("test"),
        new OriginDiscoveryError("test"),
        new MultiConnectionError("test"),
        new PartialConnectionFailureError("test", 1, 2),
        new InsufficientConnectionsError("test", 0, 1),
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DataStreamsError);
        expect(error.name).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.stack).toBeDefined();
      });
    });

    it("should support instanceof checks for specific error types", () => {
      const validationError = new ValidationError("validation error");
      const authError = new AuthenticationError("auth error");
      const apiError = new APIError("api error");

      expect(validationError instanceof ValidationError).toBe(true);
      expect(validationError instanceof AuthenticationError).toBe(false);
      expect(validationError instanceof APIError).toBe(false);

      expect(authError instanceof AuthenticationError).toBe(true);
      expect(authError instanceof ValidationError).toBe(false);
      expect(authError instanceof APIError).toBe(false);

      expect(apiError instanceof APIError).toBe(true);
      expect(apiError instanceof ValidationError).toBe(false);
      expect(apiError instanceof AuthenticationError).toBe(false);
    });

    it("should support polymorphic error handling", () => {
      const errors: DataStreamsError[] = [
        new ValidationError("validation error"),
        new AuthenticationError("auth error"),
        new APIError("api error"),
      ];

      errors.forEach(error => {
        expect(error instanceof DataStreamsError).toBe(true);
        expect(error instanceof Error).toBe(true);

        // Should be able to access base properties
        expect(typeof error.name).toBe("string");
        expect(typeof error.message).toBe("string");
        expect(error.stack).toBeDefined();
      });
    });
  });

  describe("error message formatting", () => {
    it("should provide clear and descriptive error messages", () => {
      const testCases = [
        {
          error: new ValidationError("Missing required configuration field: apiKey"),
          expectedPatterns: ["Missing required", "apiKey"],
        },
        {
          error: new ValidationError("Feed ID must be a 64-character hex string starting with 0x"),
          expectedPatterns: ["Feed ID", "64-character hex string", "0x"],
        },
        {
          error: new AuthenticationError("HMAC signature mismatch: expected abc123, got def456"),
          expectedPatterns: ["HMAC signature mismatch", "expected", "got"],
        },
        {
          error: new APIError("HTTP 429: Rate limit exceeded. Retry after 60 seconds", 429),
          expectedPatterns: ["HTTP 429", "Rate limit exceeded", "Retry after"],
        },
        {
          error: new ReportDecodingError("Failed to decode V3 report: missing bid field"),
          expectedPatterns: ["Failed to decode", "V3 report", "missing bid field"],
        },
      ];

      testCases.forEach(({ error, expectedPatterns }) => {
        expectedPatterns.forEach(pattern => {
          expect(error.message).toContain(pattern);
        });
      });
    });

    it("should include relevant context in error messages", () => {
      const feedId = "0x0003" + "1".repeat(60);
      const timestamp = 1640995200;
      const url = "https://api.example.com";

      const errors = [
        new ValidationError(`Invalid feed ID format: ${feedId}`),
        new ValidationError(`Timestamp cannot be negative: ${timestamp}`),
        new APIError(`Failed to connect to ${url}: Connection refused`),
        new OriginDiscoveryError(`Origin discovery failed for ${url}: 404 Not Found`),
      ];

      expect(errors[0].message).toContain(feedId);
      expect(errors[1].message).toContain(String(timestamp));
      expect(errors[2].message).toContain(url);
      expect(errors[3].message).toContain(url);
    });

    it("should format error messages consistently", () => {
      const errors = [
        new ValidationError("Invalid endpoint URL"),
        new ValidationError("Invalid feed ID format"),
        new AuthenticationError("Invalid API key"),
        new APIError("Connection timeout"),
        new ReportDecodingError("Invalid report format"),
      ];

      errors.forEach(error => {
        // Should start with a capital letter
        expect(error.message.charAt(0)).toMatch(/[A-Z]/);

        // Should not end with a period (for consistency)
        expect(error.message).not.toMatch(/\.$/);

        // Should be non-empty
        expect(error.message.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Documentation Test: error recovery scenarios", () => {
    // These tests demonstrate example error handling patterns
    it("should demonstrate graceful degradation on partial failures", () => {
      const partialError = new PartialConnectionFailureError("2 of 4 connections failed", 2, 4);

      // Simulate recovery logic
      function handlePartialFailure(error: PartialConnectionFailureError): { canContinue: boolean; message: string } {
        if (error instanceof PartialConnectionFailureError) {
          return {
            canContinue: true,
            message: "Continuing with reduced connection count",
          };
        }
        return { canContinue: false, message: "Cannot recover" };
      }

      const result = handlePartialFailure(partialError);
      expect(result.canContinue).toBe(true);
      expect(result.message).toContain("reduced connection count");
    });

    it("should demonstrate retry logic patterns for recoverable errors", () => {
      const retryableErrors = [
        new APIError("HTTP 500: Internal Server Error", 500),
        new APIError("HTTP 502: Bad Gateway", 502),
        new APIError("HTTP 503: Service Unavailable", 503),
        new APIError("Connection timeout"),
      ];

      const nonRetryableErrors = [
        new AuthenticationError("Invalid API key"),
        new ValidationError("Invalid feed ID"),
        new ValidationError("Missing endpoint URL"),
      ];

      function isRetryable(error: DataStreamsError): boolean {
        if (error instanceof APIError) {
          return (
            error.statusCode === 500 ||
            error.statusCode === 502 ||
            error.statusCode === 503 ||
            error.message.includes("timeout")
          );
        }
        return false;
      }

      retryableErrors.forEach(error => {
        expect(isRetryable(error)).toBe(true);
      });

      nonRetryableErrors.forEach(error => {
        expect(isRetryable(error)).toBe(false);
      });
    });

    it("should handle fallback mechanisms", () => {
      const primaryError = new OriginDiscoveryError("Failed to discover origins");

      function handleOriginDiscoveryFailure(error: OriginDiscoveryError): { fallbackUrl: string; message: string } {
        if (error instanceof OriginDiscoveryError) {
          return {
            fallbackUrl: "wss://fallback.example.com",
            message: "Using fallback URL due to origin discovery failure",
          };
        }
        throw error;
      }

      const result = handleOriginDiscoveryFailure(primaryError);
      expect(result.fallbackUrl).toBe("wss://fallback.example.com");
      expect(result.message).toContain("fallback URL");
    });
  });

  describe("error propagation through async operations", () => {
    it("should demonstrate error wrapping with cause preservation", async () => {
      async function simulateOriginDiscovery(): Promise<string[]> {
        try {
          // Simulates system errors that can occur during network operations
          const systemError = new Error("Network timeout");
          systemError.name = "AbortError"; // Simulates fetch timeout
          throw systemError;
        } catch (error) {
          // SDK: wrap system errors while preserving original context
          throw new OriginDiscoveryError("Failed to discover origins during HA setup", error as Error);
        }
      }

      // Verify the wrapped error maintains both high-level context and system details
      await expect(simulateOriginDiscovery()).rejects.toThrow(OriginDiscoveryError);

      try {
        await simulateOriginDiscovery();
      } catch (error) {
        // Type guard for proper TS handling
        expect(error).toBeInstanceOf(OriginDiscoveryError);

        const originError = error as OriginDiscoveryError;

        // Validate SDK level error info
        expect(originError.message).toBe("Failed to discover origins during HA setup");

        // Verify system error is preserved
        expect(originError.cause).toBeDefined();
        expect(originError.cause).toBeInstanceOf(Error);
        expect(originError.cause!.name).toBe("AbortError");
        expect(originError.cause!.message).toBe("Network timeout");
      }
    });

    it("should handle concurrent error scenarios", async () => {
      async function failingTask(id: number, delay: number): Promise<string> {
        await new Promise(resolve => setTimeout(resolve, delay));
        throw new APIError(`Task ${id} failed`);
      }

      const tasks = [failingTask(1, 10), failingTask(2, 20), failingTask(3, 5)];

      // Test Promise.allSettled behavior with custom errors
      const results = await Promise.allSettled(tasks);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.status).toBe("rejected");
        if (result.status === "rejected") {
          expect(result.reason).toBeInstanceOf(APIError);
          expect(result.reason.message).toContain(`Task ${index + 1} failed`);
        }
      });
    });
  });

  describe("error serialization and debugging", () => {
    it("should provide useful toString representation", () => {
      const error = new ValidationError("Invalid endpoint URL");
      const stringRep = error.toString();

      expect(stringRep).toContain("ValidationError");
      expect(stringRep).toContain("Invalid endpoint URL");
    });

    it("should be JSON serializable for logging", () => {
      const error = new APIError("Connection timeout", 408);

      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
        stack: error.stack,
      });

      const parsed = JSON.parse(serialized);
      expect(parsed.name).toBe("APIError");
      expect(parsed.message).toBe("Connection timeout");
      expect(parsed.statusCode).toBe(408);
      expect(parsed.stack).toBeDefined();
    });

    it("should maintain error information across JSON serialization", () => {
      const originalError = new ValidationError("Invalid feed ID format");

      // Simulate logging/serialization
      const errorInfo = {
        type: originalError.constructor.name,
        name: originalError.name,
        message: originalError.message,
        timestamp: new Date().toISOString(),
      };

      const serialized = JSON.stringify(errorInfo);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.type).toBe("ValidationError");
      expect(deserialized.name).toBe("ValidationError");
      expect(deserialized.message).toBe("Invalid feed ID format");
      expect(deserialized.timestamp).toBeDefined();
    });
  });

  describe("Documentation Test: error handling best practices", () => {
    // These tests demonstrate recommended error handling patterns
    it("should demonstrate error filtering and categorization patterns", () => {
      const errors = [
        new ValidationError("Missing API key"),
        new APIError("Connection timeout"),
        new ValidationError("Invalid feed ID"),
        new AuthenticationError("Expired token"),
        new ReportDecodingError("Malformed report"),
      ];

      const userErrors = errors.filter(error => error instanceof ValidationError);

      const systemErrors = errors.filter(error => error instanceof APIError || error instanceof ReportDecodingError);

      const securityErrors = errors.filter(error => error instanceof AuthenticationError);

      expect(userErrors).toHaveLength(2);
      expect(systemErrors).toHaveLength(2);
      expect(securityErrors).toHaveLength(1);
    });

    it("should demonstrate error severity classification patterns", () => {
      function getErrorSeverity(error: DataStreamsError): "low" | "medium" | "high" | "critical" {
        if (error instanceof ValidationError) {
          return "medium";
        }
        if (error instanceof AuthenticationError) {
          return "high";
        }
        if (error instanceof APIError || error instanceof ReportDecodingError) {
          return "low";
        }
        if (error instanceof InsufficientConnectionsError) {
          return "critical";
        }
        return "medium";
      }

      const testCases = [
        { error: new ValidationError("test"), expectedSeverity: "medium" },
        { error: new AuthenticationError("test"), expectedSeverity: "high" },
        { error: new APIError("test"), expectedSeverity: "low" },
        { error: new InsufficientConnectionsError("test", 0, 1), expectedSeverity: "critical" },
      ];

      testCases.forEach(({ error, expectedSeverity }) => {
        expect(getErrorSeverity(error)).toBe(expectedSeverity);
      });
    });

    it("should support error aggregation for batch operations", () => {
      const errors = [
        new ValidationError("Feed ID 1 invalid"),
        new ValidationError("Feed ID 2 invalid"),
        new APIError("Connection failed"),
      ];

      class BatchError extends DataStreamsError {
        constructor(public readonly errors: DataStreamsError[]) {
          super(`Batch operation failed with ${errors.length} errors`);
          this.name = "BatchError";
        }
      }

      const batchError = new BatchError(errors);

      expect(batchError.errors).toHaveLength(3);
      expect(batchError.message).toContain("3 errors");
      expect(batchError.errors[0]).toBeInstanceOf(ValidationError);
      expect(batchError.errors[2]).toBeInstanceOf(APIError);
    });
  });
});
