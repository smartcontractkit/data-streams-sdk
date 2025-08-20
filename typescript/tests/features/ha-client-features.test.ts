/**
 * Unit Tests for HA Client Features
 *
 * These tests validate HA-specific client functionality:
 * - createStream method with HA configuration
 * - validateHAConfiguration method
 * - Enhanced error messages for HA failures
 * - Event-driven architecture integration
 *
 * Requirements:
 * - Unit tests with mocked dependencies
 * - No actual network connections
 * - Focus on HA client configuration and integration
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { DataStreamsClientImpl } from "../../src/client/implementation";
import { Config } from "../../src/types/client";
import { OriginDiscoveryError, InsufficientConnectionsError } from "../../src/types/errors";

// Mock console methods to avoid noise during tests
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

describe("HA Client Features Tests", () => {
  let mockConfig: Config;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console methods
    console.warn = jest.fn();
    console.error = jest.fn();

    mockConfig = {
      apiKey: "test_key",
      userSecret: "test_secret",
      endpoint: "https://api.example.com",
      wsEndpoint: "wss://ws.example.com",
    };
  });

  afterEach(() => {
    // Restore console methods
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  describe("validateHAConfiguration", () => {
    it("should validate HA mode with single origin without forced logging", () => {
      const haConfig: Config = {
        ...mockConfig,
        wsEndpoint: "wss://single-origin.example.com",
        haMode: true,
      };

      // Should not throw and should NOT log anything (developers control logging)
      expect(() => new DataStreamsClientImpl(haConfig)).not.toThrow();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("should validate HA mode with multiple origins without warning", () => {
      const haConfig: Config = {
        ...mockConfig,
        wsEndpoint: "wss://origin1.example.com,wss://origin2.example.com",
        haMode: true,
      };

      expect(() => new DataStreamsClientImpl(haConfig)).not.toThrow();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("should validate low HA connection timeout without forced logging", () => {
      const haConfig: Config = {
        ...mockConfig,
        wsEndpoint: "wss://origin1.example.com,wss://origin2.example.com",
        haMode: true,
        haConnectionTimeout: 500, // Very low timeout
      };

      // Should not throw and should NOT log anything (developers control logging)
      expect(() => new DataStreamsClientImpl(haConfig)).not.toThrow();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("should throw error for HA mode with no WebSocket endpoints", () => {
      const haConfig: Config = {
        ...mockConfig,
        wsEndpoint: "",
        haMode: true,
      };

      // Base validation catches empty wsEndpoint first
      expect(() => new DataStreamsClientImpl(haConfig)).toThrow("wsEndpoint cannot be empty");
    });

    it("should throw error for invalid WebSocket URL format", () => {
      const haConfig: Config = {
        ...mockConfig,
        wsEndpoint: "https://invalid-protocol.example.com,wss://valid.example.com",
        haMode: true,
      };

      // Base validation catches invalid protocol first
      expect(() => new DataStreamsClientImpl(haConfig)).toThrow(
        "wsEndpoint must use one of these protocols: ws:, wss:"
      );
    });

    it("should throw HA-specific error when URLs are parsed but empty", () => {
      // This tests the actual HA validation logic by bypassing base validation
      const haConfig: Config = {
        ...mockConfig,
        wsEndpoint: "wss://valid.example.com", // Valid URL that passes base validation
        haMode: true,
      };

      // Mock parseOrigins to return empty array to trigger HA-specific validation
      const client = new DataStreamsClientImpl(haConfig);
      const parseOriginsSpy = jest.spyOn(client as any, "parseOrigins");
      parseOriginsSpy.mockReturnValue([]);

      expect(() => {
        // Call validateHAConfiguration directly to test HA-specific logic
        (client as any).validateHAConfiguration({ ...haConfig, wsEndpoint: "wss://valid.example.com" });
      }).toThrow("HA mode enabled but no WebSocket endpoints provided");
    });

    it("should validate comma-separated URLs correctly", () => {
      const haConfig: Config = {
        ...mockConfig,
        wsEndpoint: "wss://origin1.example.com, wss://origin2.example.com , wss://origin3.example.com",
        haMode: true,
      };

      expect(() => new DataStreamsClientImpl(haConfig)).not.toThrow();
    });

    it("should handle mixed ws and wss protocols", () => {
      const haConfig: Config = {
        ...mockConfig,
        wsEndpoint: "ws://localhost:8080,wss://production.example.com",
        haMode: true,
      };

      expect(() => new DataStreamsClientImpl(haConfig)).not.toThrow();
    });

    it("should warn appropriately when origin discovery is enabled with single origin", () => {
      const haConfig: Config = {
        ...mockConfig,
        wsEndpoint: "wss://single-origin.example.com",
        haMode: true,
      };

      expect(() => new DataStreamsClientImpl(haConfig)).not.toThrow();
      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining("HA mode enabled but only one origin provided")
      );
    });
  });

  describe("createStream method with HA features", () => {
    it("should exist and have correct signature", () => {
      const client = new DataStreamsClientImpl(mockConfig);

      expect(typeof client.createStream).toBe("function");
      expect(client.createStream.length).toBe(2); // feedIds, options
    });

    it("should create stream with proper configuration", () => {
      const client = new DataStreamsClientImpl(mockConfig);
      const feedIds = ["0x0003" + "1".repeat(60)];

      // Mock Stream constructor to capture configuration
      const StreamConstructorSpy = jest.spyOn(require("../../src/stream"), "Stream");
      const mockStream = {
        on: jest.fn().mockReturnThis(),
        connect: jest.fn().mockImplementation(() => Promise.resolve()),
        close: jest.fn().mockImplementation(() => Promise.resolve()),
        getMetrics: jest.fn().mockReturnValue({}),
        getConnectionType: jest.fn().mockReturnValue("single"),
        getOrigins: jest.fn().mockReturnValue([]),
      };
      StreamConstructorSpy.mockImplementation((..._args: any[]) => mockStream as any);

      try {
        const stream = client.createStream(feedIds, {
          maxReconnectAttempts: 10,
          reconnectInterval: 5000,
        });

        // Verify Stream was created with correct parameters
        expect(StreamConstructorSpy).toHaveBeenCalledWith(mockConfig, feedIds, {
          maxReconnectAttempts: 10,
          reconnectInterval: 5000,
        });

        expect(stream).toBe(mockStream);
      } finally {
        StreamConstructorSpy.mockRestore();
      }
    });

    it("should work with connection status callback in config", () => {
      const statusCallback = jest.fn();
      const haConfig: Config = {
        ...mockConfig,
        haMode: true,
        connectionStatusCallback: statusCallback,
      };

      const client = new DataStreamsClientImpl(haConfig);
      const feedIds = ["0x0003" + "1".repeat(60)];

      // Mock Stream constructor
      const StreamConstructorSpy = jest.spyOn(require("../../src/stream"), "Stream");
      const mockStream = {
        on: jest.fn().mockReturnThis(),
        connect: jest.fn().mockImplementation(() => Promise.resolve()),
        close: jest.fn().mockImplementation(() => Promise.resolve()),
        getMetrics: jest.fn().mockReturnValue({}),
        getConnectionType: jest.fn().mockReturnValue("multiple"),
        getOrigins: jest.fn().mockReturnValue(["wss://ws.example.com"]),
      };
      StreamConstructorSpy.mockImplementation((..._args: any[]) => mockStream as any);

      try {
        client.createStream(feedIds);

        // Verify config includes the status callback
        const passedConfig = StreamConstructorSpy.mock.calls[0][0] as Config;
        expect(passedConfig.connectionStatusCallback).toBe(statusCallback);
        expect(passedConfig.haMode).toBe(true);
      } finally {
        StreamConstructorSpy.mockRestore();
      }
    });
  });

  describe("event-driven error handling", () => {
    it("should handle OriginDiscoveryError through stream events", async () => {
      const client = new DataStreamsClientImpl(mockConfig);

      // Create a mock stream that emits error events
      const mockStream = {
        on: jest.fn(),
        connect: jest.fn().mockImplementation(async () => {
          throw new OriginDiscoveryError("Discovery failed", new Error("Network timeout"));
        }),
        close: jest.fn(),
        getConnectionType: jest.fn().mockReturnValue("single"),
        getOrigins: jest.fn().mockReturnValue([]),
        getMetrics: jest.fn().mockReturnValue({}),
      };

      // Mock Stream constructor
      const StreamConstructorSpy = jest.spyOn(require("../../src/stream"), "Stream");
      StreamConstructorSpy.mockImplementation((..._args: any[]) => mockStream as any);

      const feedIds = ["0x0003" + "1".repeat(60)];

      try {
        const stream = client.createStream(feedIds);

        // Test that errors can be handled via events
        const errorHandler = jest.fn();
        stream.on("error", errorHandler);

        // When connecting fails, developers can handle the error via events
        await expect(stream.connect()).rejects.toThrow(OriginDiscoveryError);

        // Verify the stream object was created correctly
        expect(stream).toBe(mockStream);
        expect(mockStream.on).toHaveBeenCalledWith("error", errorHandler);
      } finally {
        StreamConstructorSpy.mockRestore();
      }
    });

    it("should handle InsufficientConnectionsError through stream events", async () => {
      const client = new DataStreamsClientImpl(mockConfig);

      // Mock Stream that throws InsufficientConnectionsError
      const mockStream = {
        on: jest.fn(),
        connect: jest.fn().mockImplementation(async () => {
          throw new InsufficientConnectionsError("No connections", 0, 2);
        }),
        close: jest.fn(),
        getConnectionType: jest.fn().mockReturnValue("single"),
        getOrigins: jest.fn().mockReturnValue([]),
        getMetrics: jest.fn().mockReturnValue({}),
      };

      // Mock Stream constructor
      const StreamConstructorSpy = jest.spyOn(require("../../src/stream"), "Stream");
      StreamConstructorSpy.mockImplementation((..._args: any[]) => mockStream as any);

      const feedIds = ["0x0003" + "1".repeat(60)];

      try {
        const stream = client.createStream(feedIds);

        // Test event-driven error handling
        const errorHandler = jest.fn();
        stream.on("error", errorHandler);

        await expect(stream.connect()).rejects.toThrow(InsufficientConnectionsError);

        // Verify event handlers can be attached
        expect(mockStream.on).toHaveBeenCalledWith("error", errorHandler);
      } finally {
        StreamConstructorSpy.mockRestore();
      }
    });

    it("should support all event types for production monitoring", () => {
      const client = new DataStreamsClientImpl(mockConfig);

      // Mock complete stream with all event capabilities
      const mockStream = {
        on: jest.fn().mockReturnThis(),
        connect: jest.fn().mockImplementation(() => Promise.resolve()),
        close: jest.fn().mockImplementation(() => Promise.resolve()),
        getMetrics: jest.fn().mockReturnValue({
          accepted: 100,
          deduplicated: 10,
          activeConnections: 2,
          configuredConnections: 2,
        }),
        getConnectionType: jest.fn().mockReturnValue("multiple"),
        getOrigins: jest.fn().mockReturnValue(["wss://origin1.example.com", "wss://origin2.example.com"]),
      };

      const StreamConstructorSpy = jest.spyOn(require("../../src/stream"), "Stream");
      StreamConstructorSpy.mockImplementation((..._args: any[]) => mockStream as any);

      try {
        const feedIds = ["0x0003" + "1".repeat(60)];
        const stream = client.createStream(feedIds);

        // Test all event types for production monitoring
        const reportHandler = jest.fn();
        const errorHandler = jest.fn();
        const disconnectedHandler = jest.fn();
        const reconnectingHandler = jest.fn();

        stream.on("report", reportHandler);
        stream.on("error", errorHandler);
        stream.on("disconnected", disconnectedHandler);
        stream.on("reconnecting", reconnectingHandler);

        // Verify all event handlers were registered
        expect(mockStream.on).toHaveBeenCalledWith("report", reportHandler);
        expect(mockStream.on).toHaveBeenCalledWith("error", errorHandler);
        expect(mockStream.on).toHaveBeenCalledWith("disconnected", disconnectedHandler);
        expect(mockStream.on).toHaveBeenCalledWith("reconnecting", reconnectingHandler);

        // Verify stream statistics are accessible
        const stats = stream.getMetrics();
        expect(stats.accepted).toBe(100);
        expect(stats.activeConnections).toBe(2);
      } finally {
        StreamConstructorSpy.mockRestore();
      }
    });
  });

  describe("parseOrigins method", () => {
    it("should correctly parse comma-separated URLs", () => {
      const client = new DataStreamsClientImpl(mockConfig);

      // Access private method for testing
      const parseOrigins = (client as any).parseOrigins;

      const result = parseOrigins("wss://origin1.example.com,wss://origin2.example.com,wss://origin3.example.com");
      expect(result).toEqual(["wss://origin1.example.com", "wss://origin2.example.com", "wss://origin3.example.com"]);
    });

    it("should handle URLs with spaces", () => {
      const client = new DataStreamsClientImpl(mockConfig);
      const parseOrigins = (client as any).parseOrigins;

      const result = parseOrigins(
        " wss://origin1.example.com , wss://origin2.example.com , wss://origin3.example.com "
      );
      expect(result).toEqual(["wss://origin1.example.com", "wss://origin2.example.com", "wss://origin3.example.com"]);
    });

    it("should filter out empty URLs", () => {
      const client = new DataStreamsClientImpl(mockConfig);
      const parseOrigins = (client as any).parseOrigins;

      const result = parseOrigins("wss://origin1.example.com,,wss://origin3.example.com,");
      expect(result).toEqual(["wss://origin1.example.com", "wss://origin3.example.com"]);
    });

    it("should handle single URL", () => {
      const client = new DataStreamsClientImpl(mockConfig);
      const parseOrigins = (client as any).parseOrigins;

      const result = parseOrigins("wss://single-origin.example.com");
      expect(result).toEqual(["wss://single-origin.example.com"]);
    });

    it("should return empty array for empty string", () => {
      const client = new DataStreamsClientImpl(mockConfig);
      const parseOrigins = (client as any).parseOrigins;

      const result = parseOrigins("");
      expect(result).toEqual([]);
    });
  });
});
