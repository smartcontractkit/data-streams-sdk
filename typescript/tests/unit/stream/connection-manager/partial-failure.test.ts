import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ConnectionManager } from "../../../../src/stream/connection-manager";
import { Config } from "../../../../src/types/client";
import WebSocket from "ws";

// Mock ws to simulate connection outcomes per origin
type WsHandler = (...args: unknown[]) => void;

const wsMocks: unknown[] = [];

jest.mock("ws", () => ({
  __esModule: true,
  default: jest.fn(() => {
    const instance = {
      on: jest.fn((_event: string, _cb: WsHandler) => {}),
      once: jest.fn((_event: string, _cb: WsHandler) => {}),
      terminate: jest.fn(),
      close: jest.fn(),
      readyState: 1,
    };
    wsMocks.push(instance);
    return instance;
  }),
}));

// Mock origin discovery to return multiple origins
jest.mock("../../../../src/utils/origin-discovery", () => {
  return {
    getAvailableOrigins: (..._args: unknown[]) =>
      Promise.resolve(["wss://o1.example.com", "wss://o2.example.com", "wss://o3.example.com"]),
  };
});

describe("ConnectionManager - partial failure emission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wsMocks.length = 0;
  });

  it("emits partial-failure when some origins fail to establish", async () => {
    const config: Config = {
      apiKey: "k",
      userSecret: "s",
      endpoint: "https://api.example.com",
      wsEndpoint: "wss://o1.example.com,wss://o2.example.com,wss://o3.example.com",
      haMode: true,
    };

    const manager = new ConnectionManager(config, {
      feedIds: ["0x0003" + "1".repeat(60)],
      maxReconnectAttempts: 2,
      reconnectInterval: 200,
      connectTimeout: 200,
      haMode: true,
      haConnectionTimeout: 200,
    });

    const emitSpy = jest.spyOn(
      manager as unknown as {
        emit: (...args: unknown[]) => void;
      },
      "emit"
    );

    // Configure ws instances so that some fail during establishConnection
    // We simulate failure by triggering 'error' before 'open' for some sockets.
    (WebSocket as unknown as jest.Mock).mockImplementationOnce((): unknown => {
      const ws = {
        on: jest.fn((event: string, cb: WsHandler) => {
          if (event === "error") setTimeout(() => cb(new Error("fail o1")), 0);
        }),
        once: jest.fn((_event: string, _cb: WsHandler) => {}),
        terminate: jest.fn(),
        close: jest.fn(),
        readyState: 1,
      };
      return ws;
    });

    (WebSocket as unknown as jest.Mock).mockImplementationOnce((): unknown => {
      const ws = {
        on: jest.fn((event: string, cb: WsHandler) => {
          if (event === "open") setTimeout(() => cb(), 0);
        }),
        once: jest.fn((_event: string, _cb: WsHandler) => {}),
        terminate: jest.fn(),
        close: jest.fn(),
        readyState: 1,
      };
      return ws;
    });

    (WebSocket as unknown as jest.Mock).mockImplementationOnce((): unknown => {
      const ws = {
        on: jest.fn((event: string, cb: WsHandler) => {
          if (event === "error") setTimeout(() => cb(new Error("fail o3")), 0);
        }),
        once: jest.fn((_event: string, _cb: WsHandler) => {}),
        terminate: jest.fn(),
        close: jest.fn(),
        readyState: 1,
      };
      return ws;
    });

    await manager.initialize().catch(() => {});

    // partial-failure should be emitted with failed and total counts
    const calls = emitSpy.mock.calls.filter((call: unknown[]) => (call as unknown[])[0] === "partial-failure");
    expect(calls.length).toBeGreaterThan(0);
    const first = calls[0] as unknown[];
    expect(first[0]).toBe("partial-failure");
    expect(typeof first[1]).toBe("number");
    expect(typeof first[2]).toBe("number");
  });
});
