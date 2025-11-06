/**
 * Integration Tests for WebSocket Connection Cleanup
 *
 * These tests validate that:
 * - Old WebSocket connections are properly cleaned up before reconnection
 * - No duplicate connections are created during reconnection
 * - Event listeners are properly removed to prevent memory leaks
 * - Health monitoring timers are cleaned up correctly
 */

import { describe, it, expect, afterEach, beforeEach } from "@jest/globals";
import { MockWebSocketServer } from "../utils/mockWebSocketServer";
import { Config, Stream } from "../../src";
import { AbiCoder } from "ethers";

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

describe("WebSocket Connection Cleanup Tests", () => {
  let mockServer: MockWebSocketServer;
  let stream: Stream;

  beforeEach(() => {
    // Fresh server for each test
    mockServer = new MockWebSocketServer();
  });

  afterEach(async () => {
    try {
      if (stream) {
        await stream.close();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } finally {
      if (mockServer) {
        await mockServer.close();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  });

  /**
   * Test: Verify old WebSocket is cleaned up before reconnection
   * This is the critical fix - ensures no duplicate connections
   */
  it("should clean up old WebSocket before creating new connection during reconnection", async () => {
    const isReady = await mockServer.waitForReady();
    expect(isReady).toBe(true);

    const address = mockServer.getAddress();
    const config: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: `ws://${address}`,
      haMode: false,
    };

    stream = new Stream(config, ["feed1"], {
      maxReconnectAttempts: 3,
      reconnectInterval: 500, // Short interval for faster testing
    });

    let reportCount = 0;
    stream.on("report", () => {
      reportCount++;
    });

    // Track reconnection events
    let reconnectionCount = 0;
    stream.on("reconnecting", () => {
      reconnectionCount++;
    });

    // Connect and verify single connection
    await stream.connect();
    expect(mockServer.getActiveConnectionCount()).toBe(1);

    // Send a report to confirm connection works
    const reportMessage1 = JSON.stringify({
      report: {
        feedID: "feed1",
        fullReport: FULL_REPORT,
        validFromTimestamp: 1000,
        observationsTimestamp: 1000,
      },
    });
    mockServer.broadcast(reportMessage1);

    await new Promise(resolve => setTimeout(resolve, 200));
    expect(reportCount).toBe(1);

    // Force disconnect to trigger reconnection
    const initialConnectionCount = mockServer.getActiveConnectionCount();
    mockServer.simulateConnectionDrops();

    // Wait for reconnection to be scheduled and executed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify reconnection happened
    expect(reconnectionCount).toBeGreaterThan(0);

    // CRITICAL CHECK: Should still have only 1 connection (not 2+)
    const finalConnectionCount = mockServer.getActiveConnectionCount();
    expect(finalConnectionCount).toBe(1);
    expect(finalConnectionCount).not.toBeGreaterThan(initialConnectionCount);

    // Verify connection still works after reconnection
    const reportMessage2 = JSON.stringify({
      report: {
        feedID: "feed1",
        fullReport: FULL_REPORT,
        validFromTimestamp: 2000,
        observationsTimestamp: 2000,
      },
    });
    mockServer.broadcast(reportMessage2);

    await new Promise(resolve => setTimeout(resolve, 200));
    expect(reportCount).toBe(2);
  }, 10000);

  /**
   * Test: Verify no connection accumulation over multiple reconnections
   */
  it("should not accumulate connections over multiple reconnect cycles", async () => {
    const isReady = await mockServer.waitForReady();
    expect(isReady).toBe(true);

    const address = mockServer.getAddress();
    const config: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: `ws://${address}`,
      haMode: false,
    };

    stream = new Stream(config, ["feed1"], {
      maxReconnectAttempts: 10,
      reconnectInterval: 300,
    });

    await stream.connect();
    const initialConnectionCount = mockServer.getActiveConnectionCount();
    expect(initialConnectionCount).toBe(1);

    // Simulate multiple disconnect/reconnect cycles
    const RECONNECT_CYCLES = 3;
    for (let i = 0; i < RECONNECT_CYCLES; i++) {
      // Disconnect
      mockServer.simulateConnectionDrops();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 800));

      // Verify still only 1 connection
      const currentCount = mockServer.getActiveConnectionCount();
      expect(currentCount).toBe(1);
    }

    // Final check - should still be exactly 1 connection
    const finalConnectionCount = mockServer.getActiveConnectionCount();
    expect(finalConnectionCount).toBe(1);
  }, 15000);

  /**
   * Test: Verify event listeners don't accumulate
   */
  it("should not have duplicate event listeners after reconnection", async () => {
    const isReady = await mockServer.waitForReady();
    expect(isReady).toBe(true);

    const address = mockServer.getAddress();
    const config: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: `ws://${address}`,
      haMode: false,
    };

    stream = new Stream(config, ["feed1"], {
      maxReconnectAttempts: 3,
      reconnectInterval: 300,
    });

    let reportCount = 0;
    stream.on("report", () => {
      reportCount++;
    });

    await stream.connect();

    // Trigger disconnect and reconnect
    mockServer.simulateConnectionDrops();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send one report - should only be received once
    const reportMessage = JSON.stringify({
      report: {
        feedID: "feed1",
        fullReport: FULL_REPORT,
        validFromTimestamp: 1000,
        observationsTimestamp: 1000,
      },
    });
    mockServer.broadcast(reportMessage);

    await new Promise(resolve => setTimeout(resolve, 300));

    // Should receive exactly 1 report, not 2+ (which would indicate duplicate listeners)
    expect(reportCount).toBe(1);
  }, 10000);

  /**
   * Test: Verify connection cleanup during graceful shutdown
   */
  it("should properly clean up connection during graceful shutdown", async () => {
    const isReady = await mockServer.waitForReady();
    expect(isReady).toBe(true);

    const address = mockServer.getAddress();
    const config: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: `ws://${address}`,
      haMode: false,
    };

    stream = new Stream(config, ["feed1"], {
      maxReconnectAttempts: 3,
      reconnectInterval: 1000,
    });

    await stream.connect();
    expect(mockServer.getActiveConnectionCount()).toBe(1);

    // Close the stream
    await stream.close();

    // Wait a bit to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify connection was properly closed
    const metrics = stream.getMetrics();
    expect(metrics.activeConnections).toBe(0);

    // Server should have 0 active connections
    expect(mockServer.getActiveConnectionCount()).toBe(0);
  }, 10000);

  /**
   * Test: Verify HA mode also cleans up properly (multiple connections)
   */
  it("should clean up all connections in HA mode without duplication", async () => {
    // Create two mock servers for HA mode
    const mockServer2 = new MockWebSocketServer();
    const isReady1 = await mockServer.waitForReady();
    const isReady2 = await mockServer2.waitForReady();
    expect(isReady1).toBe(true);
    expect(isReady2).toBe(true);

    const address1 = mockServer.getAddress();
    const address2 = mockServer2.getAddress();

    const config: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: `ws://${address1},ws://${address2}`,
      haMode: true,
    };

    stream = new Stream(config, ["feed1"], {
      maxReconnectAttempts: 3,
      reconnectInterval: 300,
    });

    await stream.connect();

    // Should have 1 connection to each server (2 total)
    const initialCount1 = mockServer.getActiveConnectionCount();
    const initialCount2 = mockServer2.getActiveConnectionCount();
    expect(initialCount1).toBe(1);
    expect(initialCount2).toBe(1);

    // Disconnect first server to trigger reconnection
    mockServer.simulateConnectionDrops();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // First server should reconnect, still 1 connection each
    expect(mockServer.getActiveConnectionCount()).toBe(1);
    expect(mockServer2.getActiveConnectionCount()).toBe(1);

    // Disconnect both and wait for reconnection
    mockServer.simulateConnectionDrops();
    mockServer2.simulateConnectionDrops();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Both should reconnect, still 1 connection each (not 2+)
    expect(mockServer.getActiveConnectionCount()).toBe(1);
    expect(mockServer2.getActiveConnectionCount()).toBe(1);

    // Cleanup
    await stream.close();
    await mockServer2.close();
  }, 15000);
});

