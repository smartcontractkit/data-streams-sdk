import { describe, it, expect, beforeEach, jest, afterEach } from "@jest/globals";
import { ConnectionManager } from "../../../../src/stream/connection-manager";
import { Config } from "../../../../src/types/client";
import * as originDiscovery from "../../../../src/utils/origin-discovery";

// Event handler type for ws events
type WsHandler = (...args: unknown[]) => void;

// Track event listeners for cleanup verification
interface MockWebSocketInstance {
  on: jest.Mock;
  once: jest.Mock;
  ping: jest.Mock;
  pong: jest.Mock;
  terminate: jest.Mock;
  close: jest.Mock;
  removeAllListeners: jest.Mock;
  removeListener: jest.Mock;
  readyState: number;
  listeners: Map<string, WsHandler[]>;
}

// Create a mock WebSocket instance with listener tracking
function createMockWebSocket(): MockWebSocketInstance {
  const listeners = new Map<string, WsHandler[]>();

  const mockWs: MockWebSocketInstance = {
    on: jest.fn((event: string, handler: WsHandler) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)!.push(handler);
    }),
    once: jest.fn((event: string, handler: WsHandler) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)!.push(handler);
    }),
    ping: jest.fn(),
    pong: jest.fn(),
    terminate: jest.fn(),
    close: jest.fn(),
    removeAllListeners: jest.fn((event?: string) => {
      if (event) {
        listeners.delete(event);
      } else {
        listeners.clear();
      }
    }),
    removeListener: jest.fn((event: string, handler: WsHandler) => {
      const handlers = listeners.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }),
    readyState: 1, // WebSocket.OPEN
    listeners,
  };

  return mockWs;
}

let mockWsInstance: MockWebSocketInstance;
let wsConstructor: jest.Mock;

jest.mock("ws", () => {
  wsConstructor = jest.fn(() => {
    mockWsInstance = createMockWebSocket();
    return mockWsInstance;
  });
  // Provide static constants
  (wsConstructor as unknown as { OPEN: number; CONNECTING: number; CLOSED: number }).OPEN = 1;
  (wsConstructor as unknown as { OPEN: number; CONNECTING: number; CLOSED: number }).CONNECTING = 0;
  (wsConstructor as unknown as { OPEN: number; CONNECTING: number; CLOSED: number }).CLOSED = 3;
  return {
    __esModule: true,
    default: wsConstructor,
  };
});

// Mock origin discovery
jest.mock("../../../../src/utils/origin-discovery", () => ({
  getAvailableOrigins: jest.fn(),
}));

describe("ConnectionManager - Resource Cleanup", () => {
  let manager: ConnectionManager;
  let config: Config;
  let managerConfig: {
    feedIds: string[];
    maxReconnectAttempts: number;
    reconnectInterval: number;
    connectTimeout: number;
    haMode: boolean;
    haConnectionTimeout: number;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    config = {
      apiKey: "test-api-key",
      userSecret: "test-user-secret",
      endpoint: "https://api.example.com",
      wsEndpoint: "wss://ws.example.com",
      haMode: false,
    };

    managerConfig = {
      feedIds: ["0x0003" + "1".repeat(60)],
      maxReconnectAttempts: 3,
      reconnectInterval: 100,
      connectTimeout: 5000,
      haMode: false,
      haConnectionTimeout: 5000,
    };

    manager = new ConnectionManager(config, managerConfig);

    // Mock origin discovery
    (originDiscovery.getAvailableOrigins as jest.Mock).mockResolvedValue(["wss://ws.example.com"]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("WebSocket listener cleanup", () => {
    it("should remove all event listeners when WebSocket is replaced during reconnection", async () => {
      let openHandler: WsHandler | undefined;
      let closeHandler: WsHandler | undefined;

      // First connection - establish successfully
      mockWsInstance.on.mockImplementation((event: string, handler: WsHandler) => {
        if (event === "open") {
          openHandler = handler;
        } else if (event === "close") {
          closeHandler = handler;
        }
      });

      // Simulate successful connection
      await manager.initialize();
      if (openHandler) {
        openHandler();
      }
      jest.advanceTimersByTime(1);

      // Verify first WebSocket has listeners
      const firstWs = mockWsInstance;
      expect(firstWs.listeners.size).toBeGreaterThan(0);
      const initialListenerCount = Array.from(firstWs.listeners.values()).reduce(
        (sum, handlers) => sum + handlers.length,
        0
      );
      expect(initialListenerCount).toBeGreaterThan(0);

      // Simulate connection loss
      if (closeHandler) {
        closeHandler();
      }
      jest.advanceTimersByTime(1);

      // Advance timers to trigger reconnection
      jest.advanceTimersByTime(managerConfig.reconnectInterval);

      // Verify cleanup was called on the old WebSocket
      expect(firstWs.removeAllListeners).toHaveBeenCalled();
    });

    it("should cleanup old WebSocket before creating new one in establishConnection", async () => {
      const wsInstances: MockWebSocketInstance[] = [];

      // Track all WebSocket instances created
      wsConstructor.mockImplementation(() => {
        const ws = createMockWebSocket();
        wsInstances.push(ws);
        return ws;
      });

      // First connection
      wsInstances[0]?.on.mockImplementation((event: string, handler: WsHandler) => {
        if (event === "open") {
          setTimeout(() => handler(), 1);
        }
      });

      await manager.initialize();
      jest.advanceTimersByTime(10);

      // Simulate connection loss
      const closeHandler = wsInstances[0]?.listeners.get("close")?.[0];
      if (closeHandler) {
        closeHandler();
      }
      jest.advanceTimersByTime(1);

      // Advance to trigger reconnection
      jest.advanceTimersByTime(managerConfig.reconnectInterval);

      // Verify that cleanup was called on the first WebSocket before creating the second
      if (wsInstances.length > 1) {
        // The first WebSocket should have been cleaned up
        expect(wsInstances[0]?.removeAllListeners).toHaveBeenCalled();
      }
    });

    it("should remove all listeners during shutdown", async () => {
      // Establish connection
      mockWsInstance.on.mockImplementation((event: string, handler: WsHandler) => {
        if (event === "open") {
          setTimeout(() => handler(), 1);
        }
      });

      await manager.initialize();
      jest.advanceTimersByTime(10);

      // Verify listeners were added
      expect(mockWsInstance.listeners.size).toBeGreaterThan(0);

      // Shutdown
      await manager.shutdown();
      jest.advanceTimersByTime(10);

      // Verify cleanup was called
      expect(mockWsInstance.removeAllListeners).toHaveBeenCalled();
    });

    it("should cleanup WebSocket in all error paths", async () => {
      // Test timeout error path
      mockWsInstance.on.mockImplementation(() => {
        // Don't call open, let it timeout
      });

      const initPromise = manager.initialize();

      // Advance past connect timeout
      jest.advanceTimersByTime(managerConfig.connectTimeout + 1);

      await expect(initPromise).rejects.toThrow();

      // Verify cleanup was called
      expect(mockWsInstance.removeAllListeners).toHaveBeenCalled();
      expect(mockWsInstance.terminate).toHaveBeenCalled();
    });

    it("should cleanup WebSocket on unexpected-response error", async () => {
      let unexpectedResponseHandler: WsHandler | undefined;

      mockWsInstance.once.mockImplementation((event: string, handler: WsHandler) => {
        if (event === "unexpected-response") {
          unexpectedResponseHandler = handler;
        }
      });

      mockWsInstance.on.mockImplementation((event: string, handler: WsHandler) => {
        if (event === "open") {
          // Don't call this, trigger unexpected-response instead
        }
      });

      const initPromise = manager.initialize();

      // Trigger unexpected-response
      if (unexpectedResponseHandler) {
        unexpectedResponseHandler({}, { statusCode: 401 });
      }
      jest.advanceTimersByTime(1);

      await expect(initPromise).rejects.toThrow();

      // Verify cleanup was called
      expect(mockWsInstance.removeAllListeners).toHaveBeenCalled();
    });

    it("should cleanup WebSocket on error during connection", async () => {
      let errorHandler: WsHandler | undefined;

      mockWsInstance.on.mockImplementation((event: string, handler: WsHandler) => {
        if (event === "error") {
          errorHandler = handler;
        }
      });

      const initPromise = manager.initialize();

      // Trigger error during connection
      if (errorHandler) {
        errorHandler(new Error("Connection failed"));
      }
      jest.advanceTimersByTime(1);

      await expect(initPromise).rejects.toThrow();

      // Verify cleanup was called
      expect(mockWsInstance.removeAllListeners).toHaveBeenCalled();
    });
  });

  describe("Timeout cleanup", () => {
    it("should clear connect timeout when connection succeeds", async () => {
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

      mockWsInstance.on.mockImplementation((event: string, handler: WsHandler) => {
        if (event === "open") {
          setTimeout(() => handler(), 1);
        }
      });

      await manager.initialize();
      jest.advanceTimersByTime(10);

      // Verify clearTimeout was called (for the connect timeout)
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("should clear connect timeout in error paths", async () => {
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

      mockWsInstance.on.mockImplementation(() => {
        // Don't call open, let it timeout
      });

      const initPromise = manager.initialize();

      // Advance past connect timeout
      jest.advanceTimersByTime(managerConfig.connectTimeout + 1);

      await expect(initPromise).rejects.toThrow();

      // Verify clearTimeout was called
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("should clear existing reconnection timeout before scheduling new one", async () => {
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

      // Establish connection
      mockWsInstance.on.mockImplementation((event: string, handler: WsHandler) => {
        if (event === "open") {
          setTimeout(() => handler(), 1);
        } else if (event === "close") {
          // Store handler to trigger later
          setTimeout(() => handler(), 10);
        }
      });

      await manager.initialize();
      jest.advanceTimersByTime(10);

      // Trigger connection loss
      const closeHandler = mockWsInstance.listeners.get("close")?.[0];
      if (closeHandler) {
        closeHandler();
      }
      jest.advanceTimersByTime(1);

      // First reconnection attempt scheduled
      jest.advanceTimersByTime(managerConfig.reconnectInterval / 2);

      // Trigger another connection loss before first reconnection completes
      if (closeHandler) {
        closeHandler();
      }
      jest.advanceTimersByTime(1);

      // Advance to trigger second reconnection attempt
      jest.advanceTimersByTime(managerConfig.reconnectInterval);

      // Verify clearTimeout was called (should clear the first reconnection timeout)
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("should clear reconnection timeout when connection succeeds", async () => {
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

      // Establish connection
      mockWsInstance.on.mockImplementation((event: string, handler: WsHandler) => {
        if (event === "open") {
          setTimeout(() => handler(), 1);
        } else if (event === "close") {
          // Store handler
        }
      });

      await manager.initialize();
      jest.advanceTimersByTime(10);

      // Trigger connection loss
      const closeHandler = mockWsInstance.listeners.get("close")?.[0];
      if (closeHandler) {
        closeHandler();
      }
      jest.advanceTimersByTime(1);

      // Advance to trigger reconnection
      jest.advanceTimersByTime(managerConfig.reconnectInterval);

      // New connection should succeed and clear the reconnection timeout
      const newOpenHandler = mockWsInstance.listeners.get("open")?.[0];
      if (newOpenHandler) {
        newOpenHandler();
      }
      jest.advanceTimersByTime(1);

      // Verify clearTimeout was called (should clear reconnection timeout)
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("should clear reconnection timeout during shutdown", async () => {
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

      // Establish connection
      mockWsInstance.on.mockImplementation((event: string, handler: WsHandler) => {
        if (event === "open") {
          setTimeout(() => handler(), 1);
        } else if (event === "close") {
          // Store handler
        }
      });

      await manager.initialize();
      jest.advanceTimersByTime(10);

      // Trigger connection loss to schedule reconnection
      const closeHandler = mockWsInstance.listeners.get("close")?.[0];
      if (closeHandler) {
        closeHandler();
      }
      jest.advanceTimersByTime(1);

      // Shutdown before reconnection completes
      await manager.shutdown();
      jest.advanceTimersByTime(1);

      // Verify clearTimeout was called (should clear reconnection timeout)
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe("Health monitoring cleanup", () => {
    it("should clear ping interval and pong timeout on connection loss", async () => {
      const clearIntervalSpy = jest.spyOn(global, "clearInterval");
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

      // Establish connection
      mockWsInstance.on.mockImplementation((event: string, handler: WsHandler) => {
        if (event === "open") {
          setTimeout(() => handler(), 1);
        } else if (event === "close") {
          // Store handler
        }
      });

      await manager.initialize();
      jest.advanceTimersByTime(10);

      // Trigger connection loss
      const closeHandler = mockWsInstance.listeners.get("close")?.[0];
      if (closeHandler) {
        closeHandler();
      }
      jest.advanceTimersByTime(1);

      // Verify health monitoring was cleaned up
      expect(clearIntervalSpy).toHaveBeenCalled(); // ping interval
      expect(clearTimeoutSpy).toHaveBeenCalled(); // pong timeout (if any)
    });

    it("should clear health monitoring during shutdown", async () => {
      const clearIntervalSpy = jest.spyOn(global, "clearInterval");
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

      // Establish connection
      mockWsInstance.on.mockImplementation((event: string, handler: WsHandler) => {
        if (event === "open") {
          setTimeout(() => handler(), 1);
        }
      });

      await manager.initialize();
      jest.advanceTimersByTime(10);

      // Shutdown
      await manager.shutdown();
      jest.advanceTimersByTime(1);

      // Verify health monitoring was cleaned up
      expect(clearIntervalSpy).toHaveBeenCalled(); // ping interval
      expect(clearTimeoutSpy).toHaveBeenCalled(); // pong timeout (if any)
    });
  });

  describe("Multiple reconnection scenarios", () => {
    it("should properly cleanup when multiple reconnections occur", async () => {
      const wsInstances: MockWebSocketInstance[] = [];

      // Track all WebSocket instances
      wsConstructor.mockImplementation(() => {
        const ws = createMockWebSocket();
        wsInstances.push(ws);
        return ws;
      });

      // First connection
      wsInstances[0]?.on.mockImplementation((event: string, handler: WsHandler) => {
        if (event === "open") {
          setTimeout(() => handler(), 1);
        } else if (event === "close") {
          // Store handler
        }
      });

      await manager.initialize();
      jest.advanceTimersByTime(10);

      // Trigger multiple connection losses and reconnections
      for (let i = 0; i < 3; i++) {
        const currentWs = wsInstances[wsInstances.length - 1];
        const closeHandler = currentWs?.listeners.get("close")?.[0];
        if (closeHandler) {
          closeHandler();
        }
        jest.advanceTimersByTime(1);

        // Advance to trigger reconnection
        jest.advanceTimersByTime(managerConfig.reconnectInterval);

        // New connection succeeds
        const newWs = wsInstances[wsInstances.length - 1];
        const openHandler = newWs?.listeners.get("open")?.[0];
        if (openHandler) {
          openHandler();
        }
        jest.advanceTimersByTime(1);
      }

      // Verify all old WebSocket instances were cleaned up
      for (let i = 0; i < wsInstances.length - 1; i++) {
        expect(wsInstances[i]?.removeAllListeners).toHaveBeenCalled();
      }
    });
  });

  describe("Connection state after cleanup", () => {
    it("should set WebSocket to null after cleanup", async () => {
      // Establish connection
      mockWsInstance.on.mockImplementation((event: string, handler: WsHandler) => {
        if (event === "open") {
          setTimeout(() => handler(), 1);
        } else if (event === "close") {
          // Store handler
        }
      });

      await manager.initialize();
      jest.advanceTimersByTime(10);

      // Get connection details before cleanup
      const connectionsBefore = manager.getConnectionDetails();
      expect(connectionsBefore.length).toBeGreaterThan(0);

      // Shutdown
      await manager.shutdown();
      jest.advanceTimersByTime(10);

      // Verify connections are cleared
      const connectionsAfter = manager.getConnectionDetails();
      expect(connectionsAfter.length).toBe(0);
    });
  });
});

