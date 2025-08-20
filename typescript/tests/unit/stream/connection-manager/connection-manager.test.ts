import { ConnectionManager } from "../../../../src/stream/connection-manager";
import { Config } from "../../../../src/types/client";
import * as originDiscovery from "../../../../src/utils/origin-discovery";

// Mock the WebSocket
const mockWebSocket = {
  on: jest.fn(),
  once: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  terminate: jest.fn(),
  readyState: 1, // OPEN
};

// Mock the WebSocket constructor
jest.mock("ws", () => ({
  __esModule: true,
  default: jest.fn(() => mockWebSocket),
}));

// Mock origin discovery
jest.mock("../../../../src/utils/origin-discovery", () => ({
  getAvailableOrigins: jest.fn(),
}));

describe("ConnectionManager", () => {
  let mockConfig: Config;
  let mockManagerConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      apiKey: "test-api-key",
      userSecret: "test-user-secret",
      endpoint: "https://test.example.com",
      wsEndpoint: "wss://test.example.com",
      haMode: true,
      haConnectionTimeout: 5000,
    };

    mockManagerConfig = {
      feedIds: ["0x123", "0x456"],
      maxReconnectAttempts: 3,
      reconnectInterval: 1000,
      connectTimeout: 5000,
      haMode: true,
      haConnectionTimeout: 5000,
      statusCallback: jest.fn(),
    };
  });

  describe("basic functionality", () => {
    it("should create instance and get initial connection counts", () => {
      const connectionManager = new ConnectionManager(mockConfig, mockManagerConfig);

      expect(connectionManager.getConfiguredConnectionCount()).toBe(0);
      expect(connectionManager.getActiveConnectionCount()).toBe(0);
    });

    it("should initialize with multiple origins in HA mode", async () => {
      const connectionManager = new ConnectionManager(mockConfig, mockManagerConfig);
      const mockOrigins = ["wss://origin1.example.com", "wss://origin2.example.com"];
      (originDiscovery.getAvailableOrigins as jest.Mock).mockResolvedValue(mockOrigins);

      // Mock successful WebSocket connections
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === "open") {
          // Simulate immediate connection
          setTimeout(() => callback(), 1);
        }
      });

      await connectionManager.initialize();

      expect(connectionManager.getConfiguredConnectionCount()).toBe(2);
    });

    it("should handle single origin fallback", async () => {
      const connectionManager = new ConnectionManager(mockConfig, mockManagerConfig);
      const mockOrigins = ["wss://single-origin.example.com"];
      (originDiscovery.getAvailableOrigins as jest.Mock).mockResolvedValue(mockOrigins);

      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === "open") {
          setTimeout(() => callback(), 1);
        }
      });

      await connectionManager.initialize();

      expect(connectionManager.getConfiguredConnectionCount()).toBe(1);
    });

    it("should handle origin discovery failure", async () => {
      const connectionManager = new ConnectionManager(mockConfig, mockManagerConfig);
      (originDiscovery.getAvailableOrigins as jest.Mock).mockRejectedValue(new Error("Discovery failed"));

      await expect(connectionManager.initialize()).rejects.toThrow("Discovery failed");
    });

    it("should shutdown connections gracefully", async () => {
      const connectionManager = new ConnectionManager(mockConfig, mockManagerConfig);
      const mockOrigins = ["wss://origin1.example.com"];
      (originDiscovery.getAvailableOrigins as jest.Mock).mockResolvedValue(mockOrigins);

      // Mock WebSocket with immediate open callback
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === "open") {
          // Call immediately to ensure connection is established
          callback();
        }
      });

      await connectionManager.initialize();

      // Verify connection was established
      expect(connectionManager.getActiveConnectionCount()).toBe(1);

      // Test that shutdown completes without throwing
      await expect(connectionManager.shutdown()).resolves.not.toThrow();

      // Verify all connections are cleared
      expect(connectionManager.getConfiguredConnectionCount()).toBe(0);
      expect(connectionManager.getActiveConnectionCount()).toBe(0);
    });
  });

  describe("connection status", () => {
    it("should track connection states", () => {
      const connectionManager = new ConnectionManager(mockConfig, mockManagerConfig);

      // Initially no connections
      expect(connectionManager.getActiveConnectionCount()).toBe(0);
      expect(connectionManager.getConfiguredConnectionCount()).toBe(0);
    });

    it("should handle status callbacks", async () => {
      const statusCallback = jest.fn();
      const configWithCallback = {
        ...mockManagerConfig,
        statusCallback,
      };

      const connectionManager = new ConnectionManager(mockConfig, configWithCallback);
      const mockOrigins = ["wss://origin1.example.com"];
      (originDiscovery.getAvailableOrigins as jest.Mock).mockResolvedValue(mockOrigins);

      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === "open") {
          setTimeout(() => callback(), 1);
        }
      });

      await connectionManager.initialize();

      // Should have called status callback for connection
      expect(statusCallback).toHaveBeenCalled();
    });
  });
});
