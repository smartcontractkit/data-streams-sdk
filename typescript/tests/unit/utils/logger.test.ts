import { SDKLogger } from "../../../src/utils/logger";
import { LogLevel } from "../../../src/types/logger";
import { createClient } from "../../../src";

describe("SDKLogger", () => {
  describe("Unit Tests", () => {
    it("should be silent by default", () => {
      const logger = new SDKLogger();
      // Should not throw or log
      logger.info("test message");
      logger.debug("debug message");
      logger.error("error message");
      logger.warn("warn message");
      logger.connectionDebug("connection message");
    });

    it("should respect log level filtering", () => {
      const mockLogger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const logger = new SDKLogger({
        logger: mockLogger,
        logLevel: LogLevel.INFO,
      });

      logger.debug("debug message"); // Should be filtered
      logger.info("info message"); // Should pass
      logger.warn("warn message"); // Should pass
      logger.error("error message"); // Should pass

      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringMatching(/\[.*\] \[DataStreams\] info message/));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringMatching(/\[.*\] \[DataStreams\] warn message/));
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringMatching(/\[.*\] \[DataStreams\] error message/));
    });

    it("should handle all log levels correctly", () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const logger = new SDKLogger({
        logger: mockLogger,
        logLevel: LogLevel.DEBUG, // Allow all levels
      });

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringMatching(/\[.*\] \[DataStreams\] debug message/));
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringMatching(/\[.*\] \[DataStreams\] info message/));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringMatching(/\[.*\] \[DataStreams\] warn message/));
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringMatching(/\[.*\] \[DataStreams\] error message/));
    });

    it("should handle connection debug logs", () => {
      const mockLogger = { debug: jest.fn() };
      const logger = new SDKLogger({
        logger: mockLogger,
        logLevel: LogLevel.DEBUG, // Enable DEBUG level
        enableConnectionDebug: true,
      });

      logger.connectionDebug("connection event");
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("[Connection] connection event"));
    });

    it("should not log connection debug when disabled", () => {
      const mockLogger = { debug: jest.fn() };
      const logger = new SDKLogger({
        logger: mockLogger,
        enableConnectionDebug: false,
      });

      logger.connectionDebug("connection event");
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it("should handle logger errors gracefully", () => {
      const faultyLogger = {
        info: () => {
          throw new Error("Logger failed");
        },
      };

      const logger = new SDKLogger({ logger: faultyLogger });

      // Should not throw despite logger error
      expect(() => logger.info("test")).not.toThrow();
    });

    it("should format messages with timestamp and prefix", () => {
      const mockLogger = { info: jest.fn() };
      const logger = new SDKLogger({ logger: mockLogger });

      logger.info("test message");

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[[\d-T:.Z]+\] \[DataStreams\] test message$/)
      );
    });

    it("should pass additional arguments to logger", () => {
      const mockLogger = { error: jest.fn() };
      const logger = new SDKLogger({ logger: mockLogger });

      const error = new Error("test error");
      const extraData = { key: "value" };
      logger.error("Error occurred", error, extraData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/\[.*\] \[DataStreams\] Error occurred/),
        error,
        extraData
      );
    });

    it("should handle missing logger methods gracefully", () => {
      const incompleteLogger = { info: jest.fn() }; // Missing debug, warn, error
      const logger = new SDKLogger({ logger: incompleteLogger });

      // Should not throw for missing methods
      expect(() => {
        logger.debug("debug message");
        logger.warn("warn message");
        logger.error("error message");
        logger.info("info message"); // Add the missing call
      }).not.toThrow();

      // Only info should be called
      expect(incompleteLogger.info).toHaveBeenCalledWith(expect.stringMatching(/\[.*\] \[DataStreams\] info message/));
    });

    it("should have zero overhead when logging disabled", () => {
      const start = performance.now();
      const logger = new SDKLogger(); // No config = disabled

      // Test with high-frequency logging calls
      for (let i = 0; i < 10000; i++) {
        logger.info("test message");
        logger.debug("debug message");
        logger.connectionDebug("connection event");
        logger.error("error message", new Error("test"));
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(200); // Should be near-instant (< 200ms)
    });
  });

  describe("Integration Tests", () => {
    // Mock fetch globally for these tests
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ feeds: [] }),
      });
    });

    afterEach(() => {
      global.fetch = originalFetch;
      jest.clearAllMocks();
    });

    it("should log during real client operations", async () => {
      const mockLogger = {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      };

      const client = createClient({
        apiKey: "test-key",
        userSecret: "test-secret",
        endpoint: "https://api.testnet-dataengine.chain.link",
        wsEndpoint: "wss://ws.testnet-dataengine.chain.link",
        logging: {
          logger: mockLogger,
          logLevel: LogLevel.INFO,
        },
      });

      try {
        // Verify that initialization is logged
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Data Streams client initialized"));

        await client.listFeeds();

        // Verify that API logs were called
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Request successful"));
      } finally {
        // Clean up any potential resources
        // Note: DataStreamsClient is a stateless REST client (no persistent connections/timers)
        // Only streams created by client.createStream() need explicit cleanup via stream.close()
      }
    });

    it("should validate logging config correctly", () => {
      expect(() =>
        createClient({
          apiKey: "test",
          userSecret: "test",
          endpoint: "https://test.example.com",
          wsEndpoint: "wss://test.example.com",
          logging: {
            logLevel: 999 as any, // Invalid level
          },
        })
      ).toThrow("Invalid logLevel");

      expect(() =>
        createClient({
          apiKey: "test",
          userSecret: "test",
          endpoint: "https://test.example.com",
          wsEndpoint: "wss://test.example.com",
          logging: {
            logger: { info: "not a function" as any },
          },
        })
      ).toThrow("Logger.info must be a function");

      expect(() =>
        createClient({
          apiKey: "test",
          userSecret: "test",
          endpoint: "https://test.example.com",
          wsEndpoint: "wss://test.example.com",
          logging: {
            enableConnectionDebug: "not a boolean" as any,
          },
        })
      ).toThrow("enableConnectionDebug must be a boolean");
    });

    it("should work with different logger interfaces", () => {
      // Test with console-like logger (using mocks to keep tests silent)
      const consoleLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      expect(() =>
        createClient({
          apiKey: "test",
          userSecret: "test",
          endpoint: "https://test.example.com",
          wsEndpoint: "wss://test.example.com",
          logging: { logger: consoleLogger },
        })
      ).not.toThrow();

      // Verify the logger was actually used during client initialization
      expect(consoleLogger.info).toHaveBeenCalledWith(expect.stringContaining("Data Streams client initialized"));

      // Test with partial logger
      const partialLogger = {
        info: jest.fn(),
        error: jest.fn(),
      };

      expect(() =>
        createClient({
          apiKey: "test",
          userSecret: "test",
          endpoint: "https://test.example.com",
          wsEndpoint: "wss://test.example.com",
          logging: { logger: partialLogger },
        })
      ).not.toThrow();
    });

    it("should handle stream logging integration", async () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const client = createClient({
        apiKey: "test",
        userSecret: "test",
        endpoint: "https://test.example.com",
        wsEndpoint: "wss://test.example.com",
        logging: {
          logger: mockLogger,
          logLevel: LogLevel.DEBUG,
        },
      });

      const stream = client.createStream("0x00039d9e45394f473ab1f050a1b963e6b05351e52d71e507509ada0c95ed75b8");

      try {
        // Verify stream creation logging
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("Creating stream for 1 feeds"));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Stream created successfully"));
      } finally {
        // Clean up stream resources to prevent leaks
        await stream.close();
      }
    });

    it("should handle different log levels in production scenario", async () => {
      const logs: { level: string; message: string }[] = [];
      const productionLogger = {
        debug: (msg: string) => logs.push({ level: "debug", message: msg }),
        info: (msg: string) => logs.push({ level: "info", message: msg }),
        warn: (msg: string) => logs.push({ level: "warn", message: msg }),
        error: (msg: string) => logs.push({ level: "error", message: msg }),
      };

      // Test with INFO level (should exclude debug)
      const clientInfo = createClient({
        apiKey: "test",
        userSecret: "test",
        endpoint: "https://test.example.com",
        wsEndpoint: "wss://test.example.com",
        logging: {
          logger: productionLogger,
          logLevel: LogLevel.INFO,
        },
      });

      logs.length = 0; // Clear initialization logs

      const stream = clientInfo.createStream("0x00039d9e45394f473ab1f050a1b963e6b05351e52d71e507509ada0c95ed75b8");

      try {
        const debugLogs = logs.filter(log => log.level === "debug");
        const infoLogs = logs.filter(log => log.level === "info");

        expect(debugLogs).toHaveLength(0); // Debug should be filtered
        expect(infoLogs.length).toBeGreaterThan(0); // Info should pass
      } finally {
        // Clean up stream to prevent resource leaks
        await stream.close();
      }

      // Test with ERROR level (should only allow errors)
      logs.length = 0;
      const errorLogger = new SDKLogger({
        logger: productionLogger,
        logLevel: LogLevel.ERROR,
      });

      errorLogger.debug("debug");
      errorLogger.info("info");
      errorLogger.warn("warn");
      errorLogger.error("error");

      expect(logs).toEqual([expect.objectContaining({ level: "error", message: expect.stringContaining("error") })]);
    });
  });
});
