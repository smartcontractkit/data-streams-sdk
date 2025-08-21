import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ConnectionManager } from "../../../../src/stream/connection-manager";
import { Config } from "../../../../src/types/client";
import * as originDiscovery from "../../../../src/utils/origin-discovery";

type WsHandler = (...args: unknown[]) => void;

// Mock WebSocket instance
const wsMock = {
  on: jest.fn(),
  once: jest.fn(),
  readyState: 1,
  ping: jest.fn(),
  pong: jest.fn(),
  terminate: jest.fn(),
};

jest.mock("ws", () => ({
  __esModule: true,
  default: jest.fn(() => wsMock),
}));

jest.mock("../../../../src/utils/origin-discovery", () => ({
  getAvailableOrigins: jest.fn(),
}));

describe("ConnectionManager - statusCallback de-duplication", () => {
  let manager: ConnectionManager;
  let config: Config;
  let statusCallback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    statusCallback = jest.fn();

    config = {
      apiKey: "key",
      userSecret: "secret",
      endpoint: "https://api.example.com",
      wsEndpoint: "wss://ws.example.com",
      haMode: false,
      connectionStatusCallback: statusCallback,
    } as Config;

    manager = new ConnectionManager(config, {
      feedIds: ["0x0003" + "1".repeat(60)],
      maxReconnectAttempts: 2,
      reconnectInterval: 200,
      connectTimeout: 200,
      haMode: false,
      haConnectionTimeout: 200,
      statusCallback,
    });

    // Mock the origin discovery function to return immediately
    (
      originDiscovery.getAvailableOrigins as jest.MockedFunction<typeof originDiscovery.getAvailableOrigins>
    ).mockResolvedValue(["wss://ws.example.com"]);
  });

  it("invokes callback once for connect and once for disconnect", async () => {
    let closeHandler: WsHandler | undefined;

    // Mock successful WebSocket connection and capture close handler
    wsMock.on.mockImplementation((...args: unknown[]) => {
      const [event, callback] = args as [string, WsHandler];
      if (event === "open") {
        // Simulate immediate connection
        setTimeout(() => callback(), 1);
      } else if (event === "close") {
        closeHandler = callback;
      }
    });

    await manager.initialize();

    expect(statusCallback).toHaveBeenCalledTimes(1);
    expect(statusCallback).toHaveBeenLastCalledWith(true, expect.any(String), expect.any(String));

    // Trigger close event
    if (closeHandler) {
      closeHandler();
    }

    // After close, callback should be called once more with false
    expect(statusCallback).toHaveBeenCalledTimes(2);
    expect(statusCallback).toHaveBeenLastCalledWith(false, expect.any(String), expect.any(String));
  });
});
