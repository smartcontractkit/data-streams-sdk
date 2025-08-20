/**
 * Unit Tests for StreamStats Class
 *
 * These tests validate the functionality of the StreamStats class by:
 * - Testing initialization with default and custom values
 * - Verifying counter increment methods (accepted, deduplicated, reconnects)
 * - Validating active connection count tracking
 * - Testing overall stats accuracy through simulated operations
 *
 * Requirements:
 * - No external dependencies or network access needed
 * - Fast execution with no special environment setup
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { StreamStats } from "../../../src/stream/stats";

describe("StreamStats Tests", () => {
  let stats: StreamStats;

  beforeEach(() => {
    stats = new StreamStats();
  });

  /**
   * Test: Default initialization
   * Verifies that stats are initialized with correct default values
   */
  it("should initialize with correct default values", () => {
    const initialStats = stats.getStats();
    expect(initialStats).toEqual({
      accepted: 0,
      deduplicated: 0,
      partialReconnects: 0,
      fullReconnects: 0,
      configuredConnections: 1, // Default is 1
      activeConnections: 0,
      totalReceived: 0,
      originStatus: {},
    });
  });

  /**
   * Test: Custom configured connections
   * Verifies that configuredConnections is set correctly when provided
   */
  it("should initialize with custom configured connections value", () => {
    const customStats = new StreamStats(5);
    const initialStats = customStats.getStats();
    expect(initialStats.configuredConnections).toBe(5);
  });

  /**
   * Test: Incrementing accepted reports counter
   * Verifies that the accepted counter increments correctly
   */
  it("should increment accepted reports counter", () => {
    // Increment accepted reports
    stats.incrementAccepted();
    stats.incrementAccepted();
    stats.incrementAccepted();

    const currentStats = stats.getStats();
    expect(currentStats.accepted).toBe(3);
  });

  /**
   * Test: Incrementing deduplicated reports counter
   * Verifies that the deduplicated counter increments correctly
   */
  it("should increment deduplicated reports counter", () => {
    // Increment deduplicated reports
    stats.incrementDeduplicated();
    stats.incrementDeduplicated();

    const currentStats = stats.getStats();
    expect(currentStats.deduplicated).toBe(2);
  });

  /**
   * Test: Incrementing partial reconnects counter
   * Verifies that the partial reconnects counter increments correctly
   */
  it("should increment partial reconnects counter", () => {
    // Increment partial reconnects
    stats.incrementPartialReconnects();

    const currentStats = stats.getStats();
    expect(currentStats.partialReconnects).toBe(1);
  });

  /**
   * Test: Incrementing full reconnects counter
   * Verifies that the full reconnects counter increments correctly
   */
  it("should increment full reconnects counter", () => {
    // Increment full reconnects
    stats.incrementFullReconnects();
    stats.incrementFullReconnects();

    const currentStats = stats.getStats();
    expect(currentStats.fullReconnects).toBe(2);
  });

  /**
   * Test: Setting active connections
   * Verifies that the active connections count is updated correctly
   */
  it("should update active connections count", () => {
    // Set active connections
    stats.setActiveConnections(3);

    const currentStats = stats.getStats();
    expect(currentStats.activeConnections).toBe(3);

    // Update active connections
    stats.setActiveConnections(1);

    const updatedStats = stats.getStats();
    expect(updatedStats.activeConnections).toBe(1);
  });

  /**
   * Test: Stats accuracy during simulated operation
   * Verifies that all stats are tracked accurately during a simulated operation
   */
  it("should accurately track all stats during operation", () => {
    // Initialize with 2 configured connections
    const operationStats = new StreamStats(2);

    // Simulate a sequence of events
    operationStats.setActiveConnections(2); // Both connections active
    operationStats.incrementAccepted(); // Received report 1
    operationStats.incrementAccepted(); // Received report 2
    operationStats.incrementDeduplicated(); // Duplicate of report 2
    operationStats.setActiveConnections(1); // One connection dropped
    operationStats.incrementPartialReconnects(); // Partial reconnect occurred
    operationStats.incrementAccepted(); // Received report 3
    operationStats.setActiveConnections(0); // All connections dropped
    operationStats.incrementFullReconnects(); // Full reconnect occurred
    operationStats.setActiveConnections(2); // Both connections restored
    operationStats.incrementAccepted(); // Received report 4
    operationStats.incrementDeduplicated(); // Duplicate of report 4

    // Verify final stats
    const finalStats = operationStats.getStats();
    expect(finalStats).toEqual({
      accepted: 4,
      deduplicated: 2,
      partialReconnects: 1,
      fullReconnects: 1,
      configuredConnections: 2,
      activeConnections: 2,
      totalReceived: 6, // 4 accepted + 2 deduplicated
      originStatus: {},
    });
  });

  /**
   * Test: Combined reporting metrics
   * Verifies that the total reports received can be calculated from accepted + deduplicated
   */
  it("should allow calculating total reports from accepted + deduplicated", () => {
    // Simulate receiving reports, some duplicated
    stats.incrementAccepted(); // Unique report 1
    stats.incrementAccepted(); // Unique report 2
    stats.incrementDeduplicated(); // Duplicate of report 1
    stats.incrementDeduplicated(); // Duplicate of report 2
    stats.incrementDeduplicated(); // Another duplicate of report 1

    // Get current stats
    const currentStats = stats.getStats();

    // Calculate total reports received (accepted + deduplicated)
    const totalReports = currentStats.accepted + currentStats.deduplicated;
    expect(totalReports).toBe(5); // 2 unique + 3 duplicates
  });
});
