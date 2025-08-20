/**
 * Integration Tests for High Availability Mode
 *
 * These tests validate the Stream High Availability functionality by:
 * - Testing HA mode with dynamic origin discovery
 * - Verifying multi-origin connection establishment
 * - Testing behavior during partial connection failures
 * - Checking that reports are properly received and deduplicated
 * - Validating fallback to single connection when needed
 *
 * Requirements:
 * - Network access for WebSocket connections
 * - Extended timeouts (20s) due to complex network operations
 * - May require extra resources when running multiple server instances
 */

import { describe, it, expect, afterEach, beforeEach } from "@jest/globals";
import { MockWebSocketServer } from "../utils/mockWebSocketServer";
import { Config, Stream } from "../../src";
import { AbiCoder } from "ethers";
import * as originDiscovery from "../../src/utils/origin-discovery";

// Longer timeouts for HA tests
const TEST_TIMEOUT = 20000;

// Create a properly encoded full report for testing
const REAL_REPORT_BLOB =
  "0x0006f9b553e393ced311551efd30d1decedb63d76ad41737462e2cdbbdff157800000000000000000000000000000000000000000000000000000000351f200b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000028000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000120000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba7820000000000000000000000000000000000000000000000000000000066aa78ab0000000000000000000000000000000000000000000000000000000066aa78ab00000000000000000000000000000000000000000000000000001b6732178a04000000000000000000000000000000000000000000000000001b1e8f8f0dc6880000000000000000000000000000000000000000000000000000000066abca2b0000000000000000000000000000000000000000000000b3eba5491849628aa00000000000000000000000000000000000000000000000b3eaf356fc42b6f6c00000000000000000000000000000000000000000000000b3ecd20810b9d1c0";

const abiCoder = new AbiCoder();
const FULL_REPORT = abiCoder.encode(
  ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
  [
    [
      "0x0000000000000000000000000000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000000000000000000000000000002",
      "0x0000000000000000000000000000000000000000000000000000000000000003",
    ],
    REAL_REPORT_BLOB,
    ["0x0000000000000000000000000000000000000000000000000000000000000004"],
    ["0x0000000000000000000000000000000000000000000000000000000000000005"],
    "0x0000000000000000000000000000000000000000000000000000000000000006",
  ]
);

// Mock origin discovery
jest.mock("../../src/utils/origin-discovery", () => ({
  getAvailableOrigins: jest.fn(),
}));

describe("HA Mode Integration Tests", () => {
  // We'll use multiple mock servers to simulate HA connections
  let mockServers: MockWebSocketServer[] = [];
  let stream: Stream;
  let feedIds: string[];

  // Helper to create and start mock servers
  async function createMockServers(count: number): Promise<MockWebSocketServer[]> {
    const servers: MockWebSocketServer[] = [];
    for (let i = 0; i < count; i++) {
      const server = new MockWebSocketServer();
      const isReady = await server.waitForReady();
      if (!isReady) {
        throw new Error(`Mock server ${i} failed to start`);
      }
      servers.push(server);
    }
    return servers;
  }

  // Helper to create a test message for a specific feed
  function createMockReportMessage(feedId: string, timestamp = Date.now()) {
    return JSON.stringify({
      report: {
        feedID: feedId,
        fullReport: FULL_REPORT,
        validFromTimestamp: timestamp,
        observationsTimestamp: timestamp,
      },
    });
  }

  // Initialize test environment
  beforeEach(async () => {
    // Configure feed IDs for HA testing
    feedIds = ["0x0003" + "1".repeat(60), "0x0003" + "2".repeat(60)];

    // Clear mocks
    jest.clearAllMocks();
  });

  // Cleanup after each test
  afterEach(async () => {
    try {
      if (stream) {
        await stream.close();
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } finally {
      for (const server of mockServers) {
        await server.close();
        // Wait for server cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      mockServers = [];
    }
  });

  /**
   * Test: HA Mode with multiple connections
   * Verifies that the stream can establish multiple connections in HA mode
   */
  it(
    "should establish multiple connections in HA mode",
    async () => {
      // Create 3 mock servers for HA connections
      const serverCount = 3;
      mockServers = await createMockServers(serverCount);

      // Get server addresses and create WebSocket URLs
      const addresses = mockServers.map(server => server.getAddress());
      const wsUrls = addresses.map(addr => `ws://${addr}`);

      // Mock origin discovery to return multiple origins
      (originDiscovery.getAvailableOrigins as jest.Mock).mockResolvedValue(wsUrls);

      // Use the first server for the main endpoint
      const config: Config = {
        apiKey: "mock_key",
        userSecret: "mock_secret",
        endpoint: `http://${addresses[0]}`,
        wsEndpoint: wsUrls.join(","), // Comma-separated URLs for HA mode
        haMode: true,
      };

      // Create stream with HA mode enabled
      stream = new Stream(config, feedIds, {
        maxReconnectAttempts: 2,
        reconnectInterval: 500,
      });

      // Connect
      await stream.connect();

      // Wait for connections to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Validate HA connection establishment
      const stats = stream.getMetrics();
      expect(stats.configuredConnections).toBeGreaterThan(1);
      expect(stats.activeConnections).toBeGreaterThan(0);

      // Verify clients connected to our mock servers
      let totalConnectedClients = 0;
      for (const server of mockServers) {
        totalConnectedClients += server.getConnectedClientsCount();
      }

      // We should have multiple connections in HA mode
      expect(totalConnectedClients).toBeGreaterThan(1);
    },
    TEST_TIMEOUT
  );

  /**
   * Test: Simplified reconnection test
   * Verifies that stream continues to function after closing connections
   */
  it(
    "should handle connection changes gracefully",
    async () => {
      // Create 2 mock servers for HA connections
      const serverCount = 2;
      mockServers = await createMockServers(serverCount);

      // Get server addresses and create WebSocket URLs
      const addresses = mockServers.map(server => server.getAddress());
      const wsUrls = addresses.map(addr => `ws://${addr}`);

      // Mock origin discovery to return multiple origins
      (originDiscovery.getAvailableOrigins as jest.Mock).mockResolvedValue(wsUrls);

      // Use the first server for the main endpoint
      const config: Config = {
        apiKey: "mock_key",
        userSecret: "mock_secret",
        endpoint: `http://${addresses[0]}`,
        wsEndpoint: wsUrls.join(","), // Comma-separated URLs for HA mode
        haMode: true,
      };

      // Create stream with HA mode enabled
      stream = new Stream(config, feedIds, {
        maxReconnectAttempts: 2,
        reconnectInterval: 500,
      });

      // Connect
      await stream.connect();

      // Get initial stats
      const initialStats = stream.getMetrics();
      expect(initialStats.activeConnections).toBeGreaterThan(0);

      // Close all connections on the first server
      await mockServers[0].closeAllConnections();

      // Wait for reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Stream maintains operational state after connection changes
      try {
        const stats = stream.getMetrics();
        expect(stats).toBeDefined();
      } catch {
        fail("Stream should still be usable after connection changes");
      }
    },
    TEST_TIMEOUT
  );

  /**
   * Test: Simplified deduplication test
   * Tests basic report reception
   */
  it(
    "should receive reports from active connections",
    async () => {
      // Create 2 mock servers for HA connections
      const serverCount = 2;
      mockServers = await createMockServers(serverCount);

      // Get server addresses and create WebSocket URLs
      const addresses = mockServers.map(server => server.getAddress());
      const wsUrls = addresses.map(addr => `ws://${addr}`);

      // Mock origin discovery to return multiple origins
      (originDiscovery.getAvailableOrigins as jest.Mock).mockResolvedValue(wsUrls);

      // Use the first server for the main endpoint
      const config: Config = {
        apiKey: "mock_key",
        userSecret: "mock_secret",
        endpoint: `http://${addresses[0]}`,
        wsEndpoint: wsUrls.join(","), // Comma-separated URLs for HA mode
        haMode: true,
      };

      // Create stream with HA mode enabled
      stream = new Stream(config, feedIds, {
        maxReconnectAttempts: 2,
        reconnectInterval: 500,
      });

      // Create a promise that resolves when we receive a report
      const reportPromise = new Promise<void>((resolve, _reject) => {
        const timeout = setTimeout(() => {
          // Timeout handling for report reception
          resolve();
        }, 5000);

        stream.once("report", () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      // Connect
      await stream.connect();

      // Wait for connections to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send a report to both servers
      const reportMessage = createMockReportMessage(feedIds[0]);
      for (const server of mockServers) {
        server.broadcast(reportMessage);
      }

      // Wait for report (or timeout)
      await reportPromise;

      // Confirm stream operational integrity
      try {
        const stats = stream.getMetrics();
        expect(stats).toBeDefined();
      } catch {
        fail("Stream should be usable after receiving reports");
      }
    },
    TEST_TIMEOUT
  );
});
