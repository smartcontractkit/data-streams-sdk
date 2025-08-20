/**
 * Tests for exponential backoff reconnection logic
 */

import { ConnectionManager, ConnectionState, ManagedConnection } from "../../../src/stream/connection-manager";
import { Config } from "../../../src/types/client";
import { WS_CONSTANTS } from "../../../src/utils/constants";

// Mock WebSocket
const mockWebSocket = {
  on: jest.fn(),
  once: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  terminate: jest.fn(),
  readyState: 1,
};

jest.mock("ws", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    const instance = { ...mockWebSocket };

    // Simulate successful connection after a short delay
    setTimeout(() => {
      const openHandler = instance.on.mock.calls.find(call => call[0] === "open")?.[1];
      if (openHandler) openHandler();
    }, 10);

    return instance;
  }),
}));

// Mock origin discovery
jest.mock("../../../src/utils/origin-discovery", () => ({
  getAvailableOrigins: jest.fn().mockResolvedValue(["wss://test1.example.com", "wss://test2.example.com"]),
}));

// Mock setTimeout to capture delay values
const originalSetTimeout = setTimeout;
const originalClearTimeout = clearTimeout;
let capturedDelays: number[] = [];
let mockTimeouts: any[] = [];

beforeAll(() => {
  global.setTimeout = jest.fn((callback, delay) => {
    capturedDelays.push(delay);
    // Don't execute the callback to avoid side effects, just return a mock timeout
    const mockTimeout = {
      id: Math.random(),
      unref: jest.fn(),
      ref: jest.fn(),
      hasRef: jest.fn().mockReturnValue(true),
      refresh: jest.fn(),
    };
    mockTimeouts.push(mockTimeout);
    return mockTimeout as any;
  }) as any;

  global.clearTimeout = jest.fn(timeout => {
    const index = mockTimeouts.indexOf(timeout);
    if (index > -1) {
      mockTimeouts.splice(index, 1);
    }
  }) as any;
});

afterAll(() => {
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
});

describe("Exponential Backoff Reconnection", () => {
  let connectionManager: ConnectionManager;
  let mockConfig: Config;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedDelays = [];
    mockTimeouts = [];

    mockConfig = {
      apiKey: "test-key",
      userSecret: "test-secret",
      endpoint: "https://test.example.com",
      wsEndpoint: "wss://test1.example.com,wss://test2.example.com",
      haMode: true,
    };

    const managerConfig = {
      feedIds: ["0x123"],
      maxReconnectAttempts: 5,
      reconnectInterval: 1000,
      connectTimeout: 5000,
      haMode: true,
      haConnectionTimeout: 5000,
    };

    connectionManager = new ConnectionManager(mockConfig, managerConfig);
  });

  afterEach(() => {
    // Clean up any remaining timeouts
    mockTimeouts.length = 0;
  });

  test("should use exponential backoff for reconnection delays", async () => {
    // Create a mock connection directly to test the backoff logic
    const mockConnection: ManagedConnection = {
      id: "test-conn",
      origin: "wss://test.example.com",
      host: "test.example.com",
      ws: null,
      state: ConnectionState.DISCONNECTED,
      reconnectAttempts: 0,
    };

    // Simulate connection failures to trigger multiple reconnect attempts
    for (let i = 0; i < 4; i++) {
      (connectionManager as any).scheduleReconnection(mockConnection);
    }

    // Verify exponential backoff pattern
    expect(capturedDelays.length).toBeGreaterThanOrEqual(4);

    // Expected pattern: ~1000ms, ~2000ms, ~4000ms, ~8000ms (with jitter ±10%)
    const baseDelay = WS_CONSTANTS.RECONNECT_DELAY; // 1000ms

    for (let i = 0; i < Math.min(capturedDelays.length, 4); i++) {
      const expectedDelay = baseDelay * Math.pow(2, i);
      const actualDelay = capturedDelays[i];

      // Allow for ±15% jitter tolerance
      const tolerance = expectedDelay * 0.15;
      const minExpected = Math.max(expectedDelay - tolerance, baseDelay);
      const maxExpected = expectedDelay + tolerance;

      expect(actualDelay).toBeGreaterThanOrEqual(minExpected);
      expect(actualDelay).toBeLessThanOrEqual(maxExpected);
    }
  });

  test("should cap delay at maximum reconnect interval", async () => {
    const mockConnection: ManagedConnection = {
      id: "test-conn",
      origin: "wss://test.example.com",
      host: "test.example.com",
      ws: null,
      state: ConnectionState.DISCONNECTED,
      reconnectAttempts: 0,
    };

    // Simulate many reconnection attempts to trigger the cap
    for (let i = 0; i < 6; i++) {
      (connectionManager as any).scheduleReconnection(mockConnection);
    }

    // After several attempts, delay should be capped at MAX_RECONNECT_INTERVAL
    const maxDelay = WS_CONSTANTS.MAX_RECONNECT_INTERVAL; // 10000ms
    const lastDelays = capturedDelays.slice(-2); // Check last 2 delays

    lastDelays.forEach(delay => {
      expect(delay).toBe(maxDelay); // Should be exactly the max delay
    });
  });

  test("should use consistent delays", async () => {
    // Create multiple connections with same attempt count
    const delays: number[] = [];

    for (let i = 0; i < 5; i++) {
      const mockConnection: ManagedConnection = {
        id: `test-conn-${i}`,
        origin: "wss://test.example.com",
        host: "test.example.com",
        ws: null,
        state: ConnectionState.DISCONNECTED,
        reconnectAttempts: 1, // This should give exactly 2000ms delay
      };

      (connectionManager as any).scheduleReconnection(mockConnection);
      delays.push(capturedDelays[capturedDelays.length - 1]);
    }

    // Verify that all delays are identical
    const uniqueDelays = new Set(delays);
    expect(uniqueDelays.size).toBe(1); // Should have same value

    // Verify exact delay calculation: base * 2^(attempts-1) = 2000 * 2^0 = 2000
    const expectedDelay = 2000;
    delays.forEach(delay => {
      expect(delay).toBe(expectedDelay);
    });
  });

  test("should never go below minimum delay", async () => {
    const mockConnection: ManagedConnection = {
      id: "test-conn",
      origin: "wss://test.example.com",
      host: "test.example.com",
      ws: null,
      state: ConnectionState.DISCONNECTED,
      reconnectAttempts: 0,
    };

    // Test first reconnection attempt
    (connectionManager as any).scheduleReconnection(mockConnection);

    const firstDelay = capturedDelays[capturedDelays.length - 1];
    const minDelay = WS_CONSTANTS.RECONNECT_DELAY;

    expect(firstDelay).toBeGreaterThanOrEqual(minDelay);
  });

  test("should use configured reconnectInterval as base delay", async () => {
    // Arrange a manager with a larger custom base
    const customBaseMs = 5000;
    const cm = new ConnectionManager(
      {
        apiKey: "test-key",
        userSecret: "test-secret",
        endpoint: "https://test.example.com",
        wsEndpoint: "wss://test1.example.com",
        haMode: true,
      } as Config,
      {
        feedIds: ["0x123"],
        maxReconnectAttempts: 5,
        reconnectInterval: customBaseMs,
        connectTimeout: 5000,
        haMode: true,
        haConnectionTimeout: 5000,
      }
    );

    // Act: schedule first reconnection (attempt increments to 1 → delay ≈ base)
    const mockConnection: ManagedConnection = {
      id: "test-conn-custom-base",
      origin: "wss://test.example.com",
      host: "test.example.com",
      ws: null,
      state: ConnectionState.DISCONNECTED,
      reconnectAttempts: 0,
    };
    (cm as any).scheduleReconnection(mockConnection);

    const lastDelay = capturedDelays[capturedDelays.length - 1];

    // Assert: delay should be exactly the base value
    expect(lastDelay).toBe(customBaseMs);
  });

  test("should respect reconnectInterval", async () => {
    // MIN test: use configured value
    const smallBase = 50;
    const cmMin = new ConnectionManager(
      {
        apiKey: "test-key",
        userSecret: "test-secret",
        endpoint: "https://test.example.com",
        wsEndpoint: "wss://test1.example.com",
        haMode: true,
      } as Config,
      {
        feedIds: ["0x123"],
        maxReconnectAttempts: 5,
        reconnectInterval: smallBase,
        connectTimeout: 5000,
        haMode: true,
        haConnectionTimeout: 5000,
      }
    );

    const connMin: ManagedConnection = {
      id: "conn-min",
      origin: "wss://test.example.com",
      host: "test.example.com",
      ws: null,
      state: ConnectionState.DISCONNECTED,
      reconnectAttempts: 0,
    };
    (cmMin as any).scheduleReconnection(connMin);
    const minDelayObserved = capturedDelays[capturedDelays.length - 1];
    // Should use configured value exactly
    expect(minDelayObserved).toBe(50); // smallBase * 2^0 = 50

    // MAX clamp test: set an excessively large base
    const largeBase = 60000; // > MAX_RECONNECT_INTERVAL (10000)
    const cmMax = new ConnectionManager(
      {
        apiKey: "test-key",
        userSecret: "test-secret",
        endpoint: "https://test.example.com",
        wsEndpoint: "wss://test1.example.com",
        haMode: true,
      } as Config,
      {
        feedIds: ["0x123"],
        maxReconnectAttempts: 5,
        reconnectInterval: largeBase,
        connectTimeout: 5000,
        haMode: true,
        haConnectionTimeout: 5000,
      }
    );

    const connMax: ManagedConnection = {
      id: "conn-max",
      origin: "wss://test.example.com",
      host: "test.example.com",
      ws: null,
      state: ConnectionState.DISCONNECTED,
      reconnectAttempts: 0,
    };
    (cmMax as any).scheduleReconnection(connMax);
    const maxDelayObserved = capturedDelays[capturedDelays.length - 1];
    // Large base should be capped at MAX_RECONNECT_INTERVAL (10000ms)
    expect(maxDelayObserved).toBe(WS_CONSTANTS.MAX_RECONNECT_INTERVAL);
  });
});
