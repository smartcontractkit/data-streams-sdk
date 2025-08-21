import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Stream } from "../../../../src/stream";
import { Config } from "../../../../src/types/client";
import { LogLevel } from "../../../../src/types/logger";
import { Report } from "../../../../src/types/report";
import * as originDiscovery from "../../../../src/utils/origin-discovery";

// Mock ConnectionManager
const mockConnectionManager = {
  on: jest.fn(),
  removeAllListeners: jest.fn(),
  initialize: jest.fn(() => Promise.resolve()),
  shutdown: jest.fn(() => Promise.resolve()),
  getActiveConnectionCount: jest.fn().mockReturnValue(1),
  getConfiguredConnectionCount: jest.fn().mockReturnValue(1),
  getConnectionDetails: jest.fn().mockReturnValue([{ origin: "wss://ws.example.com", host: "ws.example.com" }]),
  getOriginStatusMap: jest.fn().mockReturnValue({}),
  setStreamStats: jest.fn(),
};

jest.mock("../../../../src/stream/connection-manager", () => ({
  ConnectionManager: jest.fn(() => mockConnectionManager),
}));

jest.mock("../../../../src/utils/origin-discovery", () => ({
  getAvailableOrigins: jest.fn(),
}));

describe("Stream - read() method", () => {
  let stream: Stream;
  let config: Config;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Close any existing stream to ensure clean state
    if (stream) {
      try {
        await stream.close();
      } catch {
        // Ignore close errors
      }
    }

    const silent = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

    config = {
      apiKey: "test-key",
      userSecret: "test-secret",
      endpoint: "https://api.example.com",
      wsEndpoint: "wss://ws.example.com",
      logging: {
        logger: silent,
        logLevel: LogLevel.ERROR, // Suppress logs in tests
      },
    };

    (
      originDiscovery.getAvailableOrigins as jest.MockedFunction<typeof originDiscovery.getAvailableOrigins>
    ).mockResolvedValue(["wss://ws.example.com"]);

    stream = new Stream(config, ["0x0003" + "1".repeat(60)]);
  });

  afterEach(async () => {
    try {
      await stream.close();
    } catch {
      // Ignore cleanup errors
    }
  });

  it("resolves on next 'report' event and cleans up listeners", async () => {
    await stream.connect();

    const mockReport: Report = {
      feedID: "0x0003" + "1".repeat(60),
      fullReport: "0x" + "a".repeat(64),
      validFromTimestamp: 1234567890,
      observationsTimestamp: 1234567890,
    };

    // Start read() operation
    const readPromise = stream.read();

    // Simulate receiving a report
    setTimeout(() => {
      stream.emit("report", mockReport);
    }, 10);

    // Should resolve with the report
    const result = await readPromise;
    expect(result).toEqual(mockReport);

    // Verify listeners are cleaned up
    expect(stream.listenerCount("report")).toBe(0);
    expect(stream.listenerCount("error")).toBe(0);
  });

  it("rejects on 'error' event and cleans up listeners", async () => {
    await stream.connect();

    const mockError = new Error("Test error");

    // Start read() operation
    const readPromise = stream.read();

    // Simulate an error
    setTimeout(() => {
      stream.emit("error", mockError);
    }, 10);

    // Should reject with the error
    await expect(readPromise).rejects.toThrow("Test error");

    // Verify listeners are cleaned up
    expect(stream.listenerCount("report")).toBe(0);
    expect(stream.listenerCount("error")).toBe(0);
  });

  it("cleans up listeners when report arrives first", async () => {
    await stream.connect();

    const mockReport: Report = {
      feedID: "0x0003" + "1".repeat(60),
      fullReport: "0x" + "b".repeat(64),
      validFromTimestamp: 1234567891,
      observationsTimestamp: 1234567891,
    };

    // Start read() operation
    const readPromise = stream.read();

    // Emit report first - this should resolve immediately and clean up listeners
    stream.emit("report", mockReport);

    // Should resolve with the report
    const result = await readPromise;
    expect(result).toEqual(mockReport);

    // Verify listeners are cleaned up
    expect(stream.listenerCount("report")).toBe(0);
    expect(stream.listenerCount("error")).toBe(0);
  });

  it("cleans up listeners when error arrives first", async () => {
    await stream.connect();

    const mockError = new Error("First error specific test");
    const mockReport: Report = {
      feedID: "0x0003" + "1".repeat(60),
      fullReport: "0x" + "c".repeat(64),
      validFromTimestamp: 1234567892,
      observationsTimestamp: 1234567892,
    };

    // Start read() operation
    const readPromise = stream.read();

    // Emit error first, then report
    setTimeout(() => {
      stream.emit("error", mockError);
      setTimeout(() => {
        stream.emit("report", mockReport);
      }, 0);
    }, 10);

    // Should reject with the error (report ignored after cleanup)
    await expect(readPromise).rejects.toThrow("First error specific test");

    // Verify listeners are cleaned up
    expect(stream.listenerCount("report")).toBe(0);
    expect(stream.listenerCount("error")).toBe(0);
  });

  it("supports multiple concurrent read() operations", async () => {
    await stream.connect();

    const mockReport: Report = {
      feedID: "0x0003" + "1".repeat(60),
      fullReport: "0x" + "d".repeat(64),
      validFromTimestamp: 1234567895,
      observationsTimestamp: 1234567895,
    };

    // Start two concurrent read() operations
    const readPromise1 = stream.read();
    const readPromise2 = stream.read();

    // Should have 2 report listeners and 2 error listeners
    expect(stream.listenerCount("report")).toBe(2);
    expect(stream.listenerCount("error")).toBe(2);

    // Emit one report - both read() operations should resolve with the same report
    stream.emit("report", mockReport);
    stream.emit("report", mockReport); // Emit twice to satisfy both listeners

    // Both should resolve with the same report
    const results = await Promise.all([readPromise1, readPromise2]);

    // Both operations should succeed
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(mockReport);
    expect(results[1]).toEqual(mockReport);

    // All listeners should be cleaned up
    expect(stream.listenerCount("report")).toBe(0);
    expect(stream.listenerCount("error")).toBe(0);
  });
});
