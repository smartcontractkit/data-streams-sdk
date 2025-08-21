import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ConnectionManager } from "../../../../src/stream/connection-manager";
import { Config } from "../../../../src/types/client";
import * as originDiscovery from "../../../../src/utils/origin-discovery";

type Handler = (...args: unknown[]) => void;

// Store event handlers registered via ws.once / ws.on
const onceHandlers: Record<string, Handler | undefined> = {};
const onHandlers: Record<string, Handler | undefined> = {};

// Mock WebSocket instance/constructor
const mockWsInstance = {
  on: jest.fn((...args: unknown[]) => {
    const [event, cb] = args as [string, Handler];
    onHandlers[event] = cb;
  }),
  once: jest.fn((...args: unknown[]) => {
    const [event, cb] = args as [string, Handler];
    onceHandlers[event] = cb;
  }),
  terminate: jest.fn(),
  close: jest.fn(),
  get readyState() {
    return 1; // OPEN
  },
};

jest.mock("ws", () => {
  const ctor = jest.fn(() => mockWsInstance);
  (ctor as unknown as { OPEN: number; CONNECTING: number }).OPEN = 1;
  (ctor as unknown as { OPEN: number; CONNECTING: number }).CONNECTING = 0;
  return { __esModule: true, default: ctor };
});

jest.mock("../../../../src/utils/origin-discovery", () => ({
  getAvailableOrigins: jest.fn(),
}));

describe("ConnectionManager - auth handshake errors", () => {
  let manager: ConnectionManager;
  let config: Config;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(onceHandlers).forEach(k => delete onceHandlers[k]);
    Object.keys(onHandlers).forEach(k => delete onHandlers[k]);

    config = {
      apiKey: "key",
      userSecret: "secret",
      endpoint: "https://api.example.com",
      wsEndpoint: "wss://ws.example.com",
      haMode: false,
    };

    manager = new ConnectionManager(config, {
      feedIds: ["0x0003" + "1".repeat(60)],
      maxReconnectAttempts: 2,
      reconnectInterval: 200,
      connectTimeout: 200,
      haMode: false,
      haConnectionTimeout: 200,
    });

    (
      originDiscovery.getAvailableOrigins as jest.MockedFunction<typeof originDiscovery.getAvailableOrigins>
    ).mockResolvedValue(["wss://ws.example.com"]);
  });

  it("rejects with WebSocketError on 401 unexpected-response during handshake", async () => {
    const initPromise = manager.initialize();
    // Allow event subscriptions to be registered
    await new Promise(resolve => setTimeout(resolve, 0));

    // Simulate handshake failure via 'unexpected-response'
    const handler = onceHandlers["unexpected-response"];
    expect(typeof handler).toBe("function");
    if (handler) {
      handler({}, { statusCode: 401 });
    }

    await expect(initPromise).rejects.toThrow(
      /Failed to initialize connections: Failed to establish any WebSocket connections/
    );
  });

  it("rejects with WebSocketError on 403 unexpected-response during handshake", async () => {
    const initPromise = manager.initialize();
    await new Promise(resolve => setTimeout(resolve, 0));

    // Simulate handshake failure via 'unexpected-response'
    const handler = onceHandlers["unexpected-response"];
    expect(typeof handler).toBe("function");
    if (handler) {
      handler({}, { statusCode: 403 });
    }

    await expect(initPromise).rejects.toThrow(
      /Failed to initialize connections: Failed to establish any WebSocket connections/
    );
  });
});
