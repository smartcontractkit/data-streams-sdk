import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ConnectionManager } from "../../../../src/stream/connection-manager";
import { Config } from "../../../../src/types/client";

// No WebSocket connections needed for this test; we exercise internal scheduling logic

describe("ConnectionManager - max reconnect attempts (terminal state)", () => {
  let manager: ConnectionManager;
  let config: Config;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    config = {
      apiKey: "test-key",
      userSecret: "test-secret",
      endpoint: "https://api.example.com",
      wsEndpoint: "wss://ws.example.com",
      haMode: false,
    };

    manager = new ConnectionManager(config, {
      feedIds: ["0x0003" + "1".repeat(60)],
      maxReconnectAttempts: 1, // small to hit terminal quickly
      reconnectInterval: 200, // base (doesn't matter, timers are mocked)
      connectTimeout: 500,
      haMode: false,
      haConnectionTimeout: 500,
    });
  });

  it("emits max-reconnect-attempts-reached and all-connections-lost, and sets state to FAILED", () => {
    // Create a fake managed connection and insert into manager internals
    const connection: {
      id: string;
      origin: string;
      host: string;
      ws: unknown;
      state: string;
      reconnectAttempts: number;
    } = {
      id: "conn-0",
      origin: "wss://ws.example.com",
      host: "ws.example.com",
      ws: null,
      state: "disconnected",
      reconnectAttempts: 0,
    };

    // Inject into internal map
    (manager as unknown as { connections: Map<string, unknown> }).connections.set(connection.id, connection);

    // Spy on emit to capture events
    const emitSpy = jest.spyOn(
      manager as unknown as {
        emit: (...args: unknown[]) => void;
      },
      "emit"
    );

    // Call private method via any to schedule reconnection
    (manager as unknown as { scheduleReconnection: (c: typeof connection) => void }).scheduleReconnection(connection);

    // First schedule increments attempts to 1 and sets a timeout; run timers
    jest.runOnlyPendingTimers();

    // Verify terminal events were emitted
    const emittedEvents = emitSpy.mock.calls.map((call: unknown[]) => (call as unknown[])[0]);
    expect(emittedEvents).toContain("max-reconnect-attempts-reached");
    expect(emittedEvents).toContain("all-connections-lost");

    // Verify state transitioned to FAILED
    expect(connection.state).toBe("failed");
  });
});
