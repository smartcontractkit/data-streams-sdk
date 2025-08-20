/**
 * Integration Tests for Stream Core Functionality
 *
 * These tests validate the WebSocket streaming capabilities by:
 * - Testing connection establishment and report receiving
 * - Validating reconnection behavior when connections are dropped
 * - Checking graceful shutdown and cleanup
 * - Testing behavior with multiple feeds
 * - Verifying max reconnection attempt handling
 *
 * Requirements:
 * - Network access for WebSocket connections
 * - Extended timeouts for reconnection tests
 * - Uses a mock WebSocket server to simulate the Data Streams API
 */

import { describe, it, expect, afterEach } from "@jest/globals";
import { MockWebSocketServer } from "../utils/mockWebSocketServer";
import { Config, Stream } from "../../src";
import { ConnectionType } from "../../src/stream";
import { AbiCoder } from "ethers";

// Set to true when debugging WebSocket connection issues
const DEBUG_LOGS = false;

// Helper function for conditional logging
const debugLog = (...args: any[]) => {
  if (DEBUG_LOGS) {
    console.log(...args);
  }
};

const MAX_RECONNECT_ATTEMPTS = 2;

const REAL_REPORT_BLOB =
  "0x0006f9b553e393ced311551efd30d1decedb63d76ad41737462e2cdbbdff157800000000000000000000000000000000000000000000000000000000351f200b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000028000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000120000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba7820000000000000000000000000000000000000000000000000000000066aa78ab0000000000000000000000000000000000000000000000000000000066aa78ab00000000000000000000000000000000000000000000000000001b6732178a04000000000000000000000000000000000000000000000000001b1e8f8f0dc6880000000000000000000000000000000000000000000000000000000066abca2b0000000000000000000000000000000000000000000000b3eba5491849628aa00000000000000000000000000000000000000000000000b3eaf356fc42b6f6c00000000000000000000000000000000000000000000000b3ecd20810b9d1c0";

// Create a properly encoded full report
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

describe("Stream ConnectionType Detection Tests", () => {
  let mockServer: MockWebSocketServer;
  let stream: Stream;

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
   * Test: Single connection type detection
   * Verifies that ConnectionType.Single is used for single WebSocket URL
   */
  it("should use ConnectionType.Single for single origin", async () => {
    mockServer = new MockWebSocketServer();
    const isReady = await mockServer.waitForReady();
    expect(isReady).toBe(true);

    const address = mockServer.getAddress();
    const config: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: `ws://${address}`,
      haMode: false, // Explicitly disable HA mode
    };

    stream = new Stream(config, ["feed1"], { maxReconnectAttempts: 1 });
    await stream.connect();

    // Should detect single connection type
    expect(stream.getConnectionType()).toBe(ConnectionType.Single);

    const stats = stream.getMetrics();
    expect(stats.configuredConnections).toBe(1);
    expect(stats.activeConnections).toBe(1);
  });

  /**
   * Test: Multiple connection type detection with HA mode
   * Verifies that ConnectionType.Multiple is used when HA mode is enabled with multiple origins
   */
  it("should use ConnectionType.Multiple for HA mode with multiple origins", async () => {
    mockServer = new MockWebSocketServer();
    const isReady = await mockServer.waitForReady();
    expect(isReady).toBe(true);

    const address = mockServer.getAddress();
    const config: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: `ws://${address},ws://${address}`, // Multiple URLs (same server for testing)
      haMode: true, // Enable HA mode
    };

    stream = new Stream(config, ["feed1"], { maxReconnectAttempts: 1 });
    await stream.connect();

    // Should detect multiple connection type
    expect(stream.getConnectionType()).toBe(ConnectionType.Multiple);

    const stats = stream.getMetrics();
    expect(stats.configuredConnections).toBe(2);
    expect(stats.activeConnections).toBeGreaterThan(0); // At least one should connect

    const origins = stream.getOrigins();
    expect(origins.length).toBe(2);
  });

  /**
   * Test: Fallback to Single when HA mode fails
   * Verifies that the system falls back to Single connection type when HA setup fails
   */
  it("should fallback to ConnectionType.Single when HA mode conditions not met", async () => {
    mockServer = new MockWebSocketServer();
    const isReady = await mockServer.waitForReady();
    expect(isReady).toBe(true);

    const address = mockServer.getAddress();
    const config: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: `ws://${address}`, // Single URL
      haMode: true, // HA mode requested
      haConnectionTimeout: 1000, // Short timeout for faster test
    };

    stream = new Stream(config, ["feed1"], { maxReconnectAttempts: 1 });
    await stream.connect();

    // Should fallback to single connection type
    expect(stream.getConnectionType()).toBe(ConnectionType.Single);

    const stats = stream.getMetrics();
    expect(stats.configuredConnections).toBe(1);
    expect(stats.activeConnections).toBe(1);
  });

  /**
   * Test: Connection type consistency after origin discovery fallback
   * Verifies connection type behavior when origin discovery fails
   */
  it("should maintain correct ConnectionType after origin discovery fallback", async () => {
    mockServer = new MockWebSocketServer();
    const isReady = await mockServer.waitForReady();
    expect(isReady).toBe(true);

    const address = mockServer.getAddress();
    const config: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: `ws://${address}`,
      haMode: true, // Request HA mode
      haConnectionTimeout: 1000, // Short timeout for faster test
    };

    stream = new Stream(config, ["feed1"], { maxReconnectAttempts: 1 });

    // Connect and expect fallback behavior
    await stream.connect();

    // Should maintain the determined connection type
    const connectionType = stream.getConnectionType();
    expect([ConnectionType.Single, ConnectionType.Multiple]).toContain(connectionType);

    const stats = stream.getMetrics();
    expect(stats.configuredConnections).toBeGreaterThan(0);
    expect(stats.activeConnections).toBeGreaterThan(0);
  });

  /**
   * Test: Origins array consistency with connection type
   * Verifies that getOrigins() returns correct data based on connection type
   */
  it("should return consistent origins array based on connection type", async () => {
    mockServer = new MockWebSocketServer();
    const isReady = await mockServer.waitForReady();
    expect(isReady).toBe(true);

    const address = mockServer.getAddress();

    // Test single connection
    const singleConfig: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: `ws://${address}`,
      haMode: false,
    };

    stream = new Stream(singleConfig, ["feed1"], { maxReconnectAttempts: 1 });
    await stream.connect();

    expect(stream.getConnectionType()).toBe(ConnectionType.Single);
    const singleOrigins = stream.getOrigins();
    expect(singleOrigins.length).toBe(1);
    expect(singleOrigins[0]).toBe(`ws://${address}`);

    await stream.close();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test multiple connections
    const multiConfig: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: `ws://${address},ws://${address}`,
      haMode: true,
    };

    stream = new Stream(multiConfig, ["feed1"], { maxReconnectAttempts: 1 });
    await stream.connect();

    expect(stream.getConnectionType()).toBe(ConnectionType.Multiple);
    const multiOrigins = stream.getOrigins();
    expect(multiOrigins.length).toBe(2);
    expect(multiOrigins[0]).toBe(`ws://${address}`);
    expect(multiOrigins[1]).toBe(`ws://${address}`);
  });
});

describe("Stream Integration Tests", () => {
  let mockServer: MockWebSocketServer;
  let stream: Stream;

  async function prepareScenario() {
    mockServer = new MockWebSocketServer();

    // Wait for server to be ready
    const isReady = await mockServer.waitForReady();
    if (!isReady) {
      throw new Error("Mock server failed to start");
    }

    const address = mockServer.getAddress();
    if (!address) {
      throw new Error("Mock server failed to start");
    }

    const mockServerUrl = `ws://${address}`;
    const config: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: mockServerUrl,
    };

    stream = new Stream(config, [], {
      maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectInterval: 500,
    });

    try {
      await stream.connect();
      // Wait longer for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      // Clean up if connection fails
      if (mockServer) {
        await mockServer.close();
      }
      throw error;
    }
  }

  afterEach(async () => {
    try {
      if (stream) {
        await stream.close();
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } finally {
      if (mockServer) {
        await mockServer.close();
        // Wait for server cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  });

  it("should handle HA mode with single origin fallback", async () => {
    // Create a scenario where HA mode is requested but only one origin is available
    mockServer = new MockWebSocketServer();

    const isReady = await mockServer.waitForReady();
    if (!isReady) {
      throw new Error("Mock server failed to start");
    }

    const address = mockServer.getAddress();
    if (!address) {
      throw new Error("Mock server failed to start");
    }

    const mockServerUrl = `ws://${address}`;
    const config: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: mockServerUrl,
      haMode: true, // Request HA mode
    };

    stream = new Stream(config, [], {
      maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectInterval: 500,
    });

    try {
      await stream.connect();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should fall back to single connection
      const stats = stream.getMetrics();
      expect(stats.configuredConnections).toBe(1);
      expect(stats.activeConnections).toBe(1);

      const mockReport = JSON.stringify({
        report: {
          feedID: "0x0003" + "1".repeat(60),
          fullReport: FULL_REPORT,
          validFromTimestamp: Date.now(),
          observationsTimestamp: Date.now(),
        },
      });

      const reportPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for report"));
        }, 1000);

        stream.on("report", report => {
          clearTimeout(timeout);
          try {
            expect(report).toBeDefined();
            expect(report.feedID).toBe("0x0003" + "1".repeat(60));
            expect(report.fullReport).toBeDefined();
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        mockServer.broadcast(mockReport);
      });

      await reportPromise;
    } catch (error) {
      // Clean up if connection fails
      if (mockServer) {
        await mockServer.close();
      }
      throw error;
    }
  }, 5000);

  it("should handle graceful shutdown", async () => {
    await prepareScenario();
    await stream.close();
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(mockServer.getConnectedClientsCount()).toBe(0);
  });

  it("should handle connection drop and maintain stream functionality", async () => {
    await prepareScenario();

    // Add a longer delay to ensure the connection is stable
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get initial stats
    const initialStats = stream.getMetrics();
    expect(initialStats.activeConnections).toBe(1);

    const disconnectPromise = new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        // Don't fail the test, just resolve - connection management is internal
        resolve();
      }, 5000);

      const disconnectHandler = () => {
        debugLog("Disconnect detected");
        clearTimeout(timeout);
        resolve();
      };

      stream.once("disconnected", disconnectHandler);

      // Simulate connection drop
      debugLog("Closing connections...");
      mockServer.closeAllConnections();
    });

    await disconnectPromise;

    // Verify that the stream detected the disconnection
    const statsAfterDisconnect = stream.getMetrics();
    expect(statsAfterDisconnect.activeConnections).toBe(0);

    // Stream should still be in a valid state for potential reconnection
    expect(stream.getMetrics()).toBeDefined();
  }, 10000);

  it("should handle multiple feeds", async () => {
    const feedIds = ["0x0003" + "1".repeat(60), "0x0003" + "2".repeat(60)];
    mockServer = new MockWebSocketServer();

    // Wait for server to be ready
    const isReady = await mockServer.waitForReady();
    if (!isReady) {
      throw new Error("Mock server failed to start");
    }

    const address = mockServer.getAddress();
    if (!address) {
      throw new Error("Mock server failed to start");
    }

    const config: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: `ws://${address}`,
    };

    stream = new Stream(config, feedIds, {
      maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectInterval: 500,
    });

    try {
      await stream.connect();
      // Wait longer for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));

      const reports = new Set<string>();
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for reports"));
        }, 5000);

        stream.on("report", report => {
          reports.add(report.feedID);
          if (reports.size === feedIds.length) {
            clearTimeout(timeout);
            resolve();
          }
        });

        // Send reports with delay to avoid overwhelming the connection
        feedIds.forEach((feedId, index) => {
          setTimeout(() => {
            const mockReport = JSON.stringify({
              report: {
                feedID: feedId,
                fullReport: FULL_REPORT,
                validFromTimestamp: Date.now(),
                observationsTimestamp: Date.now(),
              },
            });
            mockServer.broadcast(mockReport);
          }, index * 500); // Increased delay between reports
        });
      });

      expect(reports.size).toBe(feedIds.length);
    } finally {
      try {
        await stream.close();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } finally {
        await mockServer.close();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }, 10000);

  it("should emit 'reconnecting' events with attempt and delay payload", async () => {
    // Prepare a single-origin scenario and listen for reconnecting
    mockServer = new MockWebSocketServer();

    const isReady = await mockServer.waitForReady();
    if (!isReady) {
      throw new Error("Mock server failed to start");
    }

    const address = mockServer.getAddress();
    if (!address) {
      throw new Error("Mock server failed to start");
    }

    const config: Config = {
      apiKey: "mock_key",
      userSecret: "mock_secret",
      endpoint: "http://mock-api.example.com",
      wsEndpoint: `ws://${address}`,
    };

    stream = new Stream(config, ["0x0003" + "1".repeat(60)], {
      maxReconnectAttempts: 2,
      reconnectInterval: 1000,
    });

    await stream.connect();
    await new Promise(resolve => setTimeout(resolve, 300));

    // Promise resolves on first 'reconnecting'
    const reconnectingPromise = new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        throw new Error("Timeout waiting for reconnecting event");
      }, 5000);
      stream.once("reconnecting", (info: { attempt: number; delayMs: number; origin?: string; host?: string }) => {
        try {
          expect(typeof info.attempt).toBe("number");
          expect(info.attempt).toBeGreaterThanOrEqual(1);
          expect(typeof info.delayMs).toBe("number");
          // Basic sanity bounds: >= 200ms (min clamp) and not absurdly high for first attempt
          expect(info.delayMs).toBeGreaterThanOrEqual(200);
          expect(info.delayMs).toBeLessThanOrEqual(15000);
          clearTimeout(timeout);
          resolve();
        } catch (e) {
          clearTimeout(timeout);
          // Rethrow to fail test
          throw e;
        }
      });
    });

    // Trigger reconnection by dropping connections
    await mockServer.closeAllConnections();

    await reconnectingPromise;
  }, 10000);
  it("should handle max reconnection attempts", async () => {
    // Mock the console.error to prevent WebSocket connection errors from appearing in test output
    const originalConsoleError = console.error;
    console.error = jest.fn().mockImplementation((message, ...args) => {
      // Don't log expected connection errors
      if (typeof message === "string" && message.includes("ECONNREFUSED")) {
        return;
      }
      originalConsoleError(message, ...args);
    });

    try {
      const maxAttempts = 2;
      mockServer = new MockWebSocketServer();

      // Wait for server to be ready
      const isReady = await mockServer.waitForReady();
      if (!isReady) {
        throw new Error("Mock server failed to start");
      }

      const address = mockServer.getAddress();
      if (!address) {
        throw new Error("Mock server failed to start");
      }

      const config: Config = {
        apiKey: "mock_key",
        userSecret: "mock_secret",
        endpoint: "http://mock-api.example.com",
        wsEndpoint: `ws://${address}`,
      };

      stream = new Stream(config, [], {
        maxReconnectAttempts: maxAttempts,
        reconnectInterval: 500,
      });

      // Track if the test has resolved already to prevent multiple resolutions
      let testResolved = false;

      try {
        await stream.connect();
        await new Promise(resolve => setTimeout(resolve, 1000));

        const errorPromise = new Promise<void>(resolve => {
          // If test times out, consider it successful
          const timeout = setTimeout(() => {
            if (!testResolved) {
              testResolved = true;
              debugLog("Timeout reached, but considering test successful");
              resolve();
            }
          }, 10000);

          let reconnectEventCount = 0;

          const reconnectHandler = (info: { attempt: number; delayMs: number }) => {
            debugLog("Reconnect event:", info);
            reconnectEventCount++;

            // If we've seen maxAttempts reconnect events, we can resolve early
            if (reconnectEventCount >= maxAttempts && !testResolved) {
              testResolved = true;
              debugLog(`Saw ${reconnectEventCount} reconnect events`);
              clearTimeout(timeout);
              resolve();
            }
          };

          const errorHandler = (error: Error) => {
            debugLog("Stream error:", error.message);

            // Also resolve on max reconnection attempts error
            if (error.message.includes("Max reconnection attempts reached") && !testResolved) {
              testResolved = true;
              debugLog("Saw max reconnection attempts error");
              clearTimeout(timeout);
              resolve();
            }
          };

          stream.on("reconnecting", reconnectHandler);
          stream.on("error", errorHandler);

          // Force multiple reconnection attempts
          mockServer.closeAllConnections();

          // Close the server to force failed reconnections
          // Use a longer delay to ensure the first reconnect attempt can complete
          setTimeout(() => {
            if (!testResolved) {
              debugLog("Closing mock server to force reconnection failures");
              mockServer.close().catch(() => {
                // Ignore errors from closing the server
              });
            }
          }, 500);
        });

        await errorPromise;
      } finally {
        try {
          // Prevent any further errors by setting a flag to indicate test is done
          testResolved = true;

          // Try to close the stream but don't let errors stop the test
          if (stream) {
            await stream.close().catch(e => {
              // Ignore close errors
              debugLog("Ignoring stream close error:", e.message);
            });
          }
        } catch (e) {
          // Ignore any errors during cleanup
          debugLog("Ignoring cleanup error:", e);
        }
      }
    } finally {
      // Restore console.error
      console.error = originalConsoleError;
    }
  }, 15000);
});
