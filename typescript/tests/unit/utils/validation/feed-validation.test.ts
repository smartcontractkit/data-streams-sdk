/**
 * Unit Tests for Feed ID Validation Functions
 *
 * These tests validate the feed ID functionality by:
 * - Testing feed ID hex string parsing and validation
 * - Testing feed ID format validation (length, prefix, characters)
 * - Testing invalid feed ID rejection with clear error messages
 * - Testing feed ID normalization and case handling
 * - Testing version extraction from feed IDs
 * - Testing edge cases (empty, null, malformed, special characters)
 * - Testing feed ID comparison and equality
 * - Testing feed ID array validation
 *
 * Goals:
 * - Ensure robust feed ID validation that prevents invalid data
 * - Test all edge cases and error scenarios comprehensively
 * - Support feed versions V2, V3, V4, V5, V6, V7, V8, V9, V10, V11, V12, V13
 * - Provide clear, helpful error messages for developers
 * - Build the best possible TypeScript feed ID validation
 */

import { describe, expect, it } from "@jest/globals";
import { validateFeedId, validateFeedIds } from "../../../../src/utils/validation";
import { ValidationError } from "../../../../src/types/errors";

describe("Feed ID Validation Tests", () => {
  // Test vectors from reference implementations
  const VALID_FEED_IDS = {
    V1: "0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V2: "0x00026b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V3: "0x00036b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V4: "0x00046b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V5: "0x00056b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V6: "0x00066b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V7: "0x00076b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V8: "0x00086b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V9: "0x00096b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V10: "0x000a6b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V11: "0x000bfb6d135897e4aaf5657bffd3b0b48f8e2a5131214c9ec2d62eac5d532067",
    V12: "0x000c6b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472",
    V13: "0x000d13a9b9c5e37a099f374e92c37914af5c268f3a8a9721f1725135bfb4cbb8",
  };

  const REAL_WORLD_FEED_IDS = {
    // Real feed IDs from reference tests
    FEED1: "0x00020ffa644e6c585a5bec0e25ca476b6666666666e22b6240957720dcba0e14",
    FEED2: "0x00020ffa644e6c585a88888825ca476b6666666666e22b6240957720dcba0e14",
  };

  describe("valid feed ID formats", () => {
    it("should reject unsupported V1 feed ID", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V1)).toThrow(ValidationError);
      expect(() => validateFeedId(VALID_FEED_IDS.V1)).toThrow("Invalid feed ID version");
    });

    it("should accept valid V2 feed ID", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V2)).not.toThrow();
    });

    it("should accept valid V3 feed ID", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V3)).not.toThrow();
    });

    it("should accept valid V4 feed ID", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V4)).not.toThrow();
    });

    it("should accept valid V5 feed ID", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V5)).not.toThrow();
    });

    it("should accept valid V6 feed ID", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V6)).not.toThrow();
    });

    it("should accept valid V7 feed ID", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V7)).not.toThrow();
    });

    it("should accept valid V8 feed ID", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V8)).not.toThrow();
    });

    it("should accept valid V9 feed ID", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V9)).not.toThrow();
    });

    it("should accept valid V10 feed ID", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V10)).not.toThrow();
    });

    it("should accept valid V11 feed ID", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V11)).not.toThrow();
    });

    it("should accept valid V12 feed ID", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V12)).not.toThrow();
    });

    it("should accept valid V13 feed ID", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V13)).not.toThrow();
    });

    it("should accept real-world feed IDs", () => {
      expect(() => validateFeedId(REAL_WORLD_FEED_IDS.FEED1)).not.toThrow();
      expect(() => validateFeedId(REAL_WORLD_FEED_IDS.FEED2)).not.toThrow();
    });

    it("should reject uppercase prefix but accept uppercase hex", () => {
      const uppercaseFeedId = VALID_FEED_IDS.V3.toUpperCase(); // "0X..." format
      expect(() => validateFeedId(uppercaseFeedId)).toThrow(ValidationError);

      // But lowercase prefix with uppercase hex should work
      const mixedCase = "0x" + VALID_FEED_IDS.V3.slice(2).toUpperCase();
      expect(() => validateFeedId(mixedCase)).not.toThrow();
    });

    it("should accept mixed case hex characters", () => {
      const mixedCaseFeedId = "0x00036B4aa7E57ca7B68ae1BF45653f56B656fd3AA335ef7fAE696b663F1b8472";
      expect(() => validateFeedId(mixedCaseFeedId)).not.toThrow();
    });
  });

  describe("feed ID format validation", () => {
    it("should reject feed ID without 0x prefix", () => {
      const withoutPrefix = VALID_FEED_IDS.V3.slice(2); // Remove 0x
      expect(() => validateFeedId(withoutPrefix)).toThrow(ValidationError);
      expect(() => validateFeedId(withoutPrefix)).toThrow("Invalid feed ID format");
    });

    it("should reject feed ID with wrong prefix", () => {
      const wrongPrefix = "0y" + VALID_FEED_IDS.V3.slice(2);
      expect(() => validateFeedId(wrongPrefix)).toThrow(ValidationError);
      expect(() => validateFeedId(wrongPrefix)).toThrow("Invalid feed ID format");
    });

    it("should reject feed ID with incorrect length (too short)", () => {
      const tooShort = "0x00036b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b84"; // 62 chars instead of 64
      expect(() => validateFeedId(tooShort)).toThrow(ValidationError);
      expect(() => validateFeedId(tooShort)).toThrow("Invalid feed ID format");
    });

    it("should reject feed ID with incorrect length (too long)", () => {
      const tooLong = VALID_FEED_IDS.V3 + "72"; // Extra characters
      expect(() => validateFeedId(tooLong)).toThrow(ValidationError);
      expect(() => validateFeedId(tooLong)).toThrow("Invalid feed ID format");
    });

    it("should reject feed ID with invalid hex characters", () => {
      const invalidHex = "0x00036g4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472"; // 'g' is not valid hex
      expect(() => validateFeedId(invalidHex)).toThrow(ValidationError);
      expect(() => validateFeedId(invalidHex)).toThrow("Invalid feed ID format");
    });

    it("should reject feed ID with special characters", () => {
      const specialChars = "0x00036b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b84@#";
      expect(() => validateFeedId(specialChars)).toThrow(ValidationError);
      expect(() => validateFeedId(specialChars)).toThrow("Invalid feed ID format");
    });

    it("should reject feed ID with spaces", () => {
      const withSpaces = "0x0003 6b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";
      expect(() => validateFeedId(withSpaces)).toThrow(ValidationError);
      expect(() => validateFeedId(withSpaces)).toThrow("Invalid feed ID format");
    });
  });

  describe("feed ID version validation", () => {
    it("should reject unsupported version V1 (0x0001)", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V1)).toThrow(ValidationError);
      expect(() => validateFeedId(VALID_FEED_IDS.V1)).toThrow("Invalid feed ID version");
    });

    it("should accept supported version V2 (0x0002)", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V2)).not.toThrow();
    });

    it("should accept supported version V3 (0x0003)", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V3)).not.toThrow();
    });

    it("should accept supported version V4 (0x0004)", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V4)).not.toThrow();
    });

    it("should accept supported version V5 (0x0005)", () => {
      const v5FeedId = "0x00056b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";
      expect(() => validateFeedId(v5FeedId)).not.toThrow();
    });

    it("should reject version 0 (0x0000)", () => {
      const v0FeedId = "0x00006b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";
      expect(() => validateFeedId(v0FeedId)).toThrow(ValidationError);
      expect(() => validateFeedId(v0FeedId)).toThrow("Invalid feed ID version");
    });

    it("should reject very high version numbers", () => {
      const highVersionFeedId = "0xFFFF6b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472";
      expect(() => validateFeedId(highVersionFeedId)).toThrow(ValidationError);
      expect(() => validateFeedId(highVersionFeedId)).toThrow("Invalid feed ID version");
    });
  });

  describe("edge cases and error scenarios", () => {
    it("should reject empty string", () => {
      expect(() => validateFeedId("")).toThrow(ValidationError);
      expect(() => validateFeedId("")).toThrow("Feed ID is required");
    });

    it("should reject null feed ID", () => {
      expect(() => validateFeedId(null as any)).toThrow(ValidationError);
      expect(() => validateFeedId(null as any)).toThrow("Feed ID is required");
    });

    it("should reject undefined feed ID", () => {
      expect(() => validateFeedId(undefined as any)).toThrow(ValidationError);
      expect(() => validateFeedId(undefined as any)).toThrow("Feed ID is required");
    });

    it("should reject whitespace-only string", () => {
      expect(() => validateFeedId("   ")).toThrow(ValidationError);
      expect(() => validateFeedId("   ")).toThrow("Invalid feed ID format");
    });

    it("should reject number instead of string", () => {
      expect(() => validateFeedId(123 as any)).toThrow(ValidationError);
      expect(() => validateFeedId(123 as any)).toThrow("Invalid feed ID format");
    });

    it("should reject object instead of string", () => {
      expect(() => validateFeedId({} as any)).toThrow(ValidationError);
      expect(() => validateFeedId({} as any)).toThrow("Invalid feed ID format");
    });

    it("should reject array instead of string", () => {
      expect(() => validateFeedId([] as any)).toThrow(ValidationError);
      expect(() => validateFeedId([] as any)).toThrow("Invalid feed ID format");
    });

    it("should reject boolean instead of string", () => {
      expect(() => validateFeedId(true as any)).toThrow(ValidationError);
      expect(() => validateFeedId(true as any)).toThrow("Invalid feed ID format");
    });
  });

  describe("feed ID normalization and case handling", () => {
    it("should handle leading/trailing whitespace (if we decide to be permissive)", () => {
      // Note: Our current implementation doesn't trim, but we could enhance it
      const withWhitespace = `  ${VALID_FEED_IDS.V3}  `;
      expect(() => validateFeedId(withWhitespace)).toThrow(); // Current behavior
    });

    it("should be case insensitive for hex characters but not prefix", () => {
      const lowercase = VALID_FEED_IDS.V3.toLowerCase();
      const uppercaseHex = "0x" + VALID_FEED_IDS.V3.slice(2).toUpperCase();

      expect(() => validateFeedId(lowercase)).not.toThrow();
      expect(() => validateFeedId(uppercaseHex)).not.toThrow();
    });

    it("should reject uppercase 0X prefix", () => {
      const uppercasePrefix = VALID_FEED_IDS.V3.replace("0x", "0X");
      expect(() => validateFeedId(uppercasePrefix)).toThrow(ValidationError);
      expect(() => validateFeedId(uppercasePrefix)).toThrow("Invalid feed ID format");
    });
  });

  describe("feed ID array validation", () => {
    it("should accept array of valid feed IDs", () => {
      const validArray = [VALID_FEED_IDS.V2, VALID_FEED_IDS.V3, VALID_FEED_IDS.V4];
      expect(() => validateFeedIds(validArray)).not.toThrow();
    });

    it("should accept single feed ID in array", () => {
      const singleArray = [VALID_FEED_IDS.V3];
      expect(() => validateFeedIds(singleArray)).not.toThrow();
    });

    it("should reject empty array", () => {
      expect(() => validateFeedIds([])).toThrow(ValidationError);
      expect(() => validateFeedIds([])).toThrow("At least one feed ID is required");
    });

    it("should reject non-array input", () => {
      expect(() => validateFeedIds("not-an-array" as any)).toThrow(ValidationError);
      expect(() => validateFeedIds("not-an-array" as any)).toThrow("Feed IDs must be an array");
    });

    it("should reject null array", () => {
      expect(() => validateFeedIds(null as any)).toThrow(ValidationError);
      expect(() => validateFeedIds(null as any)).toThrow("Feed IDs must be an array");
    });

    it("should reject undefined array", () => {
      expect(() => validateFeedIds(undefined as any)).toThrow(ValidationError);
      expect(() => validateFeedIds(undefined as any)).toThrow("Feed IDs must be an array");
    });

    it("should reject array with invalid feed ID", () => {
      const mixedArray = [VALID_FEED_IDS.V3, "invalid-feed-id", VALID_FEED_IDS.V4];
      expect(() => validateFeedIds(mixedArray)).toThrow(ValidationError);
      expect(() => validateFeedIds(mixedArray)).toThrow("Invalid feed ID format");
    });

    it("should reject array with empty string", () => {
      const arrayWithEmpty = [VALID_FEED_IDS.V3, "", VALID_FEED_IDS.V4];
      expect(() => validateFeedIds(arrayWithEmpty)).toThrow(ValidationError);
      expect(() => validateFeedIds(arrayWithEmpty)).toThrow("Feed ID is required");
    });

    it("should reject array with null element", () => {
      const arrayWithNull = [VALID_FEED_IDS.V3, null, VALID_FEED_IDS.V4];
      expect(() => validateFeedIds(arrayWithNull as any)).toThrow(ValidationError);
      expect(() => validateFeedIds(arrayWithNull as any)).toThrow("Feed ID is required");
    });

    it("should handle large arrays efficiently", () => {
      const largeArray = Array(1000).fill(VALID_FEED_IDS.V3);
      expect(() => validateFeedIds(largeArray)).not.toThrow();
    });

    it("should handle duplicate feed IDs in array", () => {
      const duplicateArray = [VALID_FEED_IDS.V3, VALID_FEED_IDS.V3, VALID_FEED_IDS.V4];
      expect(() => validateFeedIds(duplicateArray)).not.toThrow(); // Duplicates are allowed
    });
  });

  describe("error message quality", () => {
    it("should provide specific error for missing prefix", () => {
      const withoutPrefix = VALID_FEED_IDS.V3.slice(2);
      expect(() => validateFeedId(withoutPrefix)).toThrow(
        "Invalid feed ID format. Must be 0x followed by 64 hex characters"
      );
    });

    it("should provide specific error for wrong length", () => {
      const wrongLength = "0x123";
      expect(() => validateFeedId(wrongLength)).toThrow(
        "Invalid feed ID format. Must be 0x followed by 64 hex characters"
      );
    });

    it("should provide specific error for unsupported version", () => {
      expect(() => validateFeedId(VALID_FEED_IDS.V1)).toThrow(
        "Invalid feed ID version. Must start with 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0x0008, 0x0009, 0x000a, 0x000b, 0x000c or 0x000d"
      );
    });

    it("should provide helpful error for empty input", () => {
      expect(() => validateFeedId("")).toThrow("Feed ID is required");
    });
  });

  describe("performance and efficiency", () => {
    it("should validate feed IDs efficiently", () => {
      const start = performance.now();

      // Validate 1000 feed IDs
      for (let i = 0; i < 1000; i++) {
        validateFeedId(VALID_FEED_IDS.V3);
      }

      const end = performance.now();
      const duration = end - start;

      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });

    it("should fail fast for obviously invalid inputs", () => {
      const start = performance.now();

      try {
        validateFeedId("");
      } catch {
        // Expected to throw
      }

      const end = performance.now();
      const duration = end - start;

      // Should fail very quickly (less than 1ms)
      expect(duration).toBeLessThan(1);
    });
  });

  describe("integration with validation constants", () => {
    it("should use the same regex patterns as constants", () => {
      // This test ensures our validation logic is consistent
      // We're testing the behavior rather than implementation details
      expect(() => validateFeedId(VALID_FEED_IDS.V3)).not.toThrow();
      expect(() => validateFeedId("invalid")).toThrow();
    });

    it("should support all documented feed versions", () => {
      // Test that our version validation matches what we claim to support
      expect(() => validateFeedId(VALID_FEED_IDS.V2)).not.toThrow(); // V2 supported
      expect(() => validateFeedId(VALID_FEED_IDS.V3)).not.toThrow(); // V3 supported
      expect(() => validateFeedId(VALID_FEED_IDS.V4)).not.toThrow(); // V4 supported
      expect(() => validateFeedId(VALID_FEED_IDS.V5)).not.toThrow();
      expect(() => validateFeedId(VALID_FEED_IDS.V6)).not.toThrow();
      expect(() => validateFeedId(VALID_FEED_IDS.V7)).not.toThrow();
      expect(() => validateFeedId(VALID_FEED_IDS.V8)).not.toThrow();
      expect(() => validateFeedId(VALID_FEED_IDS.V9)).not.toThrow();
      expect(() => validateFeedId(VALID_FEED_IDS.V10)).not.toThrow();
      expect(() => validateFeedId(VALID_FEED_IDS.V11)).not.toThrow();
      expect(() => validateFeedId(VALID_FEED_IDS.V12)).not.toThrow();
      expect(() => validateFeedId(VALID_FEED_IDS.V13)).not.toThrow();
      expect(() => validateFeedId(VALID_FEED_IDS.V1)).toThrow(); // V1 not supported in our implementation
    });
  });

  describe("real-world compatibility", () => {
    it("should accept feed IDs from examples", () => {
      // These are actual feed IDs used in tests
      const goSdkFeedIds = [
        "0x00020ffa644e6c585a5bec0e25ca476b6666666666e22b6240957720dcba0e14",
        "0x00020ffa644e6c585a88888825ca476b6666666666e22b6240957720dcba0e14",
      ];

      goSdkFeedIds.forEach(feedId => {
        expect(() => validateFeedId(feedId)).not.toThrow();
      });
    });

    it("should accept feed IDs from additional examples", () => {
      // These are additional test vectors
      const rustSdkFeedIds = [
        "0x00016b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472", // V1 (we reject)
        "0x00026b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472", // V2 (we accept)
        "0x00036b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472", // V3 (we accept)
        "0x00046b4aa7e57ca7b68ae1bf45653f56b656fd3aa335ef7fae696b663f1b8472", // V4 (we accept)
      ];

      // V1 is not supported in our implementation (we only support V2, V3, V4)
      expect(() => validateFeedId(rustSdkFeedIds[0])).toThrow(); // V1
      expect(() => validateFeedId(rustSdkFeedIds[1])).not.toThrow(); // V2
      expect(() => validateFeedId(rustSdkFeedIds[2])).not.toThrow(); // V3
      expect(() => validateFeedId(rustSdkFeedIds[3])).not.toThrow(); // V4
    });
  });
});
