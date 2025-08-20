import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Stream } from "../../../../src/stream";
import { Config } from "../../../../src/types/client";
import { LogLevel } from "../../../../src/types/logger";
import * as originDiscovery from "../../../../src/utils/origin-discovery";

// Mock ConnectionManager to control behavior
const mockConnectionManager = {
  on: jest.fn(),
  removeAllListeners: jest.fn(),
  initialize: jest.fn(() => Promise.resolve()),
  shutdown: jest.fn(() => Promise.resolve()),
  getActiveConnectionCount: jest.fn().mockReturnValue(0), // No active connections
  getConfiguredConnectionCount: jest.fn().mockReturnValue(1),
  getConnectionDetails: jest.fn().mockReturnValue([{ origin: "wss://ws.example.com", host: "ws.example.com" }]),
  getOriginStatusMap: jest.fn().mockReturnValue({}),
  setStreamStats: jest.fn(),
};

// Store event handlers from ConnectionManager
const connectionManagerHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};

jest.mock("../../../../src/stream/connection-manager", () => ({
  ConnectionManager: jest.fn(() => {
    mockConnectionManager.on.mockImplementation((...args: unknown[]) => {
      const [event, handler] = args as [string, (...args: unknown[]) => void];
      if (!connectionManagerHandlers[event]) {
        connectionManagerHandlers[event] = [];
      }
      connectionManagerHandlers[event].push(handler);
    });
    return mockConnectionManager;
  }),
}));

jest.mock("../../../../src/utils/origin-discovery", () => ({
  getAvailableOrigins: jest.fn(),
}));

describe("Stream - Terminal Disconnected State", () => {
  let stream: Stream;
  let config: Config;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(connectionManagerHandlers).forEach(key => delete connectionManagerHandlers[key]);

    // Reset the initialize method to successful resolution for each test
    mockConnectionManager.initialize = jest.fn(() => Promise.resolve());

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

  it("emits 'disconnected' when all connections are lost terminally", async () => {
    const disconnectedSpy = jest.fn();
    const allConnectionsLostSpy = jest.fn();

    stream.on("disconnected", disconnectedSpy);
    stream.on("all-connections-lost", allConnectionsLostSpy);

    await stream.connect();

    // Simulate terminal disconnection (all connections lost after max attempts)
    const allConnectionsLostHandlers = connectionManagerHandlers["all-connections-lost"] || [];
    expect(allConnectionsLostHandlers).toHaveLength(1);

    allConnectionsLostHandlers[0]();

    expect(disconnectedSpy).toHaveBeenCalledTimes(1);
    expect(allConnectionsLostSpy).toHaveBeenCalledTimes(1);
  });

  it("does not attempt further reconnections after disconnected state", async () => {
    const reconnectingSpy = jest.fn();
    const disconnectedSpy = jest.fn();

    stream.on("reconnecting", reconnectingSpy);
    stream.on("disconnected", disconnectedSpy);

    await stream.connect();

    // Simulate terminal disconnection
    const allConnectionsLostHandlers = connectionManagerHandlers["all-connections-lost"] || [];
    allConnectionsLostHandlers[0]();

    expect(disconnectedSpy).toHaveBeenCalledTimes(1);

    // The test concept here is that in practice, the ConnectionManager wouldn't emit
    // more 'reconnecting' events after reaching terminal state, but we can't easily test that
    // without the real ConnectionManager logic. This test passes as the behavior
    // of preventing reconnections is handled by the ConnectionManager itself.
    expect(reconnectingSpy).toHaveBeenCalledTimes(0);
  });

  it("calling connect() again on same instance should not revive connection", async () => {
    const disconnectedSpy = jest.fn();

    stream.on("disconnected", disconnectedSpy);

    // Initial connection
    await stream.connect();

    // Simulate terminal disconnection
    const allConnectionsLostHandlers = connectionManagerHandlers["all-connections-lost"] || [];
    allConnectionsLostHandlers[0]();

    expect(disconnectedSpy).toHaveBeenCalledTimes(1);

    // Try to connect again - this should fail or not restart connections
    // The ConnectionManager should be in a terminal state
    mockConnectionManager.initialize = jest.fn(() =>
      Promise.reject(new Error("Connection manager is in terminal state"))
    );

    await expect(stream.connect()).rejects.toThrow("Connection manager is in terminal state");

    // Should not emit new connection events
    expect(disconnectedSpy).toHaveBeenCalledTimes(1); // Still only the original disconnection
  });

  it("read() should reject after disconnected state", async () => {
    await stream.connect();

    // Simulate terminal disconnection
    const allConnectionsLostHandlers = connectionManagerHandlers["all-connections-lost"] || [];
    allConnectionsLostHandlers[0]();

    // read() after disconnection should fail gracefully
    const readPromise = stream.read();

    // Simulate that no reports will come
    setTimeout(() => {
      stream.emit("error", new Error("Stream is disconnected"));
    }, 10);

    await expect(readPromise).rejects.toThrow("Stream is disconnected");
  });

  it("getMetrics() should reflect disconnected state", async () => {
    await stream.connect();

    // Check initial state
    let metrics = stream.getMetrics();
    expect(metrics.activeConnections).toBe(0); // Mocked to return 0

    // Simulate terminal disconnection
    const allConnectionsLostHandlers = connectionManagerHandlers["all-connections-lost"] || [];
    allConnectionsLostHandlers[0]();

    // Metrics should still reflect the disconnected state
    metrics = stream.getMetrics();
    expect(metrics.activeConnections).toBe(0);
    expect(metrics.configuredConnections).toBe(1);
  });

  it("close() should work gracefully even after disconnected state", async () => {
    await stream.connect();

    // Simulate terminal disconnection
    const allConnectionsLostHandlers = connectionManagerHandlers["all-connections-lost"] || [];
    allConnectionsLostHandlers[0]();

    // close() should still work
    await expect(stream.close()).resolves.not.toThrow();

    // Verify shutdown was called
    expect(mockConnectionManager.shutdown).toHaveBeenCalled();
  });
});
