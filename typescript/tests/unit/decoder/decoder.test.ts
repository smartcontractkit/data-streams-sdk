/**
 * Unit Tests for Report Decoder
 *
 * These tests validate the report decoding functionality by:
 * - Testing decoding of all supported report formats (V2-V13)
 * - Validating error handling for malformed reports
 * - Checking edge cases like empty reports and invalid versions
 *
 * Requirements:
 * - No external dependencies or network access needed
 * - Uses ethers.js AbiCoder for creating test report blobs
 * - Fast execution with minimal setup
 */

import { describe, expect, it } from "@jest/globals";
import {
  DecodedV10Report,
  DecodedV13Report,
  DecodedV2Report,
  DecodedV3Report,
  DecodedV4Report,
  DecodedV5Report,
  DecodedV6Report,
  DecodedV7Report,
  DecodedV8Report,
  DecodedV9Report,
  decodeReport,
} from "../../../src";
import { AbiCoder } from "ethers";

const abiCoder = new AbiCoder();

// Create mock feed IDs
const mockV2FeedId = "0x0002" + "0".repeat(60);
const mockV3FeedId = "0x0003" + "1".repeat(60);
const mockV4FeedId = "0x0004" + "2".repeat(60);
const mockV5FeedId = "0x0005" + "2".repeat(60);
const mockV6FeedId = "0x0006" + "3".repeat(60);
const mockV7FeedId = "0x0007" + "4".repeat(60);
const mockV8FeedId = "0x0008" + "5".repeat(60);
const mockV9FeedId = "0x0009" + "6".repeat(60);
const mockV10FeedId = "0x000a" + "7".repeat(60);
const mockV13FeedId = "0x000d" + "7".repeat(60);

// Create a properly encoded full report
const mockReportContext = [
  "0x0000000000000000000000000000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000000000000000000000000000002",
  "0x0000000000000000000000000000000000000000000000000000000000000003",
];

// Create V2 report blob
const mockV2ReportBlob = abiCoder.encode(
  ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192"],
  [
    mockV2FeedId,
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000),
    1000000000000000000n, // 1 native token
    2000000000000000000n, // 2 LINK
    Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
    50000000000000000000n, // $50 price
  ]
);

// Create V3 report blob
const mockV3ReportBlob = abiCoder.encode(
  ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "int192", "int192"],
  [
    mockV3FeedId,
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000),
    1000000000000000000n, // 1 native token
    2000000000000000000n, // 2 LINK
    Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
    50000000000000000000n, // $50 price
    49000000000000000000n, // $49 bid
    51000000000000000000n, // $51 ask
  ]
);

// Create V4 report blob
const mockV4ReportBlob = abiCoder.encode(
  ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint8"],
  [
    mockV4FeedId,
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000),
    1000000000000000000n, // 1 native token
    2000000000000000000n, // 2 LINK
    Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
    50000000000000000000n, // $50 price
    2, // ACTIVE market status
  ]
);

// Create V5 report blob
const mockV5ReportBlob = abiCoder.encode(
  ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint32", "uint32"],
  [
    mockV5FeedId,
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000),
    1000000000000000000n,
    2000000000000000000n,
    Math.floor(Date.now() / 1000) + 3600,
    1234567890000000000n,
    Math.floor(Date.now() / 1000),
    3600,
  ]
);

// Create V6 report blob
const mockV6ReportBlob = abiCoder.encode(
  ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "int192", "int192", "int192", "int192"],
  [
    mockV6FeedId,
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000),
    1000000000000000000n,
    2000000000000000000n,
    Math.floor(Date.now() / 1000) + 3600,
    50000000000000000000n,
    51000000000000000000n,
    52000000000000000000n,
    53000000000000000000n,
    54000000000000000000n,
  ]
);

// Create V7 report blob
const mockV7ReportBlob = abiCoder.encode(
  ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192"],
  [
    mockV7FeedId,
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000),
    1000000000000000000n,
    2000000000000000000n,
    Math.floor(Date.now() / 1000) + 3600,
    987654321000000000n,
  ]
);

// Create V8 report blob
const mockV8ReportBlob = abiCoder.encode(
  ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "uint64", "int192", "uint32"],
  [
    mockV8FeedId,
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000),
    1000000000000000000n, // 1 native token
    2000000000000000000n, // 2 LINK
    Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
    BigInt(Math.floor(Date.now() / 1000)), // lastUpdateTimestamp
    60000000000000000000n, // $60 midPrice
    2, // ACTIVE market status
  ]
);

// Create V9 report blob
const mockV9ReportBlob = abiCoder.encode(
  ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint64", "int192", "uint32"],
  [
    mockV9FeedId,
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000),
    1000000000000000000n, // 1 native token
    2000000000000000000n, // 2 LINK
    Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
    1050000000000000000n, // $1.05 navPerShare
    BigInt(Math.floor(Date.now() / 1000)), // navDate
    100000000000000000000000n, // $100k AUM
    0, // Normal ripcord (not paused)
  ]
);

// Create V10 report blob
const mockV10ReportBlob = abiCoder.encode(
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
    mockV10FeedId,
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000),
    1000000000000000000n, // 1 native token
    2000000000000000000n, // 2 LINK
    Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
    BigInt(Math.floor(Date.now() / 1000)), // lastUpdateTimestamp
    75000000000000000000n, // $75 price
    2, // ACTIVE market status
    1000000000000000000n, // 1.0 currentMultiplier (18 decimals)
    1100000000000000000n, // 1.1 newMultiplier (18 decimals)
    Math.floor(Date.now() / 1000) + 86400, // activationDateTime (1 day later)
    150000000000000000000n, // $150 tokenizedPrice (2x the base price)
  ]
);

// Create V13 report blob
const mockV13ReportBlob = abiCoder.encode(
  [
    "bytes32",
    "uint32",
    "uint32",
    "uint192",
    "uint192",
    "uint32",
    "uint64",
    "int192",
    "int192",
    "uint64",
    "uint64",
    "int192",
  ],
  [
    mockV13FeedId,
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000),
    1000000000000000000n, // 1 native token
    2000000000000000000n, // 2 LINK
    Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
    BigInt(Math.floor(Date.now() / 1000)), // lastUpdateTimestamp
    75000000000000000000n, // best ask $75
    78000000000000000000n, // best bid $78
    10000, // ask volume
    11000, // bid volume
    76000000000000000000n, // last traded price $76
  ]
);

// Create full reports
const mockV2FullReport = abiCoder.encode(
  ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
  [
    mockReportContext,
    mockV2ReportBlob,
    ["0x0000000000000000000000000000000000000000000000000000000000000004"],
    ["0x0000000000000000000000000000000000000000000000000000000000000005"],
    "0x0000000000000000000000000000000000000000000000000000000000000006",
  ]
);

const mockV3FullReport = abiCoder.encode(
  ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
  [
    mockReportContext,
    mockV3ReportBlob,
    ["0x0000000000000000000000000000000000000000000000000000000000000004"],
    ["0x0000000000000000000000000000000000000000000000000000000000000005"],
    "0x0000000000000000000000000000000000000000000000000000000000000006",
  ]
);

const mockV4FullReport = abiCoder.encode(
  ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
  [
    mockReportContext,
    mockV4ReportBlob,
    ["0x0000000000000000000000000000000000000000000000000000000000000004"],
    ["0x0000000000000000000000000000000000000000000000000000000000000005"],
    "0x0000000000000000000000000000000000000000000000000000000000000006",
  ]
);

const mockV5FullReport = abiCoder.encode(
  ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
  [
    mockReportContext,
    mockV5ReportBlob,
    ["0x0000000000000000000000000000000000000000000000000000000000000007"],
    ["0x0000000000000000000000000000000000000000000000000000000000000008"],
    "0x0000000000000000000000000000000000000000000000000000000000000009",
  ]
);

const mockV6FullReport = abiCoder.encode(
  ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
  [
    mockReportContext,
    mockV6ReportBlob,
    ["0x000000000000000000000000000000000000000000000000000000000000000a"],
    ["0x000000000000000000000000000000000000000000000000000000000000000b"],
    "0x000000000000000000000000000000000000000000000000000000000000000c",
  ]
);

const mockV7FullReport = abiCoder.encode(
  ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
  [
    mockReportContext,
    mockV7ReportBlob,
    ["0x000000000000000000000000000000000000000000000000000000000000000d"],
    ["0x000000000000000000000000000000000000000000000000000000000000000e"],
    "0x000000000000000000000000000000000000000000000000000000000000000f",
  ]
);

const mockV8FullReport = abiCoder.encode(
  ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
  [
    mockReportContext,
    mockV8ReportBlob,
    ["0x0000000000000000000000000000000000000000000000000000000000000007"],
    ["0x0000000000000000000000000000000000000000000000000000000000000008"],
    "0x0000000000000000000000000000000000000000000000000000000000000009",
  ]
);

const mockV9FullReport = abiCoder.encode(
  ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
  [
    mockReportContext,
    mockV9ReportBlob,
    ["0x000000000000000000000000000000000000000000000000000000000000000a"],
    ["0x000000000000000000000000000000000000000000000000000000000000000b"],
    "0x000000000000000000000000000000000000000000000000000000000000000c",
  ]
);

const mockV10FullReport = abiCoder.encode(
  ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
  [
    mockReportContext,
    mockV10ReportBlob,
    ["0x000000000000000000000000000000000000000000000000000000000000000d"],
    ["0x000000000000000000000000000000000000000000000000000000000000000e"],
    "0x000000000000000000000000000000000000000000000000000000000000000f",
  ]
);

const mockV13FullReport = abiCoder.encode(
  ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
  [
    mockReportContext,
    mockV13ReportBlob,
    ["0x0000000000000000000000000000000000000000000000000000000000000010"],
    ["0x0000000000000000000000000000000000000000000000000000000000000011"],
    "0x0000000000000000000000000000000000000000000000000000000000000012",
  ]
);

describe("Report Decoder", () => {
  describe("v2 reports", () => {
    it("should decode valid v2 report", () => {
      const decoded = decodeReport(mockV2FullReport, mockV2FeedId) as DecodedV2Report;
      expect(decoded).toBeDefined();
      expect(decoded.version).toBe("V2");
      expect(decoded.price).toBeDefined();
    });
  });

  describe("v3 reports", () => {
    it("should decode valid v3 report", () => {
      const decoded = decodeReport(mockV3FullReport, mockV3FeedId) as DecodedV3Report;

      expect(decoded).toBeDefined();
      expect(decoded.version).toBe("V3");
      expect(decoded.nativeFee).toBeDefined();
      expect(decoded.linkFee).toBeDefined();
      expect(decoded.expiresAt).toBeDefined();
      expect(decoded.price).toBeDefined();
      expect(decoded.bid).toBeDefined();
      expect(decoded.ask).toBeDefined();
    });

    it("should handle malformed v3 report", () => {
      const malformedReport = "0xinvalid";
      expect(() => decodeReport(malformedReport, mockV3FeedId)).toThrow();
    });
  });

  describe("v4 reports", () => {
    it("should decode valid v4 report", () => {
      const decoded = decodeReport(mockV4FullReport, mockV4FeedId) as DecodedV4Report;

      expect(decoded).toBeDefined();
      expect(decoded.version).toBe("V4");
      expect(decoded.nativeFee).toBeDefined();
      expect(decoded.linkFee).toBeDefined();
      expect(decoded.expiresAt).toBeDefined();
      expect(decoded.price).toBeDefined();
      expect(decoded.marketStatus).toBeDefined();
    });

    it("should handle malformed v4 report", () => {
      const malformedReport = "0xinvalid";
      expect(() => decodeReport(malformedReport, mockV4FeedId)).toThrow();
    });
  });

  describe("v5 reports", () => {
    it("should decode valid v5 report", () => {
      const decoded = decodeReport(mockV5FullReport, mockV5FeedId) as DecodedV5Report;

      expect(decoded).toBeDefined();
      expect(decoded.version).toBe("V5");
      expect(decoded.nativeFee).toBeDefined();
      expect(decoded.linkFee).toBeDefined();
      expect(decoded.expiresAt).toBeDefined();
      expect(decoded.rate).toBeDefined();
      expect(decoded.timestamp).toBeDefined();
      expect(decoded.duration).toBeDefined();
    });
  });

  describe("v6 reports", () => {
    it("should decode valid v6 report", () => {
      const decoded = decodeReport(mockV6FullReport, mockV6FeedId) as DecodedV6Report;
      expect(decoded).toBeDefined();
      expect(decoded.version).toBe("V6");
      expect((decoded as any).price).toBeDefined();
      expect(decoded.price2).toBeDefined();
      expect(decoded.price3).toBeDefined();
      expect(decoded.price4).toBeDefined();
      expect(decoded.price5).toBeDefined();
    });
  });

  describe("v7 reports", () => {
    it("should decode valid v7 report", () => {
      const decoded = decodeReport(mockV7FullReport, mockV7FeedId) as DecodedV7Report;
      expect(decoded).toBeDefined();
      expect(decoded.version).toBe("V7");
      expect(decoded.exchangeRate).toBeDefined();
    });
  });

  describe("v8 reports", () => {
    it("should decode valid v8 report", () => {
      const decoded = decodeReport(mockV8FullReport, mockV8FeedId) as DecodedV8Report;

      expect(decoded).toBeDefined();
      expect(decoded.version).toBe("V8");
      expect(decoded.nativeFee).toBeDefined();
      expect(decoded.linkFee).toBeDefined();
      expect(decoded.expiresAt).toBeDefined();
      expect(decoded.midPrice).toBeDefined();
      expect(decoded.lastUpdateTimestamp).toBeDefined();
      expect(decoded.marketStatus).toBeDefined();
    });

    it("should handle malformed v8 report", () => {
      const malformedReport = "0xinvalid";
      expect(() => decodeReport(malformedReport, mockV8FeedId)).toThrow();
    });

    it("should validate market status for v8 reports", () => {
      // Create invalid market status blob
      const invalidMarketStatusBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "uint64", "int192", "uint32"],
        [
          mockV8FeedId,
          Math.floor(Date.now() / 1000),
          Math.floor(Date.now() / 1000),
          1000000000000000000n,
          2000000000000000000n,
          Math.floor(Date.now() / 1000) + 3600,
          BigInt(Math.floor(Date.now() / 1000)),
          60000000000000000000n,
          99, // Invalid market status
        ]
      );

      const invalidFullReport = abiCoder.encode(
        ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
        [
          mockReportContext,
          invalidMarketStatusBlob,
          ["0x0000000000000000000000000000000000000000000000000000000000000007"],
          ["0x0000000000000000000000000000000000000000000000000000000000000008"],
          "0x0000000000000000000000000000000000000000000000000000000000000009",
        ]
      );

      expect(() => decodeReport(invalidFullReport, mockV8FeedId)).toThrow("Invalid market status");
    });
  });

  describe("v9 reports", () => {
    it("should decode valid v9 report", () => {
      const decoded = decodeReport(mockV9FullReport, mockV9FeedId) as DecodedV9Report;

      expect(decoded).toBeDefined();
      expect(decoded.version).toBe("V9");
      expect(decoded.nativeFee).toBeDefined();
      expect(decoded.linkFee).toBeDefined();
      expect(decoded.expiresAt).toBeDefined();
      expect(decoded.navPerShare).toBeDefined();
      expect(decoded.navDate).toBeDefined();
      expect(decoded.aum).toBeDefined();
      expect(decoded.ripcord).toBeDefined();
    });

    it("should handle malformed v9 report", () => {
      const malformedReport = "0xinvalid";
      expect(() => decodeReport(malformedReport, mockV9FeedId)).toThrow();
    });

    it("should handle ripcord flag validation for v9 reports", () => {
      // Test normal ripcord (0)
      const normalDecoded = decodeReport(mockV9FullReport, mockV9FeedId) as DecodedV9Report;
      expect(normalDecoded.ripcord).toBe(0);

      // Test paused ripcord (1)
      const pausedRipcordBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint64", "int192", "uint32"],
        [
          mockV9FeedId,
          Math.floor(Date.now() / 1000),
          Math.floor(Date.now() / 1000),
          1000000000000000000n,
          2000000000000000000n,
          Math.floor(Date.now() / 1000) + 3600,
          1050000000000000000n,
          BigInt(Math.floor(Date.now() / 1000)),
          100000000000000000000000n,
          1, // Paused ripcord
        ]
      );

      const pausedFullReport = abiCoder.encode(
        ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
        [
          mockReportContext,
          pausedRipcordBlob,
          ["0x000000000000000000000000000000000000000000000000000000000000000a"],
          ["0x000000000000000000000000000000000000000000000000000000000000000b"],
          "0x000000000000000000000000000000000000000000000000000000000000000c",
        ]
      );

      const pausedDecoded = decodeReport(pausedFullReport, mockV9FeedId) as DecodedV9Report;
      expect(pausedDecoded.ripcord).toBe(1);
    });

    it("should reject invalid ripcord values for v9 reports", () => {
      // Test invalid ripcord (2) - should throw error
      const invalidRipcordBlob = abiCoder.encode(
        ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "uint64", "int192", "uint32"],
        [
          mockV9FeedId,
          Math.floor(Date.now() / 1000),
          Math.floor(Date.now() / 1000),
          1000000000000000000n,
          2000000000000000000n,
          Math.floor(Date.now() / 1000) + 3600,
          1050000000000000000n,
          BigInt(Math.floor(Date.now() / 1000)),
          100000000000000000000000n,
          2, // Invalid ripcord value
        ]
      );

      const invalidFullReport = abiCoder.encode(
        ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
        [
          mockReportContext,
          invalidRipcordBlob,
          ["0x000000000000000000000000000000000000000000000000000000000000000a"],
          ["0x000000000000000000000000000000000000000000000000000000000000000b"],
          "0x000000000000000000000000000000000000000000000000000000000000000c",
        ]
      );

      expect(() => decodeReport(invalidFullReport, mockV9FeedId)).toThrow(
        "Invalid ripcord value: 2. Must be 0 (normal) or 1 (paused)"
      );
    });
  });

  describe("v10 reports", () => {
    it("should decode valid v10 report", () => {
      const decoded = decodeReport(mockV10FullReport, mockV10FeedId) as DecodedV10Report;

      expect(decoded).toBeDefined();
      expect(decoded.version).toBe("V10");
      expect(decoded.nativeFee).toBeDefined();
      expect(decoded.linkFee).toBeDefined();
      expect(decoded.expiresAt).toBeDefined();
      expect(decoded.price).toBeDefined();
      expect(decoded.lastUpdateTimestamp).toBeDefined();
      expect(decoded.marketStatus).toBeDefined();
      expect(decoded.currentMultiplier).toBeDefined();
      expect(decoded.newMultiplier).toBeDefined();
      expect(decoded.activationDateTime).toBeDefined();
      expect(decoded.tokenizedPrice).toBeDefined();
    });

    it("should handle malformed v10 report", () => {
      const malformedReport = "0xinvalid";
      expect(() => decodeReport(malformedReport, mockV10FeedId)).toThrow();
    });

    it("should validate market status for v10 reports", () => {
      // Create invalid market status blob
      const invalidMarketStatusBlob = abiCoder.encode(
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
          mockV10FeedId,
          Math.floor(Date.now() / 1000),
          Math.floor(Date.now() / 1000),
          1000000000000000000n,
          2000000000000000000n,
          Math.floor(Date.now() / 1000) + 3600,
          BigInt(Math.floor(Date.now() / 1000)),
          75000000000000000000n,
          99, // Invalid market status
          1000000000000000000n,
          1100000000000000000n,
          Math.floor(Date.now() / 1000) + 86400,
          150000000000000000000n,
        ]
      );

      const invalidFullReport = abiCoder.encode(
        ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
        [
          mockReportContext,
          invalidMarketStatusBlob,
          ["0x000000000000000000000000000000000000000000000000000000000000000d"],
          ["0x000000000000000000000000000000000000000000000000000000000000000e"],
          "0x000000000000000000000000000000000000000000000000000000000000000f",
        ]
      );

      expect(() => decodeReport(invalidFullReport, mockV10FeedId)).toThrow("Invalid market status");
    });

    it("should decode all v10 fields correctly", () => {
      const decoded = decodeReport(mockV10FullReport, mockV10FeedId) as DecodedV10Report;

      // Verify all numeric fields are properly parsed
      expect(typeof decoded.lastUpdateTimestamp).toBe("number");
      expect(typeof decoded.marketStatus).toBe("number");
      expect(typeof decoded.activationDateTime).toBe("number");
      expect(typeof decoded.price).toBe("bigint");
      expect(typeof decoded.currentMultiplier).toBe("bigint");
      expect(typeof decoded.newMultiplier).toBe("bigint");
      expect(typeof decoded.tokenizedPrice).toBe("bigint");

      // Verify market status is valid
      expect([0, 1, 2]).toContain(decoded.marketStatus);

      expect(decoded.currentMultiplier).toBeGreaterThan(0n);
      expect(decoded.newMultiplier).toBeGreaterThan(0n);
      expect(decoded.currentMultiplier).not.toBe(decoded.newMultiplier);
    });
  });

  describe("v13 reports", () => {
    it("should decode valid v13 report", () => {
      const decoded = decodeReport(mockV13FullReport, mockV13FeedId) as DecodedV13Report;

      expect(decoded).toBeDefined();
      expect(decoded.version).toBe("V13");
      expect(decoded.nativeFee).toBeDefined();
      expect(decoded.linkFee).toBeDefined();
      expect(decoded.expiresAt).toBeDefined();
      expect(decoded.lastUpdateTimestamp).toBeDefined();
      expect(decoded.bestAsk).toBeDefined();
      expect(decoded.bestBid).toBeDefined();
      expect(decoded.askVolume).toBeDefined();
      expect(decoded.bidVolume).toBeDefined();
      expect(decoded.lastTradedPrice).toBeDefined();
    });

    it("should handle malformed v13 report", () => {
      const malformedReport = "0xinvalid";
      expect(() => decodeReport(malformedReport, mockV13FeedId)).toThrow();
    });

    it("should validate market status for v13 reports", () => {
      // Create invalid market status blob
      const invalidMarketStatusBlob = abiCoder.encode(
        [
          "bytes32",
          "uint32",
          "uint32",
          "uint192",
          "uint192",
          "uint32",
          "uint64",
          "int192",
          "int192",
          "uint64",
          "uint64",
          "int192",
        ],
        [
          mockV13FeedId,
          Math.floor(Date.now() / 1000),
          Math.floor(Date.now() / 1000),
          1000000000000000000n,
          2000000000000000000n,
          Math.floor(Date.now() / 1000) + 3600,
          BigInt(Math.floor(Date.now() / 1000)),
          75000000000000000000n, // best ask $75
          78000000000000000000n, // best bid $78
          10000, // ask volume
          11000, // bid volume
          76000000000000000000n, // last traded price $76
        ]
      );

      const invalidFullReport = abiCoder.encode(
        ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
        [
          mockReportContext,
          invalidMarketStatusBlob,
          ["0x0000000000000000000000000000000000000000000000000000000000000010"],
          ["0x0000000000000000000000000000000000000000000000000000000000000011"],
          "0x0000000000000000000000000000000000000000000000000000000000000012",
        ]
      );

      expect(() => decodeReport(invalidFullReport, mockV13FeedId)).toThrow("Invalid market status");
    });

    it("should decode all v13 fields correctly", () => {
      const decoded = decodeReport(mockV13FullReport, mockV13FeedId) as DecodedV13Report;

      // Verify all numeric fields are properly parsed
      expect(typeof decoded.lastUpdateTimestamp).toBe("number");
      expect(typeof decoded.bestAsk).toBe("bigint");
      expect(typeof decoded.bestBid).toBe("bigint");
      expect(typeof decoded.askVolume).toBe("number");
      expect(typeof decoded.bidVolume).toBe("number");
      expect(typeof decoded.lastTradedPrice).toBe("bigint");
    });
  });

  describe("edge cases", () => {
    it("should handle empty report", () => {
      expect(() => decodeReport("", mockV3FeedId)).toThrow();
    });

    it("should handle non-hex input", () => {
      expect(() => decodeReport("not-hex", mockV3FeedId)).toThrow();
    });

    it("should handle invalid version", () => {
      const invalidFeedId = "0x0009" + "1".repeat(60);
      expect(() => decodeReport(mockV3FullReport, invalidFeedId)).toThrow();
    });
  });
});
