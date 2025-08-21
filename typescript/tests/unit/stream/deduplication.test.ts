import { ReportDeduplicator, ReportMetadata } from "../../../src/stream/deduplication";

describe("ReportDeduplicator", () => {
  let deduplicator: ReportDeduplicator;

  beforeEach(() => {
    deduplicator = new ReportDeduplicator();
  });

  afterEach(() => {
    deduplicator.stop();
  });

  describe("basic deduplication", () => {
    it("should allow first report for a feed", () => {
      const report: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 1000,
        fullReport: "report-data",
        validFromTimestamp: 900,
      };

      const result = deduplicator.processReport(report);
      expect(result.isAccepted).toBe(true);
      expect(result.isDuplicate).toBe(false);
    });

    it("should reject duplicate reports with same timestamp", () => {
      const report: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 1000,
        fullReport: "report-data",
        validFromTimestamp: 900,
      };

      // First report should be accepted
      const result1 = deduplicator.processReport(report);
      expect(result1.isAccepted).toBe(true);
      expect(result1.isDuplicate).toBe(false);

      // Duplicate should be rejected
      const result2 = deduplicator.processReport(report);
      expect(result2.isAccepted).toBe(false);
      expect(result2.isDuplicate).toBe(true);
      expect(result2.reason).toContain("watermark");
    });

    it("should reject reports with older timestamps", () => {
      const newerReport: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 2000,
        fullReport: "newer-report",
        validFromTimestamp: 1900,
      };

      const olderReport: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 1000,
        fullReport: "older-report",
        validFromTimestamp: 900,
      };

      // Accept newer report first
      const result1 = deduplicator.processReport(newerReport);
      expect(result1.isAccepted).toBe(true);

      // Reject older report
      const result2 = deduplicator.processReport(olderReport);
      expect(result2.isAccepted).toBe(false);
      expect(result2.isDuplicate).toBe(true);
    });

    it("should accept reports with newer timestamps", () => {
      const olderReport: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 1000,
        fullReport: "older-report",
        validFromTimestamp: 900,
      };

      const newerReport: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 2000,
        fullReport: "newer-report",
        validFromTimestamp: 1900,
      };

      // Accept older report first
      const result1 = deduplicator.processReport(olderReport);
      expect(result1.isAccepted).toBe(true);

      // Accept newer report
      const result2 = deduplicator.processReport(newerReport);
      expect(result2.isAccepted).toBe(true);
      expect(result2.isDuplicate).toBe(false);
    });
  });

  describe("multi-feed handling", () => {
    it("should handle multiple feeds independently", () => {
      const report1: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 1000,
        fullReport: "report1",
        validFromTimestamp: 900,
      };

      const report2: ReportMetadata = {
        feedID: "0x456",
        observationsTimestamp: 1000, // Same timestamp, different feed
        fullReport: "report2",
        validFromTimestamp: 900,
      };

      // Both should be accepted since they're for different feeds
      const result1 = deduplicator.processReport(report1);
      expect(result1.isAccepted).toBe(true);

      const result2 = deduplicator.processReport(report2);
      expect(result2.isAccepted).toBe(true);

      // Duplicates should be rejected
      const result3 = deduplicator.processReport(report1);
      expect(result3.isAccepted).toBe(false);

      const result4 = deduplicator.processReport(report2);
      expect(result4.isAccepted).toBe(false);
    });

    it("should track watermarks per feed independently", () => {
      const feed1Report1: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 1000,
        fullReport: "report1",
        validFromTimestamp: 900,
      };

      const feed2Report1: ReportMetadata = {
        feedID: "0x456",
        observationsTimestamp: 2000,
        fullReport: "report2",
        validFromTimestamp: 1900,
      };

      const feed1Report2: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 1500,
        fullReport: "report3",
        validFromTimestamp: 1400,
      };

      // Accept initial reports
      deduplicator.processReport(feed1Report1);
      deduplicator.processReport(feed2Report1);

      // Accept newer report for feed1
      const result = deduplicator.processReport(feed1Report2);
      expect(result.isAccepted).toBe(true);

      // Verify watermarks are independent
      expect(deduplicator.getWatermark("0x123")).toBe(1500);
      expect(deduplicator.getWatermark("0x456")).toBe(2000);
    });
  });

  describe("watermark management", () => {
    it("should return undefined for unknown feeds", () => {
      expect(deduplicator.getWatermark("unknown-feed")).toBeUndefined();
    });

    it("should update watermarks correctly", () => {
      const report: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 1500,
        fullReport: "report",
        validFromTimestamp: 1400,
      };

      expect(deduplicator.getWatermark("0x123")).toBeUndefined();

      deduplicator.processReport(report);

      expect(deduplicator.getWatermark("0x123")).toBe(1500);
    });

    it("should not update watermark for rejected reports", () => {
      const report1: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 2000,
        fullReport: "report1",
        validFromTimestamp: 1900,
      };

      const report2: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 1000, // Older
        fullReport: "report2",
        validFromTimestamp: 900,
      };

      // Accept newer report
      deduplicator.processReport(report1);
      expect(deduplicator.getWatermark("0x123")).toBe(2000);

      // Reject older report
      const result = deduplicator.processReport(report2);
      expect(result.isAccepted).toBe(false);
      expect(deduplicator.getWatermark("0x123")).toBe(2000); // Should remain unchanged
    });

    it("should allow manual watermark setting", () => {
      deduplicator.setWatermark("0x123", 5000);
      expect(deduplicator.getWatermark("0x123")).toBe(5000);

      const report: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 3000, // Lower than manual watermark
        fullReport: "report",
        validFromTimestamp: 2900,
      };

      const result = deduplicator.processReport(report);
      expect(result.isAccepted).toBe(false);
    });

    it("should clear specific watermarks", () => {
      deduplicator.setWatermark("0x123", 1000);
      deduplicator.setWatermark("0x456", 2000);

      expect(deduplicator.getWatermark("0x123")).toBe(1000);
      expect(deduplicator.getWatermark("0x456")).toBe(2000);

      const cleared = deduplicator.clearWatermark("0x123");
      expect(cleared).toBe(true);
      expect(deduplicator.getWatermark("0x123")).toBeUndefined();
      expect(deduplicator.getWatermark("0x456")).toBe(2000);

      const alreadyCleared = deduplicator.clearWatermark("0x123");
      expect(alreadyCleared).toBe(false);
    });

    it("should clear all watermarks", () => {
      deduplicator.setWatermark("0x123", 1000);
      deduplicator.setWatermark("0x456", 2000);

      deduplicator.clearAllWatermarks();

      expect(deduplicator.getWatermark("0x123")).toBeUndefined();
      expect(deduplicator.getWatermark("0x456")).toBeUndefined();
    });
  });

  describe("statistics tracking", () => {
    it("should track statistics correctly", () => {
      const report1: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 1000,
        fullReport: "report1",
        validFromTimestamp: 900,
      };

      const report2: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 1000, // Duplicate
        fullReport: "report2",
        validFromTimestamp: 900,
      };

      const report3: ReportMetadata = {
        feedID: "0x456",
        observationsTimestamp: 2000,
        fullReport: "report3",
        validFromTimestamp: 1900,
      };

      // Process reports
      deduplicator.processReport(report1); // Accepted
      deduplicator.processReport(report2); // Deduplicated
      deduplicator.processReport(report3); // Accepted

      const stats = deduplicator.getStats();
      expect(stats.accepted).toBe(2);
      expect(stats.deduplicated).toBe(1);
      expect(stats.totalReceived).toBe(3);
      expect(stats.watermarkCount).toBe(2);
    });

    it("should reset statistics", () => {
      const report: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 1000,
        fullReport: "report",
        validFromTimestamp: 900,
      };

      deduplicator.processReport(report);
      deduplicator.processReport(report); // Duplicate

      let stats = deduplicator.getStats();
      expect(stats.accepted).toBe(1);
      expect(stats.deduplicated).toBe(1);

      deduplicator.reset();

      stats = deduplicator.getStats();
      expect(stats.accepted).toBe(0);
      expect(stats.deduplicated).toBe(0);
      expect(stats.totalReceived).toBe(0);
      expect(stats.watermarkCount).toBe(0);
    });
  });

  describe("memory management", () => {
    it("should handle large numbers of feeds efficiently", () => {
      const feedCount = 1000; // Reduced for test performance
      const feeds: string[] = [];

      // Generate many unique feed IDs
      for (let i = 0; i < feedCount; i++) {
        feeds.push(`0x${i.toString(16).padStart(64, "0")}`);
      }

      // Add reports for all feeds
      feeds.forEach((feedID, index) => {
        const report: ReportMetadata = {
          feedID,
          observationsTimestamp: index + 1000,
          fullReport: `report-${index}`,
          validFromTimestamp: index + 900,
        };

        const result = deduplicator.processReport(report);
        expect(result.isAccepted).toBe(true);
      });

      // Verify all watermarks are set correctly
      feeds.forEach((feedID, index) => {
        expect(deduplicator.getWatermark(feedID)).toBe(index + 1000);
      });

      const stats = deduplicator.getStats();
      expect(stats.watermarkCount).toBe(feedCount);
    });

    it("should provide memory usage information", () => {
      const report: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 1000,
        fullReport: "report",
        validFromTimestamp: 900,
      };

      deduplicator.processReport(report);

      const memoryInfo = deduplicator.getMemoryInfo();
      expect(memoryInfo.watermarkCount).toBe(1);
      expect(memoryInfo.estimatedMemoryBytes).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should handle zero timestamp", () => {
      const report: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: 0,
        fullReport: "report",
        validFromTimestamp: 0,
      };

      const result = deduplicator.processReport(report);
      expect(result.isAccepted).toBe(true);
      expect(deduplicator.getWatermark("0x123")).toBe(0);

      // Should reject duplicate with same zero timestamp
      const result2 = deduplicator.processReport(report);
      expect(result2.isAccepted).toBe(false);
    });

    it("should handle very large timestamps", () => {
      const largeTimestamp = Number.MAX_SAFE_INTEGER;
      const report: ReportMetadata = {
        feedID: "0x123",
        observationsTimestamp: largeTimestamp,
        fullReport: "report",
        validFromTimestamp: largeTimestamp - 1,
      };

      const result = deduplicator.processReport(report);
      expect(result.isAccepted).toBe(true);
      expect(deduplicator.getWatermark("0x123")).toBe(largeTimestamp);
    });

    it("should handle empty feed ID", () => {
      const report: ReportMetadata = {
        feedID: "",
        observationsTimestamp: 1000,
        fullReport: "report",
        validFromTimestamp: 900,
      };

      const result = deduplicator.processReport(report);
      expect(result.isAccepted).toBe(true);
      expect(deduplicator.getWatermark("")).toBe(1000);
    });

    it("should handle special characters in feed ID", () => {
      const specialFeedId = "0x!@#$%^&*()_+-=[]{}|;:,.<>?";
      const report: ReportMetadata = {
        feedID: specialFeedId,
        observationsTimestamp: 1000,
        fullReport: "report",
        validFromTimestamp: 900,
      };

      const result = deduplicator.processReport(report);
      expect(result.isAccepted).toBe(true);
      expect(deduplicator.getWatermark(specialFeedId)).toBe(1000);
    });
  });

  describe("export/import functionality", () => {
    it("should export watermarks correctly", () => {
      const reports = [
        {
          feedID: "0x123",
          observationsTimestamp: 1000,
          fullReport: "report1",
          validFromTimestamp: 900,
        },
        {
          feedID: "0x456",
          observationsTimestamp: 2000,
          fullReport: "report2",
          validFromTimestamp: 1900,
        },
      ];

      reports.forEach(report => {
        deduplicator.processReport(report as ReportMetadata);
      });

      const exported = deduplicator.exportWatermarks();
      expect(exported).toHaveLength(2);
      expect(exported).toContainEqual({ feedId: "0x123", timestamp: 1000 });
      expect(exported).toContainEqual({ feedId: "0x456", timestamp: 2000 });
    });

    it("should import watermarks correctly", () => {
      const watermarks = [
        { feedId: "0x123", timestamp: 1500 },
        { feedId: "0x456", timestamp: 2500 },
        { feedId: "0x789", timestamp: 3500 },
      ];

      deduplicator.importWatermarks(watermarks);

      expect(deduplicator.getWatermark("0x123")).toBe(1500);
      expect(deduplicator.getWatermark("0x456")).toBe(2500);
      expect(deduplicator.getWatermark("0x789")).toBe(3500);

      const stats = deduplicator.getStats();
      expect(stats.watermarkCount).toBe(3);
    });

    it("should handle empty export", () => {
      const exported = deduplicator.exportWatermarks();
      expect(exported).toEqual([]);
    });

    it("should handle empty import", () => {
      deduplicator.importWatermarks([]);
      const stats = deduplicator.getStats();
      expect(stats.watermarkCount).toBe(0);
    });

    it("should overwrite existing watermarks on import", () => {
      // Set initial watermark
      deduplicator.setWatermark("0x123", 1000);
      expect(deduplicator.getWatermark("0x123")).toBe(1000);

      // Import should overwrite
      deduplicator.importWatermarks([{ feedId: "0x123", timestamp: 2000 }]);
      expect(deduplicator.getWatermark("0x123")).toBe(2000);
    });
  });

  describe("watermark access", () => {
    it("should get all watermarks", () => {
      deduplicator.setWatermark("0x123", 1000);
      deduplicator.setWatermark("0x456", 2000);

      const allWatermarks = deduplicator.getAllWatermarks();
      expect(allWatermarks).toEqual({
        "0x123": 1000,
        "0x456": 2000,
      });
    });

    it("should return empty object when no watermarks exist", () => {
      const allWatermarks = deduplicator.getAllWatermarks();
      expect(allWatermarks).toEqual({});
    });
  });

  describe("cleanup functionality", () => {
    it("should initialize with cleanup enabled", () => {
      const dedup = new ReportDeduplicator({
        maxWatermarkAge: 1000,
        cleanupIntervalMs: 500,
      });

      expect(dedup).toBeDefined();
      dedup.stop();
    });

    it("should stop cleanup properly", () => {
      const dedup = new ReportDeduplicator();
      dedup.stop();

      // Should not throw when stopped multiple times
      dedup.stop();
    });
  });
});
