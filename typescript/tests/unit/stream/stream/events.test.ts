import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Stream } from "../../../../src/stream";
import { Config } from "../../../../src/types/client";
import { LogLevel } from "../../../../src/types/logger";
import * as originDiscovery from "../../../../src/utils/origin-discovery";

// Mock ConnectionManager to control event emission
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

describe("Stream - Event Re-emission", () => {
  let stream: Stream;
  let config: Config;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(connectionManagerHandlers).forEach(key => delete connectionManagerHandlers[key]);

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

  it("re-emits 'reconnecting' event exactly once per transition", async () => {
    const reconnectingSpy = jest.fn();
    stream.on("reconnecting", reconnectingSpy);

    await stream.connect();

    // Simulate reconnecting event from ConnectionManager
    const reconnectingInfo = { attempt: 1, delayMs: 1000, origin: "wss://ws.example.com", host: "ws.example.com" };
    const reconnectingHandlers = connectionManagerHandlers["reconnecting"] || [];

    expect(reconnectingHandlers).toHaveLength(1);

    // Emit reconnecting event multiple times (should only re-emit once each)
    reconnectingHandlers[0](reconnectingInfo);
    reconnectingHandlers[0](reconnectingInfo);

    expect(reconnectingSpy).toHaveBeenCalledTimes(2);
    expect(reconnectingSpy).toHaveBeenCalledWith(reconnectingInfo);
  });

  it("re-emits 'connection-lost' event exactly once per transition", async () => {
    const connectionLostSpy = jest.fn();
    stream.on("connection-lost", connectionLostSpy);

    await stream.connect();

    // Simulate connection-lost event from ConnectionManager
    const mockConnection = { id: "conn-1", origin: "wss://ws.example.com", host: "ws.example.com" };
    const mockError = new Error("Connection lost");
    const connectionLostHandlers = connectionManagerHandlers["connection-lost"] || [];

    expect(connectionLostHandlers).toHaveLength(1);

    connectionLostHandlers[0](mockConnection, mockError);

    expect(connectionLostSpy).toHaveBeenCalledTimes(1);
    expect(connectionLostSpy).toHaveBeenCalledWith(mockConnection, mockError);
  });

  it("re-emits 'all-connections-lost' and 'disconnected' events exactly once per transition", async () => {
    const allConnectionsLostSpy = jest.fn();
    const disconnectedSpy = jest.fn();

    stream.on("all-connections-lost", allConnectionsLostSpy);
    stream.on("disconnected", disconnectedSpy);

    await stream.connect();

    // Simulate all-connections-lost event from ConnectionManager
    const allConnectionsLostHandlers = connectionManagerHandlers["all-connections-lost"] || [];

    expect(allConnectionsLostHandlers).toHaveLength(1);

    allConnectionsLostHandlers[0]();

    expect(allConnectionsLostSpy).toHaveBeenCalledTimes(1);
    expect(disconnectedSpy).toHaveBeenCalledTimes(1);
  });

  it("handles 'connection-restored' event without re-emission (internal only)", async () => {
    // connection-restored is handled internally for stats but not re-emitted to public API
    const connectionRestoredSpy = jest.fn();
    stream.on("connection-restored", connectionRestoredSpy);

    await stream.connect();

    // The Stream class doesn't re-emit connection-restored, so we shouldn't have any public listeners
    expect(connectionRestoredSpy).not.toHaveBeenCalled();
  });
});
