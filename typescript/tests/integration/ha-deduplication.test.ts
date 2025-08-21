/**
 * Integration tests for HA deduplication functionality
 * Tests that duplicate reports are properly filtered when multiple connections receive the same data
 */

import { createClient } from "../../src/index";
import { MockWebSocketServer } from "../utils/mockWebSocketServer";

describe("HA Deduplication Integration Tests", () => {
  let mockServer: MockWebSocketServer;
  let serverAddress: string;
  const activeStreams: any[] = [];

  beforeEach(async () => {
    mockServer = new MockWebSocketServer();
    await mockServer.waitForReady();
    serverAddress = mockServer.getAddress();
  });

  afterEach(async () => {
    // Close all active streams first
    for (const stream of activeStreams) {
      try {
        await stream.close();
      } catch {
        // Ignore close errors
      }
    }
    activeStreams.length = 0; // Clear array

    // Then close mock server
    await mockServer.close();
  });

  describe("Report Deduplication", () => {
    it("should filter duplicate reports from multiple HA connections", async () => {
      // Setup HA configuration with multiple connections
      const NUM_CONNECTIONS = 3;
      const wsEndpoints = Array(NUM_CONNECTIONS)
        .fill(0)
        .map(() => `ws://${serverAddress}`)
        .join(",");

      const config = {
        apiKey: "test-key",
        userSecret: "test-secret",
        endpoint: "https://api.testnet-dataengine.chain.link",
        wsEndpoint: wsEndpoints,
        haMode: true,
      };

      const client = createClient(config);
      const stream = client.createStream(["0x00039d9e45394f473ab1f050a1b963e6b05351e52d71e507509ada0c95ed75b8"]);
      activeStreams.push(stream); // Track for cleanup

      // Wait for all connections to establish
      await stream.connect();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Validate initial connection state
      const initialMetrics = stream.getMetrics();
      expect(initialMetrics.configuredConnections).toBe(NUM_CONNECTIONS);
      expect(initialMetrics.activeConnections).toBe(NUM_CONNECTIONS);

      // Create a mock WebSocket message in the expected JSON format
      const mockReport = {
        report: {
          feedID: "0x00039d9e45394f473ab1f050a1b963e6b05351e52d71e507509ada0c95ed75b8",
          fullReport: "0x0002" + "01020304" + "42".repeat(100), // Mock hex report
          validFromTimestamp: Date.now(),
          observationsTimestamp: Date.now(),
        },
      };
      const mockReportData = Buffer.from(JSON.stringify(mockReport));

      let receivedReportCount = 0;
      const receivedReports: any[] = [];

      // Listen for reports
      stream.on("report", report => {
        receivedReportCount++;
        receivedReports.push(report);
      });

      // Send the SAME report data from ALL connections simultaneously
      // This simulates the real-world scenario where multiple origins
      // broadcast the same report
      await mockServer.broadcast(mockReportData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get final metrics
      const finalMetrics = stream.getMetrics();

      // CRITICAL ASSERTIONS
      const expectedTotalReceived = NUM_CONNECTIONS; // Each connection sends one report
      const expectedAccepted = 1; // Only one unique report should be accepted
      const expectedDeduplicated = NUM_CONNECTIONS - expectedAccepted; // Rest should be deduplicated

      expect(finalMetrics.totalReceived).toBe(expectedTotalReceived);
      expect(finalMetrics.accepted).toBe(expectedAccepted);
      expect(finalMetrics.deduplicated).toBe(expectedDeduplicated);

      // Verify only one report was emitted to the user
      expect(receivedReportCount).toBe(1);
      expect(receivedReports).toHaveLength(1);

      // Verify deduplication rate calculation
      const deduplicationRate = (finalMetrics.deduplicated / finalMetrics.totalReceived) * 100;
      expect(deduplicationRate).toBeCloseTo((expectedDeduplicated / expectedTotalReceived) * 100, 1);

      await stream.close();
    }, 10000);

    it("should handle different reports from different connections", async () => {
      const NUM_CONNECTIONS = 2;
      const wsEndpoints = Array(NUM_CONNECTIONS)
        .fill(0)
        .map(() => `ws://${serverAddress}`)
        .join(",");

      const config = {
        apiKey: "test-key",
        userSecret: "test-secret",
        endpoint: "https://api.testnet-dataengine.chain.link",
        wsEndpoint: wsEndpoints,
        haMode: true,
      };

      const client = createClient(config);
      const stream = client.createStream(["0x00039d9e45394f473ab1f050a1b963e6b05351e52d71e507509ada0c95ed75b8"]);
      activeStreams.push(stream); // Track for cleanup

      await stream.connect();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create two DIFFERENT mock reports
      const mockReport1 = {
        report: {
          feedID: "0x00039d9e45394f473ab1f050a1b963e6b05351e52d71e507509ada0c95ed75b8",
          fullReport: "0x0002" + "01010101" + "42".repeat(100),
          validFromTimestamp: Date.now() - 1000,
          observationsTimestamp: Date.now() - 1000,
        },
      };
      const mockReportData1 = Buffer.from(JSON.stringify(mockReport1));

      const mockReport2 = {
        report: {
          feedID: "0x00039d9e45394f473ab1f050a1b963e6b05351e52d71e507509ada0c95ed75b8",
          fullReport: "0x0002" + "02020202" + "43".repeat(100),
          validFromTimestamp: Date.now(),
          observationsTimestamp: Date.now(),
        },
      };
      const mockReportData2 = Buffer.from(JSON.stringify(mockReport2));

      let receivedReportCount = 0;

      stream.on("report", () => {
        receivedReportCount++;
      });

      // Send different reports - should NOT be deduplicated
      await mockServer.broadcast(mockReportData1);
      await new Promise(resolve => setTimeout(resolve, 100));
      await mockServer.broadcast(mockReportData2);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalMetrics = stream.getMetrics();

      // Both reports should be accepted (no deduplication for different reports)
      // In HA mode with 2 connections, each broadcast sends to both connections
      const expectedTotalReceived = NUM_CONNECTIONS * 2; // 2 different reports × 2 connections
      expect(finalMetrics.totalReceived).toBe(expectedTotalReceived);
      expect(finalMetrics.accepted).toBe(2); // 2 unique reports
      expect(finalMetrics.deduplicated).toBe(expectedTotalReceived - 2); // Rest are duplicates
      expect(receivedReportCount).toBe(2); // User receives 2 unique reports

      await stream.close();
    }, 10000);

    it("should maintain deduplication across reconnections", async () => {
      const NUM_CONNECTIONS = 2;
      const wsEndpoints = Array(NUM_CONNECTIONS)
        .fill(0)
        .map(() => `ws://${serverAddress}`)
        .join(",");

      const config = {
        apiKey: "test-key",
        userSecret: "test-secret",
        endpoint: "https://api.testnet-dataengine.chain.link",
        wsEndpoint: wsEndpoints,
        haMode: true,
      };

      const client = createClient(config);
      const stream = client.createStream(["0x00039d9e45394f473ab1f050a1b963e6b05351e52d71e507509ada0c95ed75b8"]);
      activeStreams.push(stream); // Track for cleanup

      await stream.connect();
      await new Promise(resolve => setTimeout(resolve, 500));

      const mockReport = {
        report: {
          feedID: "0x00039d9e45394f473ab1f050a1b963e6b05351e52d71e507509ada0c95ed75b8",
          fullReport: "0x0002" + "01020304" + "42".repeat(100),
          validFromTimestamp: Date.now(),
          observationsTimestamp: Date.now(),
        },
      };
      const mockReportData = Buffer.from(JSON.stringify(mockReport));

      let receivedReportCount = 0;

      stream.on("report", () => {
        receivedReportCount++;
      });

      // Send report from all connections initially
      await mockServer.broadcast(mockReportData);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Simulate reconnection by disconnecting and reconnecting a client
      await mockServer.closeAllConnections();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for reconnection

      // Send the same report again after reconnection
      await mockServer.broadcast(mockReportData);
      await new Promise(resolve => setTimeout(resolve, 500));

      const finalMetrics = stream.getMetrics();

      // Deduplication persists across connection changes
      expect(finalMetrics.accepted).toBe(1); // Only one unique report accepted
      expect(finalMetrics.deduplicated).toBeGreaterThan(0); // Some reports were deduplicated
      expect(receivedReportCount).toBe(1); // Only one report emitted to user

      await stream.close();
    }, 15000);
  });

  describe("Deduplication Performance", () => {
    it("should handle high-frequency duplicate reports efficiently", async () => {
      const NUM_CONNECTIONS = 3;
      const REPORTS_PER_CONNECTION = 10;

      const wsEndpoints = Array(NUM_CONNECTIONS)
        .fill(0)
        .map(() => `ws://${serverAddress}`)
        .join(",");

      const config = {
        apiKey: "test-key",
        userSecret: "test-secret",
        endpoint: "https://api.testnet-dataengine.chain.link",
        wsEndpoint: wsEndpoints,
        haMode: true,
      };

      const client = createClient(config);
      const stream = client.createStream(["0x00039d9e45394f473ab1f050a1b963e6b05351e52d71e507509ada0c95ed75b8"]);
      activeStreams.push(stream); // Track for cleanup

      await stream.connect();
      await new Promise(resolve => setTimeout(resolve, 500));

      const mockReport = {
        report: {
          feedID: "0x00039d9e45394f473ab1f050a1b963e6b05351e52d71e507509ada0c95ed75b8",
          fullReport: "0x0002" + "01020304" + "42".repeat(100),
          validFromTimestamp: Date.now(),
          observationsTimestamp: Date.now(),
        },
      };
      const mockReportData = Buffer.from(JSON.stringify(mockReport));

      let receivedReportCount = 0;

      stream.on("report", () => {
        receivedReportCount++;
      });

      const startTime = Date.now();

      // Send the same report multiple times from each connection
      for (let i = 0; i < REPORTS_PER_CONNECTION; i++) {
        await mockServer.broadcast(mockReportData);
        // Small delay between sends to simulate real-world timing
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      const finalMetrics = stream.getMetrics();

      // Performance assertions
      expect(processingTime).toBeLessThan(5000); // Should process quickly
      expect(finalMetrics.totalReceived).toBe(NUM_CONNECTIONS * REPORTS_PER_CONNECTION);
      expect(finalMetrics.accepted).toBe(1); // Only one unique report
      expect(finalMetrics.deduplicated).toBe(NUM_CONNECTIONS * REPORTS_PER_CONNECTION - 1);
      expect(receivedReportCount).toBe(1);

      // Deduplication efficiency should be very high
      const deduplicationRate = (finalMetrics.deduplicated / finalMetrics.totalReceived) * 100;
      expect(deduplicationRate).toBeGreaterThan(90); // >90% efficiency

      await stream.close();
    }, 15000);
  });
});
