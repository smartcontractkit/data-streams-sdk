import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { WS_CONSTANTS } from "../../../../src/utils/constants";
import { ConnectionManager } from "../../../../src/stream/connection-manager";
import { Config } from "../../../../src/types/client";
import * as originDiscovery from "../../../../src/utils/origin-discovery";

// Event handler type for ws events
type WsHandler = (...args: unknown[]) => void;

// Mock WebSocket instance
const mockWsInstance = {
  on: jest.fn(),
  once: jest.fn(),
  ping: jest.fn(),
  pong: jest.fn(),
  terminate: jest.fn(),
  get readyState() {
    return 1;
  }, // WebSocket.OPEN
};

jest.mock("ws", () => {
  const ctor = jest.fn(() => mockWsInstance);
  // Provide static constants used by the implementation for readyState checks
  // e.g., WebSocket.OPEN and WebSocket.CONNECTING
  (ctor as unknown as { OPEN: number; CONNECTING: number }).OPEN = 1;
  (ctor as unknown as { OPEN: number; CONNECTING: number }).CONNECTING = 0;
  return {
    __esModule: true,
    default: ctor,
  };
});

// Mock origin discovery
jest.mock("../../../../src/utils/origin-discovery", () => ({
  getAvailableOrigins: jest.fn(),
}));

describe("ConnectionManager - ping/pong health", () => {
  let manager: ConnectionManager;
  let config: Config;

  beforeEach(() => {
    jest.clearAllMocks();

    config = {
      apiKey: "key",
      userSecret: "secret",
      endpoint: "https://api.example.com",
      wsEndpoint: "wss://ws.example.com",
      haMode: false,
    };

    manager = new ConnectionManager(config, {
      feedIds: ["0x0003" + "1".repeat(60)],
      maxReconnectAttempts: 3,
      reconnectInterval: 200,
      connectTimeout: 200,
      haMode: false,
      haConnectionTimeout: 200,
    });

    // Mock the origin discovery function to return immediately
    (
      originDiscovery.getAvailableOrigins as jest.MockedFunction<typeof originDiscovery.getAvailableOrigins>
    ).mockResolvedValue(["wss://ws.example.com"]);
  });

  it("sets up ping/pong health monitoring after connection", async () => {
    // Mock successful WebSocket connection
    mockWsInstance.on.mockImplementation((...args: unknown[]) => {
      const [event, callback] = args as [string, WsHandler];
      if (event === "open") {
        // Simulate immediate connection
        setTimeout(() => callback(), 1);
      }
    });

    await manager.initialize();

    // Verify that ping and pong event handlers are set up
    expect(mockWsInstance.on).toHaveBeenCalledWith("ping", expect.any(Function));
    expect(mockWsInstance.on).toHaveBeenCalledWith("pong", expect.any(Function));
  });

  it("responds with pong when server sends ping", async () => {
    const pongSpy = jest.fn();
    // Override the pong method to capture calls
    mockWsInstance.pong = pongSpy;

    // Mock successful WebSocket connection; record all subscriptions
    mockWsInstance.on.mockImplementation((...args: unknown[]) => {
      const [event, callback] = args as [string, WsHandler];
      if (event === "open") {
        // Simulate immediate connection
        setTimeout(() => callback(), 1);
      }
    });

    await manager.initialize();

    // Extract the registered ping handler directly from mock.calls
    const pingCall = (mockWsInstance.on.mock.calls as unknown[] as [string, WsHandler][])
      .reverse()
      .find(([evt]) => evt === "ping");
    expect(pingCall).toBeDefined();
    const pingHandler = pingCall && pingCall[1];
    expect(typeof pingHandler).toBe("function");

    // Trigger ping
    if (pingHandler) {
      pingHandler(Buffer.from("data"));
    }

    expect(pongSpy).toHaveBeenCalled();
  });

  it("terminates connection on pong timeout and schedules reconnection", async () => {
    jest.useFakeTimers();

    let closeHandler: WsHandler | undefined;

    // Mock successful WebSocket connection and capture close handler
    mockWsInstance.on.mockImplementation((...args: unknown[]) => {
      const [event, callback] = args as [string, WsHandler];
      if (event === "open") {
        // With fake timers active, invoke immediately to resolve initialize()
        callback();
      } else if (event === "close") {
        closeHandler = callback;
      }
    });

    const reconnectingSpy = jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      manager as any,
      "emit"
    );

    await manager.initialize();

    // Advance timers to trigger a ping, then the pong timeout
    jest.advanceTimersByTime(WS_CONSTANTS.PING_INTERVAL + WS_CONSTANTS.PONG_TIMEOUT + 1);

    // Connection should be terminated due to missing pong
    expect(mockWsInstance.terminate).toHaveBeenCalledTimes(1);

    // Simulate the underlying socket closing to trigger reconnection scheduling
    if (closeHandler) {
      closeHandler();
    }

    // Reconnection should be scheduled (reconnecting event emitted with info object)
    const calls = reconnectingSpy.mock.calls as unknown[] as unknown[][];
    const reconnectingCall = calls.find(call => call[0] === "reconnecting");
    expect(reconnectingCall).toBeDefined();
    const info = reconnectingCall && (reconnectingCall[1] as Record<string, unknown>);
    expect(info).toBeDefined();
    if (info) {
      expect(typeof info.attempt).toBe("number");
      expect(typeof info.delayMs).toBe("number");
      expect(typeof info.origin).toBe("string");
      expect(typeof info.host).toBe("string");
    }

    jest.useRealTimers();
  });
});
