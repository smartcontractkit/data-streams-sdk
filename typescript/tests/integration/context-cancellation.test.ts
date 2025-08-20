/**
 * Integration Tests for Context Cancellation
 *
 * Tests proper handling of cancelled operations for both REST and streaming APIs.
 * Validates graceful shutdown and resource cleanup when operations are aborted.
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createClient, DataStreamsClient } from "../../src";
import type { IStream } from "../../src/types/client";
import { MockWebSocketServer } from "../utils/mockWebSocketServer";

describe("Context Cancellation Integration Tests", () => {
  let mockServer: MockWebSocketServer;
  let client: DataStreamsClient;
  let stream: IStream | null = null;

  beforeEach(async () => {
    mockServer = new MockWebSocketServer();
    await mockServer.waitForReady();
    const serverAddress = mockServer.getAddress();

    client = createClient({
      apiKey: "test-api-key",
      userSecret: "test-user-secret",
      endpoint: `http://${serverAddress}`,
      wsEndpoint: `ws://${serverAddress}`,
      logging: {
        logger: {
          info: () => {},
          error: () => {},
          debug: () => {},
          warn: () => {},
        },
      },
    });
  });

  afterEach(async () => {
    if (stream) {
      await stream.close();
      stream = null;
    }
    await mockServer.close();
  });

  describe("Stream connection cancellation", () => {
    it("should handle cancellation during connection establishment", async () => {
      // Create stream but don't await connection
      stream = client.createStream(["0x0003" + "1".repeat(60)]);

      // Start connection process
      const connectionPromise = stream.connect();

      // Cancel immediately - this simulates context cancellation during connection
      await stream.close();

      // Connection should be aborted cleanly
      await expect(connectionPromise).rejects.toThrow();

      // Stream should be in closed state
      const metrics = stream.getMetrics();
      expect(metrics.activeConnections).toBe(0);
    }, 10000);

    it("should handle cancellation after partial connection establishment", async () => {
      stream = client.createStream(["0x0003" + "1".repeat(60)]);

      // Let connection start
      await stream.connect();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify connection was established
      const initialMetrics = stream.getMetrics();
      expect(initialMetrics.activeConnections).toBeGreaterThan(0);

      // Cancel the connection
      await stream.close();

      // Verify clean shutdown
      const finalMetrics = stream.getMetrics();
      expect(finalMetrics.activeConnections).toBe(0);
    }, 10000);
  });

  describe("Stream operation cancellation", () => {
    it("should stop receiving reports after stream closure", async () => {
      stream = client.createStream(["0x0003" + "1".repeat(60)]);

      let reportCount = 0;
      stream.on("report", () => {
        reportCount++;
      });

      await stream.connect();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send some test reports
      const mockReport = {
        report: {
          feedID: "0x0003" + "1".repeat(60),
          fullReport: "0x0002" + "01020304" + "42".repeat(100),
          validFromTimestamp: Date.now(),
          observationsTimestamp: Date.now(),
        },
      };

      await mockServer.broadcast(Buffer.from(JSON.stringify(mockReport)));
      await new Promise(resolve => setTimeout(resolve, 200));

      const reportsBeforeClose = reportCount;
      expect(reportsBeforeClose).toBeGreaterThan(0);

      // Close the stream
      await stream.close();

      // Send more reports - these should not be received
      await mockServer.broadcast(Buffer.from(JSON.stringify(mockReport)));
      await new Promise(resolve => setTimeout(resolve, 200));

      // Report count should not increase after closure
      expect(reportCount).toBe(reportsBeforeClose);
    }, 15000);

    it("should handle rapid connect/disconnect cycles gracefully", async () => {
      stream = client.createStream(["0x0003" + "1".repeat(60)]);

      // Rapid connect/disconnect cycle
      for (let i = 0; i < 3; i++) {
        await stream.connect();
        await new Promise(resolve => setTimeout(resolve, 50));
        await stream.close();
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Final state should be disconnected
      const metrics = stream.getMetrics();
      expect(metrics.activeConnections).toBe(0);
    }, 15000);
  });

  describe("Error handling during cancellation", () => {
    it("should handle cancellation when server is unavailable", async () => {
      // Close the mock server to simulate unavailable server
      await mockServer.close();

      stream = client.createStream(["0x0003" + "1".repeat(60)]);

      // Try to connect to unavailable server
      const connectionPromise = stream.connect();

      // Cancel during failed connection attempt
      setTimeout(() => stream?.close(), 100);

      // Should handle cancellation gracefully even with connection failure
      await expect(connectionPromise).rejects.toThrow();

      const metrics = stream.getMetrics();
      expect(metrics.activeConnections).toBe(0);
    }, 10000);

    it("should not leak resources after cancellation", async () => {
      const streams: IStream[] = [];

      // Create multiple streams and cancel them
      for (let i = 0; i < 5; i++) {
        const testStream = client.createStream(["0x0003" + i.toString().repeat(60)]);
        streams.push(testStream);

        // Start connection
        const connectPromise = testStream.connect();

        // Cancel after short delay
        setTimeout(() => testStream.close(), 50 + i * 10);

        try {
          await connectPromise;
        } catch {
          // Expected to fail due to cancellation
        }
      }

      // Wait for all operations to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // All streams should be properly closed
      for (const testStream of streams) {
        const metrics = testStream.getMetrics();
        expect(metrics.activeConnections).toBe(0);
      }
    }, 15000);
  });

  describe("Event cleanup on cancellation", () => {
    it("should stop emitting events after cancellation", async () => {
      stream = client.createStream(["0x0003" + "1".repeat(60)]);

      let eventCount = 0;
      const events: string[] = [];

      stream.on("report", () => {
        eventCount++;
        events.push("report");
      });

      stream.on("error", () => {
        eventCount++;
        events.push("error");
      });

      stream.on("disconnected", () => {
        eventCount++;
        events.push("disconnected");
      });

      await stream.connect();
      await new Promise(resolve => setTimeout(resolve, 100));

      const eventsBeforeClose = eventCount;

      // Close the stream
      await stream.close();

      // Trigger potential events by closing server
      await mockServer.close();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Event count should not increase significantly after closure
      // (disconnected event might be emitted once)
      expect(eventCount - eventsBeforeClose).toBeLessThanOrEqual(1);
    }, 10000);
  });
});
