/**
 * Unit Tests for Report Validation and Decoding
 *
 * These tests validate the report functionality by:
 * - Testing report structure validation for all versions (V2, V3, V4, V5, V6, V7, V8, V9, V10)
 * - Testing report version handling and extraction
 * - Testing malformed report rejection with clear error messages
 * - Testing report timestamp validation
 * - Testing report data integrity checks
 * - Testing report metadata extraction
 * - Testing ABI decoding edge cases
 * - Testing market status validation (V4, V8)
 * - Testing ripcord validation (V9)
 * - Testing large number handling (int192, uint192, uint64)
 *
 * Goals:
 * - Ensure robust report validation that prevents invalid data
 * - Test all edge cases and error scenarios comprehensively
 * - Support all report versions (V2, V3, V4, V5, V6, V7, V8, V9, V10)
 * - Provide clear, helpful error messages for developers
 * - Build the best possible TypeScript report validation
 */

import { describe, it, expect } from "@jest/globals";
import { decodeReport } from "../../../../src/decoder";
import { ReportDecodingError } from "../../../../src/types/errors";
import { MarketStatus } from "../../../../src/types";
import { AbiCoder } from "ethers";

describe("Report Validation Tests", () => {
  // Valid feed IDs for different versions
  const FEED_IDS = {
    V2: "0x00026b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V3: "0x00036b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V4: "0x00046b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V5: "0x00056b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V6: "0x00066b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V7: "0x00076b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V8: "0x00086b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V9: "0x00096b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V10: "0x000a6b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
  };

  // Helper function to create a valid full report structure
  function createFullReport(reportBlob: string): string {
    const abiCoder = new AbiCoder();

    // Create mock report context (3 x bytes32)
    const reportContext = [
      "0x0001020304050607080910111213141516171819202122232425262728293031",
      "0x3132333435363738394041424344454647484950515253545556575859606162",
      "0x6364656667686970717273747576777879808182838485868788899091929394",
    ];

    // Create mock signature data
    const rawRs = [
      "0x1111111111111111111111111111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222222222222222222222222222",
    ];
    const rawSs = [
      "0x3333333333333333333333333333333333333333333333333333333333333333",
      "0x4444444444444444444444444444444444444444444444444444444444444444",
    ];
    const rawVs = "0x5555555555555555555555555555555555555555555555555555555555555555";

    return abiCoder.encode(
      ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
      [reportContext, reportBlob, rawRs, rawSs, rawVs]
    );
  }

  // Helper function to create a valid V2 report blob
  function createV2ReportBlob(): string {
    const abiCoder = new AbiCoder();
    return abiCoder.encode(
      ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192"],
      [
        FEED_IDS.V2, // feedId
        1640995200, // validFromTimestamp
        1640995300, // observationsTimestamp
        "1000000000000000000", // nativeFee (1 ETH in wei)
        "500000000000000000", // linkFee (0.5 LINK)
        1640995400, // expiresAt
        "2000000000000000000000", // price (2000 USD with 18 decimals)
      ]
    );
  }

  // Helper function to create a valid V3 report blob
  function createV3ReportBlob(): string {
    const abiCoder = new AbiCoder();
    return abiCoder.encode(
      ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "int192", "int192"],
      [
        FEED_IDS.V3, // feedId
        1640995200, // validFromTimestamp
        1640995300, // observationsTimestamp
        "1000000000000000000", // nativeFee
        "500000000000000000", // linkFee
        1640995400, // expiresAt
        "2000000000000000000000", // price (benchmark)
        "1995000000000000000000", // bid
        "2005000000000000000000", // ask
      ]
    );
  }

  // Helper function to create a valid V4 report blob
  function createV4ReportBlob(): string {
    const abiCoder = new AbiCoder();
    return abiCoder.encode(
      ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint8"],
      [
        FEED_IDS.V4, // feedId
        1640995200, // validFromTimestamp
        1640995300, // observationsTimestamp
        "1000000000000000000", // nativeFee
        "500000000000000000", // linkFee
        1640995400, // expiresAt
        "2000000000000000000000", // price
        MarketStatus.ACTIVE, // marketStatus
      ]
    );
  }

  // Helper function to create a valid V8 report blob
  function createV8ReportBlob(): string {
    const abiCoder = new AbiCoder();
    return abiCoder.encode(
      ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "uint64", "int192", "uint32"],
      [
        FEED_IDS.V8, // feedId
        1640995200, // validFromTimestamp
        1640995300, // observationsTimestamp
        "1000000000000000000", // nativeFee
        "500000000000000000", // linkFee
        1640995400, // expiresAt
        1640995250, // lastUpdateTimestamp
        "2500000000000000000000", // midPrice (2500 USD with 18 decimals)
        MarketStatus.ACTIVE, // marketStatus
      ]
    );
  }

  // Helper function to create a valid V9 report blob
  function createV9ReportBlob(): string {
    const abiCoder = new AbiCoder();
    return abiCoder.encode(
      ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint64", "int192", "uint32"],
      [
        FEED_IDS.V9, // feedId
        1640995200, // validFromTimestamp
        1640995300, // observationsTimestamp
        "1000000000000000000", // nativeFee
        "500000000000000000", // linkFee
        1640995400, // expiresAt
        "1050000000000000000", // navPerShare ($1.05 with 18 decimals)
        1640995250, // navDate
        "100000000000000000000000", // aum ($100k with 18 decimals)
        0, // ripcord (normal)
      ]
    );
  }

  // Helper function to create a valid V5 report blob
  function createV5ReportBlob(): string {
    const abiCoder = new AbiCoder();
    return abiCoder.encode(
      ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint32", "uint32"],
      [
        FEED_IDS.V5,
        1640995200,
        1640995300,
        "1000000000000000000",
        "500000000000000000",
        1640995400,
        "1234567890000000000",
        1640995250,
        3600,
      ]
    );
  }

  // Helper function to create a valid V6 report blob
  function createV6ReportBlob(): string {
    const abiCoder = new AbiCoder();
    return abiCoder.encode(
      ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "int192", "int192", "int192", "int192"],
      [
        FEED_IDS.V6,
        1640995200,
        1640995300,
        "1000000000000000000",
        "500000000000000000",
        1640995400,
        "2000000000000000000000",
        "2100000000000000000000",
        "2200000000000000000000",
        "2300000000000000000000",
        "2400000000000000000000",
      ]
    );
  }

  // Helper function to create a valid V7 report blob
  function createV7ReportBlob(): string {
    const abiCoder = new AbiCoder();
    return abiCoder.encode(
      ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192"],
      [
        FEED_IDS.V7,
        1640995200,
        1640995300,
        "1000000000000000000",
        "500000000000000000",
        1640995400,
        "987654321000000000",
      ]
    );
  }

  // Helper function to create a valid V10 report blob
  function createV10ReportBlob(): string {
    const abiCoder = new AbiCoder();
    return abiCoder.encode(
      [
        "bytes32",
        "uint32",
        "uint32",
        "uint192",
        "uint192",
        "uint32",
        "uint64",
        "int192",
        "uint32",
        "int192",
        "int192",
        "uint32",
        "int192",
      ],
      [
        FEED_IDS.V10,
        1640995200,
        1640995300,
        "1000000000000000000",
        "500000000000000000",
        1640995400,
        1640995250,
        "75000000000000000000",
        MarketStatus.ACTIVE,
        "1000000000000000000",
        "1100000000000000000",
        1641081600,
        "150000000000000000000",
      ]
    );
  }

  describe("valid report decoding", () => {
    it("should decode valid V2 report", () => {
      const reportBlob = createV2ReportBlob();
      const fullReport = createFullReport(reportBlob);

      const decoded = decodeReport(fullReport, FEED_IDS.V2);

      expect(decoded.version).toBe("V2");
      expect(decoded.nativeFee).toBe(1000000000000000000n);
      expect(decoded.linkFee).toBe(500000000000000000n);
      expect(decoded.expiresAt).toBe(1640995400);
      expect((decoded as any).price).toBe(2000000000000000000000n);
    });

    it("should decode valid V3 report", () => {
      const reportBlob = createV3ReportBlob();
      const fullReport = createFullReport(reportBlob);

      const decoded = decodeReport(fullReport, FEED_IDS.V3);

      expect(decoded.version).toBe("V3");
      expect(decoded.nativeFee).toBe(1000000000000000000n);
      expect(decoded.linkFee).toBe(500000000000000000n);
      expect(decoded.expiresAt).toBe(1640995400);
      expect((decoded as any).price).toBe(2000000000000000000000n);
      expect((decoded as any).bid).toBe(1995000000000000000000n);
      expect((decoded as any).ask).toBe(2005000000000000000000n);
    });

    it("should decode valid V4 report", () => {
      const reportBlob = createV4ReportBlob();
      const fullReport = createFullReport(reportBlob);

      const decoded = decodeReport(fullReport, FEED_IDS.V4);

      expect(decoded.version).toBe("V4");
      expect(decoded.nativeFee).toBe(1000000000000000000n);
      expect(decoded.linkFee).toBe(500000000000000000n);
      expect(decoded.expiresAt).toBe(1640995400);
      expect((decoded as any).price).toBe(2000000000000000000000n);
      expect((decoded as any).marketStatus).toBe(MarketStatus.ACTIVE);
    });

    it("should decode valid V8 report", () => {
      const reportBlob = createV8ReportBlob();
      const fullReport = createFullReport(reportBlob);

      const decoded = decodeReport(fullReport, FEED_IDS.V8);

      expect(decoded.version).toBe("V8");
      expect(decoded.nativeFee).toBe(1000000000000000000n);
      expect(decoded.linkFee).toBe(500000000000000000n);
      expect(decoded.expiresAt).toBe(1640995400);
      expect((decoded as any).midPrice).toBe(2500000000000000000000n);
      expect((decoded as any).lastUpdateTimestamp).toBe(1640995250);
      expect((decoded as any).marketStatus).toBe(MarketStatus.ACTIVE);
    });

    it("should decode valid V9 report", () => {
      const reportBlob = createV9ReportBlob();
      const fullReport = createFullReport(reportBlob);

      const decoded = decodeReport(fullReport, FEED_IDS.V9);

      expect(decoded.version).toBe("V9");
      expect(decoded.nativeFee).toBe(1000000000000000000n);
      expect(decoded.linkFee).toBe(500000000000000000n);
      expect(decoded.expiresAt).toBe(1640995400);
      expect((decoded as any).navPerShare).toBe(1050000000000000000n);
      expect((decoded as any).navDate).toBe(1640995250);
      expect((decoded as any).aum).toBe(100000000000000000000000n);
      expect((decoded as any).ripcord).toBe(0);
    });

    it("should decode valid V10 report", () => {
      const reportBlob = createV10ReportBlob();
      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V10);

      expect(decoded.version).toBe("V10");
      expect((decoded as any).price).toBe(75000000000000000000n);
      expect((decoded as any).tokenizedPrice).toBe(150000000000000000000n);
    });

    it("should handle reports without 0x prefix", () => {
      const reportBlob = createV2ReportBlob();
      const fullReport = createFullReport(reportBlob);
      const withoutPrefix = fullReport.slice(2); // Remove 0x

      expect(() => decodeReport(withoutPrefix, FEED_IDS.V2)).toThrow(ReportDecodingError);
      expect(() => decodeReport(withoutPrefix, FEED_IDS.V2)).toThrow("Report hex string must start with 0x");
    });

    it("should handle large price values", () => {
      const abiCoder = new AbiCoder();
      const largePrice = "999999999999999999999999999999999999999999999999"; // Very large int192

      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192"],
        [FEED_IDS.V2, 1640995200, 1640995300, "1000000000000000000", "500000000000000000", 1640995400, largePrice]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V2);

      expect((decoded as any).price).toBe(BigInt(largePrice));
    });

    it("should handle negative price values", () => {
      const abiCoder = new AbiCoder();
      const negativePrice = "-1000000000000000000000"; // Negative price

      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192"],
        [FEED_IDS.V2, 1640995200, 1640995300, "1000000000000000000", "500000000000000000", 1640995400, negativePrice]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V2);

      expect((decoded as any).price).toBe(BigInt(negativePrice));
    });

    it("should handle zero values", () => {
      const abiCoder = new AbiCoder();

      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192"],
        [
          FEED_IDS.V2,
          0, // validFromTimestamp
          0, // observationsTimestamp
          "0", // nativeFee
          "0", // linkFee
          0, // expiresAt
          "0", // price
        ]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V2);

      expect(decoded.nativeFee).toBe(0n);
      expect(decoded.linkFee).toBe(0n);
      expect(decoded.expiresAt).toBe(0);
      expect((decoded as any).price).toBe(0n);
    });
  });

  describe("report version handling", () => {
    it("should reject unsupported V1 version", () => {
      const v1FeedId = "0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";
      const reportBlob = createV2ReportBlob(); // Use V2 blob but V1 feed ID
      const fullReport = createFullReport(reportBlob);

      expect(() => decodeReport(fullReport, v1FeedId)).toThrow(ReportDecodingError);
      expect(() => decodeReport(fullReport, v1FeedId)).toThrow("Unknown report version: 0x0001");
    });

    it("should reject unknown version V0", () => {
      const v0FeedId = "0x00006b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";
      const reportBlob = createV2ReportBlob();
      const fullReport = createFullReport(reportBlob);

      expect(() => decodeReport(fullReport, v0FeedId)).toThrow(ReportDecodingError);
      expect(() => decodeReport(fullReport, v0FeedId)).toThrow("Unknown report version: 0x0000");
    });

    it("should reject version 0", () => {
      const v0FeedId = "0x00006b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";
      const reportBlob = createV2ReportBlob();
      const fullReport = createFullReport(reportBlob);

      expect(() => decodeReport(fullReport, v0FeedId)).toThrow(ReportDecodingError);
      expect(() => decodeReport(fullReport, v0FeedId)).toThrow("Unknown report version: 0x0000");
    });

    it("should extract version from feed ID correctly", () => {
      // Test that version extraction works for all supported versions
      const versions = [
        { feedId: FEED_IDS.V2, expectedVersion: "V2" },
        { feedId: FEED_IDS.V3, expectedVersion: "V3" },
        { feedId: FEED_IDS.V4, expectedVersion: "V4" },
        { feedId: FEED_IDS.V5, expectedVersion: "V5" },
        { feedId: FEED_IDS.V6, expectedVersion: "V6" },
        { feedId: FEED_IDS.V7, expectedVersion: "V7" },
        { feedId: FEED_IDS.V8, expectedVersion: "V8" },
        { feedId: FEED_IDS.V9, expectedVersion: "V9" },
        { feedId: FEED_IDS.V10, expectedVersion: "V10" },
      ];

      versions.forEach(({ feedId, expectedVersion }) => {
        const reportBlob =
          expectedVersion === "V2"
            ? createV2ReportBlob()
            : expectedVersion === "V3"
              ? createV3ReportBlob()
              : expectedVersion === "V4"
                ? createV4ReportBlob()
                : expectedVersion === "V5"
                  ? createV5ReportBlob()
                  : expectedVersion === "V6"
                    ? createV6ReportBlob()
                    : expectedVersion === "V7"
                      ? createV7ReportBlob()
                      : expectedVersion === "V8"
                        ? createV8ReportBlob()
                        : expectedVersion === "V9"
                          ? createV9ReportBlob()
                          : createV10ReportBlob();
        const fullReport = createFullReport(reportBlob);
        const decoded = decodeReport(fullReport, feedId);
        expect(decoded.version).toBe(expectedVersion);
      });
    });
  });

  describe("malformed report rejection", () => {
    it("should reject empty report", () => {
      expect(() => decodeReport("", FEED_IDS.V2)).toThrow(ReportDecodingError);
      expect(() => decodeReport("", FEED_IDS.V2)).toThrow("Report hex string must start with 0x");
    });

    it("should reject invalid hex string", () => {
      expect(() => decodeReport("not-hex-string", FEED_IDS.V2)).toThrow(ReportDecodingError);
      expect(() => decodeReport("not-hex-string", FEED_IDS.V2)).toThrow("Report hex string must start with 0x");
    });

    it("should reject malformed hex data", () => {
      const invalidHex = "0xZZZZZZZZ"; // Invalid hex characters
      expect(() => decodeReport(invalidHex, FEED_IDS.V2)).toThrow(ReportDecodingError);
    });

    it("should reject truncated report data", () => {
      const reportBlob = createV2ReportBlob();
      const fullReport = createFullReport(reportBlob);
      const truncated = fullReport.slice(0, 100); // Truncate the report

      expect(() => decodeReport(truncated, FEED_IDS.V2)).toThrow(ReportDecodingError);
    });

    it("should reject report with wrong structure", () => {
      const abiCoder = new AbiCoder();
      // Create malformed structure (missing fields)
      const malformedReport = abiCoder.encode(
        ["bytes32", "uint32"], // Only 2 fields instead of required structure
        [FEED_IDS.V2, 1640995200]
      );

      expect(() => decodeReport(malformedReport, FEED_IDS.V2)).toThrow(ReportDecodingError);
    });

    it("should reject report blob with insufficient data for V2", () => {
      const abiCoder = new AbiCoder();
      // Create report blob with insufficient fields for V2 (needs 7 fields)
      const insufficientBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32"], // Only 3 fields
        [FEED_IDS.V2, 1640995200, 1640995300]
      );

      const fullReport = createFullReport(insufficientBlob);
      expect(() => decodeReport(fullReport, FEED_IDS.V2)).toThrow(ReportDecodingError);
    });

    it("should reject report blob with insufficient data for V3", () => {
      const abiCoder = new AbiCoder();
      // Create report blob with insufficient fields for V3 (needs 9 fields)
      const insufficientBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192"], // Only 5 fields
        [FEED_IDS.V3, 1640995200, 1640995300, "1000000000000000000", "500000000000000000"]
      );

      const fullReport = createFullReport(insufficientBlob);
      expect(() => decodeReport(fullReport, FEED_IDS.V3)).toThrow(ReportDecodingError);
    });

    it("should reject report blob with insufficient data for V4", () => {
      const abiCoder = new AbiCoder();
      // Create report blob with insufficient fields for V4 (needs 8 fields)
      const insufficientBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192"], // Only 4 fields
        [FEED_IDS.V4, 1640995200, 1640995300, "1000000000000000000"]
      );

      const fullReport = createFullReport(insufficientBlob);
      expect(() => decodeReport(fullReport, FEED_IDS.V4)).toThrow(ReportDecodingError);
    });
  });

  describe("market status validation (V4)", () => {
    it("should accept valid ACTIVE market status", () => {
      const abiCoder = new AbiCoder();
      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint8"],
        [
          FEED_IDS.V4,
          1640995200,
          1640995300,
          "1000000000000000000",
          "500000000000000000",
          1640995400,
          "2000000000000000000000",
          MarketStatus.ACTIVE,
        ]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V4);

      expect((decoded as any).marketStatus).toBe(MarketStatus.ACTIVE);
    });

    it("should accept valid INACTIVE market status", () => {
      const abiCoder = new AbiCoder();
      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint8"],
        [
          FEED_IDS.V4,
          1640995200,
          1640995300,
          "1000000000000000000",
          "500000000000000000",
          1640995400,
          "2000000000000000000000",
          MarketStatus.INACTIVE,
        ]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V4);

      expect((decoded as any).marketStatus).toBe(MarketStatus.INACTIVE);
    });

    it("should reject invalid market status", () => {
      const abiCoder = new AbiCoder();
      const invalidMarketStatus = 99; // Invalid status

      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint8"],
        [
          FEED_IDS.V4,
          1640995200,
          1640995300,
          "1000000000000000000",
          "500000000000000000",
          1640995400,
          "2000000000000000000000",
          invalidMarketStatus,
        ]
      );

      const fullReport = createFullReport(reportBlob);
      expect(() => decodeReport(fullReport, FEED_IDS.V4)).toThrow(ReportDecodingError);
      expect(() => decodeReport(fullReport, FEED_IDS.V4)).toThrow("Invalid market status: 99");
    });
  });

  describe("market status validation (V8)", () => {
    it("should accept valid ACTIVE market status", () => {
      const abiCoder = new AbiCoder();
      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "uint64", "int192", "uint32"],
        [
          FEED_IDS.V8,
          1640995200,
          1640995300,
          "1000000000000000000",
          "500000000000000000",
          1640995400,
          1640995250,
          "2500000000000000000000",
          MarketStatus.ACTIVE,
        ]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V8);

      expect((decoded as any).marketStatus).toBe(MarketStatus.ACTIVE);
    });

    it("should reject invalid market status", () => {
      const abiCoder = new AbiCoder();
      const invalidMarketStatus = 99; // Invalid status

      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "uint64", "int192", "uint32"],
        [
          FEED_IDS.V8,
          1640995200,
          1640995300,
          "1000000000000000000",
          "500000000000000000",
          1640995400,
          1640995250,
          "2500000000000000000000",
          invalidMarketStatus,
        ]
      );

      const fullReport = createFullReport(reportBlob);
      expect(() => decodeReport(fullReport, FEED_IDS.V8)).toThrow(ReportDecodingError);
      expect(() => decodeReport(fullReport, FEED_IDS.V8)).toThrow("Invalid market status: 99");
    });
  });

  describe("ripcord validation (V9)", () => {
    it("should accept normal ripcord (0)", () => {
      const reportBlob = createV9ReportBlob();
      const fullReport = createFullReport(reportBlob);

      const decoded = decodeReport(fullReport, FEED_IDS.V9);

      expect((decoded as any).ripcord).toBe(0);
    });

    it("should accept paused ripcord (1)", () => {
      const abiCoder = new AbiCoder();
      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint64", "int192", "uint32"],
        [
          FEED_IDS.V9,
          1640995200,
          1640995300,
          "1000000000000000000",
          "500000000000000000",
          1640995400,
          "1050000000000000000",
          1640995250,
          "100000000000000000000000",
          1, // Paused ripcord
        ]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V9);

      expect((decoded as any).ripcord).toBe(1);
    });
  });

  describe("edge cases and boundary conditions", () => {
    it("should handle maximum uint32 values", () => {
      const abiCoder = new AbiCoder();
      const maxUint32 = "4294967295"; // 2^32 - 1

      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192"],
        [
          FEED_IDS.V2,
          maxUint32, // validFromTimestamp
          maxUint32, // observationsTimestamp
          "1000000000000000000",
          "500000000000000000",
          maxUint32, // expiresAt
          "2000000000000000000000",
        ]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V2);

      expect(decoded.expiresAt).toBe(4294967295);
    });

    it("should handle maximum uint192 values", () => {
      const abiCoder = new AbiCoder();
      const maxUint192 = "6277101735386680763835789423207666416102355444464034512895"; // 2^192 - 1

      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192"],
        [
          FEED_IDS.V2,
          1640995200,
          1640995300,
          maxUint192, // nativeFee
          maxUint192, // linkFee
          1640995400,
          "2000000000000000000000",
        ]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V2);

      expect(decoded.nativeFee).toBe(BigInt(maxUint192));
      expect(decoded.linkFee).toBe(BigInt(maxUint192));
    });

    it("should handle minimum int192 values", () => {
      const abiCoder = new AbiCoder();
      const minInt192 = "-3138550867693340381917894711603833208051177722232017256448"; // -(2^191)

      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192"],
        [
          FEED_IDS.V2,
          1640995200,
          1640995300,
          "1000000000000000000",
          "500000000000000000",
          1640995400,
          minInt192, // price
        ]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V2);

      expect((decoded as any).price).toBe(BigInt(minInt192));
    });

    it("should handle reports with very long hex strings", () => {
      // Create a report with maximum valid data
      const reportBlob = createV3ReportBlob(); // V3 has the most fields
      const fullReport = createFullReport(reportBlob);

      // Should handle long but valid hex strings
      expect(() => decodeReport(fullReport, FEED_IDS.V3)).not.toThrow();
    });

    it("should reject reports with null bytes", () => {
      const reportWithNulls = "0x00000000000000000000000000000000";
      expect(() => decodeReport(reportWithNulls, FEED_IDS.V2)).toThrow(ReportDecodingError);
    });
  });

  describe("error message quality", () => {
    it("should provide specific error for invalid hex", () => {
      expect(() => decodeReport("invalid-hex", FEED_IDS.V2)).toThrow("Report hex string must start with 0x");
    });

    it("should provide specific error for unknown version", () => {
      const unknownVersionFeedId = "0x00996b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";
      const reportBlob = createV2ReportBlob();
      const fullReport = createFullReport(reportBlob);

      expect(() => decodeReport(fullReport, unknownVersionFeedId)).toThrow("Unknown report version: 0x0099");
    });

    it("should provide specific error for V2 decoding failure", () => {
      const abiCoder = new AbiCoder();
      const malformedBlob = abiCoder.encode(["bytes32"], [FEED_IDS.V2]); // Insufficient data
      const fullReport = createFullReport(malformedBlob);

      expect(() => decodeReport(fullReport, FEED_IDS.V2)).toThrow("Failed to decode V2 report");
    });

    it("should provide specific error for V3 decoding failure", () => {
      const abiCoder = new AbiCoder();
      const malformedBlob = abiCoder.encode(["bytes32"], [FEED_IDS.V3]); // Insufficient data
      const fullReport = createFullReport(malformedBlob);

      expect(() => decodeReport(fullReport, FEED_IDS.V3)).toThrow("Failed to decode V3 report");
    });

    it("should provide specific error for V4 decoding failure", () => {
      const abiCoder = new AbiCoder();
      const malformedBlob = abiCoder.encode(["bytes32"], [FEED_IDS.V4]); // Insufficient data
      const fullReport = createFullReport(malformedBlob);

      expect(() => decodeReport(fullReport, FEED_IDS.V4)).toThrow("Failed to decode V4 report");
    });

    it("should provide specific error for invalid market status", () => {
      const abiCoder = new AbiCoder();
      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint8"],
        [
          FEED_IDS.V4,
          1640995200,
          1640995300,
          "1000000000000000000",
          "500000000000000000",
          1640995400,
          "2000000000000000000000",
          255,
        ]
      );

      const fullReport = createFullReport(reportBlob);
      expect(() => decodeReport(fullReport, FEED_IDS.V4)).toThrow("Invalid market status: 255");
    });
  });

  describe("performance and memory efficiency", () => {
    it("should decode reports efficiently", () => {
      const reportBlob = createV2ReportBlob();
      const fullReport = createFullReport(reportBlob);

      const start = performance.now();

      // Decode 1000 reports
      for (let i = 0; i < 1000; i++) {
        decodeReport(fullReport, FEED_IDS.V2);
      }

      const end = performance.now();
      const duration = end - start;

      // Should complete in reasonable time (less than 1000ms)
      expect(duration).toBeLessThan(1000);
    });

    it("should handle large report data efficiently", () => {
      // Create report with maximum values to test memory efficiency
      const abiCoder = new AbiCoder();
      const maxValues = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "int192", "int192"],
        [
          FEED_IDS.V3,
          4294967295, // max uint32
          4294967295, // max uint32
          "6277101735386680763835789423207666416102355444464034512895", // max uint192
          "6277101735386680763835789423207666416102355444464034512895", // max uint192
          4294967295, // max uint32
          "3138550867693340381917894711603833208051177722232017256447", // max int192
          "3138550867693340381917894711603833208051177722232017256447", // max int192
          "3138550867693340381917894711603833208051177722232017256447", // max int192
        ]
      );

      const fullReport = createFullReport(maxValues);

      expect(() => decodeReport(fullReport, FEED_IDS.V3)).not.toThrow();
    });

    it("should fail fast for obviously invalid reports", () => {
      const start = performance.now();

      try {
        decodeReport("invalid", FEED_IDS.V2);
      } catch {
        // Expected to throw
      }

      const end = performance.now();
      const duration = end - start;

      // Should fail very quickly (less than 10ms)
      expect(duration).toBeLessThan(10);
    });
  });

  describe("real-world compatibility", () => {
    it("should handle reports in standard format", () => {
      // Test with standard output format structure
      const reportBlob = createV2ReportBlob();
      const fullReport = createFullReport(reportBlob);

      const decoded = decodeReport(fullReport, FEED_IDS.V2);

      // Verify all expected fields are present and correctly typed
      expect(typeof decoded.version).toBe("string");
      expect(typeof decoded.nativeFee).toBe("bigint");
      expect(typeof decoded.linkFee).toBe("bigint");
      expect(typeof decoded.expiresAt).toBe("number");
      expect(typeof (decoded as any).price).toBe("bigint");
    });

    it("should handle reports in alternative format", () => {
      // Test with alternative output format structure
      const reportBlob = createV4ReportBlob();
      const fullReport = createFullReport(reportBlob);

      const decoded = decodeReport(fullReport, FEED_IDS.V4);

      // Verify V4-specific fields
      expect(decoded.version).toBe("V4");
      expect((decoded as any).marketStatus).toBeDefined();
      expect(typeof (decoded as any).marketStatus).toBe("number");
    });

    it("should maintain precision for financial data", () => {
      // Test with realistic financial values
      const abiCoder = new AbiCoder();
      const realisticPrice = "2000123456789012345678"; // $2000.123456789012345678 with 18 decimals
      const realisticFee = "1234567890123456"; // 0.001234567890123456 ETH

      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192"],
        [FEED_IDS.V2, 1640995200, 1640995300, realisticFee, realisticFee, 1640995400, realisticPrice]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V2);

      // Verify precision is maintained
      expect((decoded as any).price.toString()).toBe(realisticPrice);
      expect(decoded.nativeFee.toString()).toBe(realisticFee);
      expect(decoded.linkFee.toString()).toBe(realisticFee);
    });

    it("should handle maximum uint64 values for V8 lastUpdateTimestamp", () => {
      const abiCoder = new AbiCoder();
      const maxUint64 = "18446744073709551615"; // 2^64 - 1

      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "uint64", "int192", "uint32"],
        [
          FEED_IDS.V8,
          1640995200,
          1640995300,
          "1000000000000000000",
          "500000000000000000",
          1640995400,
          maxUint64, // lastUpdateTimestamp
          "2500000000000000000000",
          MarketStatus.ACTIVE,
        ]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V8);

      expect((decoded as any).lastUpdateTimestamp).toBe(Number(maxUint64));
    });

    it("should handle large V8 midPrice values", () => {
      const abiCoder = new AbiCoder();
      const largeMidPrice = "3138550867693340381917894711603833208051177722232017256447"; // Large int192

      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "uint64", "int192", "uint32"],
        [
          FEED_IDS.V8,
          1640995200,
          1640995300,
          "1000000000000000000",
          "500000000000000000",
          1640995400,
          1640995250,
          largeMidPrice,
          MarketStatus.ACTIVE,
        ]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V8);

      expect((decoded as any).midPrice).toBe(BigInt(largeMidPrice));
    });

    it("should handle large V9 AUM values", () => {
      const abiCoder = new AbiCoder();
      const largeAum = "1000000000000000000000000000000000000000000"; // Very large AUM

      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint64", "int192", "uint32"],
        [
          FEED_IDS.V9,
          1640995200,
          1640995300,
          "1000000000000000000",
          "500000000000000000",
          1640995400,
          "1050000000000000000",
          1640995250,
          largeAum,
          0,
        ]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V9);

      expect((decoded as any).aum).toBe(BigInt(largeAum));
    });

    it("should handle maximum uint64 values for V9 navDate", () => {
      const abiCoder = new AbiCoder();
      const maxUint64 = "18446744073709551615"; // 2^64 - 1

      const reportBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint64", "int192", "uint32"],
        [
          FEED_IDS.V9,
          1640995200,
          1640995300,
          "1000000000000000000",
          "500000000000000000",
          1640995400,
          "1050000000000000000",
          maxUint64, // navDate
          "100000000000000000000000",
          0,
        ]
      );

      const fullReport = createFullReport(reportBlob);
      const decoded = decodeReport(fullReport, FEED_IDS.V9);

      expect((decoded as any).navDate).toBe(Number(maxUint64));
    });
  });
});
