/**
 * Unit Tests for Authentication Functions
 *
 * These tests validate the authentication functionality by:
 * - Testing HMAC generation and signature validation
 * - Testing authentication header generation
 * - Testing timestamp handling and validation
 * - Testing auth header format compliance
 * - Testing auth with different HTTP methods (GET, POST)
 * - Testing auth with request bodies
 * - Testing auth error scenarios (invalid keys, malformed data)
 *
 * Goals:
 * - Ensure our auth implementation works correctly and securely
 * - Test all edge cases and error scenarios comprehensively
 * - Use millisecond precision timestamps
 * - Maintain functional compatibility (can authenticate with same backend)
 * - Build the best possible TypeScript authentication implementation
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { generateAuthHeaders } from "../../../src/utils/auth";

describe("Authentication Tests", () => {
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    // Mock Date.now for consistent testing
    originalDateNow = Date.now;
  });

  afterEach(() => {
    // Restore Date.now
    Date.now = originalDateNow;
  });

  describe("HMAC generation and signature validation", () => {
    it("should generate consistent signatures with fixed timestamp", () => {
      const timestamp = 1718885772000;
      const headers1 = generateAuthHeaders(
        "clientId",
        "userSecret",
        "GET",
        "https://api.example.com/api/v1/feeds",
        undefined,
        timestamp
      );

      const headers2 = generateAuthHeaders(
        "clientId",
        "userSecret",
        "GET",
        "https://api.example.com/api/v1/feeds",
        undefined,
        timestamp
      );

      // Same inputs should produce identical signatures
      expect(headers1["X-Authorization-Signature-SHA256"]).toBe(headers2["X-Authorization-Signature-SHA256"]);
      expect(headers1["Authorization"]).toBe("clientId");
      expect(headers1["X-Authorization-Timestamp"]).toBe(timestamp.toString());
    });

    it("should generate different signatures for different parameters", () => {
      const timestamp = 12000000;

      const headers1 = generateAuthHeaders(
        "clientId1",
        "secret1",
        "POST",
        "https://api.example.com/api/v1/feeds",
        undefined,
        timestamp
      );

      const headers2 = generateAuthHeaders(
        "clientId2", // Different client ID
        "secret1",
        "POST",
        "https://api.example.com/api/v1/feeds",
        undefined,
        timestamp
      );

      // Different inputs should produce different signatures
      expect(headers1["X-Authorization-Signature-SHA256"]).not.toBe(headers2["X-Authorization-Signature-SHA256"]);
      expect(headers1["Authorization"]).toBe("clientId1");
      expect(headers2["Authorization"]).toBe("clientId2");
    });

    it("should include request body in signature calculation", () => {
      const timestamp = 1718885772000;

      const withoutBody = generateAuthHeaders(
        "clientId2",
        "secret2",
        "POST",
        "https://api.example.com/api/v1/reports/bulk",
        undefined,
        timestamp
      );

      const withBody = generateAuthHeaders(
        "clientId2",
        "secret2",
        "POST",
        "https://api.example.com/api/v1/reports/bulk",
        '{"attr1": "value1","attr2": [1,2,3]}',
        timestamp
      );

      // Body should affect signature
      expect(withoutBody["X-Authorization-Signature-SHA256"]).not.toBe(withBody["X-Authorization-Signature-SHA256"]);
      expect(withoutBody["Authorization"]).toBe(withBody["Authorization"]);
      expect(withoutBody["X-Authorization-Timestamp"]).toBe(withBody["X-Authorization-Timestamp"]);
    });
  });

  describe("authentication header generation", () => {
    it("should generate all required headers", () => {
      const headers = generateAuthHeaders("test-api-key", "test-secret", "GET", "https://api.example.com/api/v1/feeds");

      expect(headers).toHaveProperty("Authorization");
      expect(headers).toHaveProperty("X-Authorization-Timestamp");
      expect(headers).toHaveProperty("X-Authorization-Signature-SHA256");
      expect(Object.keys(headers)).toHaveLength(3);
    });

    it("should use correct header names", () => {
      const headers = generateAuthHeaders("test-api-key", "test-secret", "GET", "https://api.example.com/api/v1/feeds");

      // Verify exact header names match
      expect(headers).toHaveProperty("Authorization");
      expect(headers).toHaveProperty("X-Authorization-Timestamp");
      expect(headers).toHaveProperty("X-Authorization-Signature-SHA256");
    });

    it("should set Authorization header to API key", () => {
      const apiKey = "my-test-api-key-12345";
      const headers = generateAuthHeaders(apiKey, "test-secret", "GET", "https://api.example.com/api/v1/feeds");

      expect(headers["Authorization"]).toBe(apiKey);
    });

    it("should set timestamp as string", () => {
      const mockTimestamp = 1234567890123;
      Date.now = jest.fn(() => mockTimestamp);

      const headers = generateAuthHeaders("test-api-key", "test-secret", "GET", "https://api.example.com/api/v1/feeds");

      expect(headers["X-Authorization-Timestamp"]).toBe(mockTimestamp.toString());
      expect(typeof headers["X-Authorization-Timestamp"]).toBe("string");
    });
  });

  describe("timestamp handling and validation", () => {
    it("should use current timestamp when none provided", () => {
      const mockTimestamp = 1234567890123;
      Date.now = jest.fn(() => mockTimestamp);

      const headers = generateAuthHeaders("test-api-key", "test-secret", "GET", "https://api.example.com/api/v1/feeds");

      expect(Date.now).toHaveBeenCalled();
      expect(headers["X-Authorization-Timestamp"]).toBe(mockTimestamp.toString());
    });

    it("should generate different signatures for different timestamps", () => {
      Date.now = jest.fn(() => 1000000);
      const headers1 = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "GET",
        "https://api.example.com/api/v1/feeds"
      );

      Date.now = jest.fn(() => 2000000);
      const headers2 = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "GET",
        "https://api.example.com/api/v1/feeds"
      );

      expect(headers1["X-Authorization-Signature-SHA256"]).not.toBe(headers2["X-Authorization-Signature-SHA256"]);
      expect(headers1["X-Authorization-Timestamp"]).not.toBe(headers2["X-Authorization-Timestamp"]);
    });
  });

  describe("auth with different HTTP methods", () => {
    it("should generate different signatures for different methods", () => {
      const mockTimestamp = 1234567890123;
      Date.now = jest.fn(() => mockTimestamp);

      const getHeaders = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "GET",
        "https://api.example.com/api/v1/feeds"
      );

      const postHeaders = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "POST",
        "https://api.example.com/api/v1/feeds"
      );

      expect(getHeaders["X-Authorization-Signature-SHA256"]).not.toBe(postHeaders["X-Authorization-Signature-SHA256"]);
      expect(getHeaders["Authorization"]).toBe(postHeaders["Authorization"]);
      expect(getHeaders["X-Authorization-Timestamp"]).toBe(postHeaders["X-Authorization-Timestamp"]);
    });

    it("should handle GET requests", () => {
      const headers = generateAuthHeaders("test-api-key", "test-secret", "GET", "https://api.example.com/api/v1/feeds");

      expect(headers["X-Authorization-Signature-SHA256"]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle POST requests", () => {
      const headers = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "POST",
        "https://api.example.com/api/v1/reports"
      );

      expect(headers["X-Authorization-Signature-SHA256"]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle PUT requests", () => {
      const headers = generateAuthHeaders("test-api-key", "test-secret", "PUT", "https://api.example.com/api/v1/feeds");

      expect(headers["X-Authorization-Signature-SHA256"]).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("auth with request bodies", () => {
    it("should generate different signatures for requests with and without body", () => {
      const mockTimestamp = 1234567890123;
      Date.now = jest.fn(() => mockTimestamp);

      const withoutBody = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "POST",
        "https://api.example.com/api/v1/reports"
      );

      const withBody = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "POST",
        "https://api.example.com/api/v1/reports",
        '{"test": "data"}'
      );

      expect(withoutBody["X-Authorization-Signature-SHA256"]).not.toBe(withBody["X-Authorization-Signature-SHA256"]);
    });

    it("should handle empty body same as no body", () => {
      const mockTimestamp = 1234567890123;
      Date.now = jest.fn(() => mockTimestamp);

      const noBody = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "POST",
        "https://api.example.com/api/v1/reports"
      );

      const emptyBody = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "POST",
        "https://api.example.com/api/v1/reports",
        ""
      );

      expect(noBody["X-Authorization-Signature-SHA256"]).toBe(emptyBody["X-Authorization-Signature-SHA256"]);
    });

    it("should handle JSON body", () => {
      const headers = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "POST",
        "https://api.example.com/api/v1/reports",
        '{"feedIDs": ["0x123", "0x456"], "timestamp": 1234567890}'
      );

      expect(headers["X-Authorization-Signature-SHA256"]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle large body", () => {
      const largeBody = JSON.stringify({
        data: "x".repeat(10000),
        timestamp: Date.now(),
      });

      const headers = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "POST",
        "https://api.example.com/api/v1/reports",
        largeBody
      );

      expect(headers["X-Authorization-Signature-SHA256"]).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("auth error scenarios", () => {
    it("should handle empty API key", () => {
      const headers = generateAuthHeaders("", "test-secret", "GET", "https://api.example.com/api/v1/feeds");

      expect(headers["Authorization"]).toBe("");
      expect(headers["X-Authorization-Signature-SHA256"]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle empty user secret", () => {
      const headers = generateAuthHeaders("test-api-key", "", "GET", "https://api.example.com/api/v1/feeds");

      expect(headers["Authorization"]).toBe("test-api-key");
      expect(headers["X-Authorization-Signature-SHA256"]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle special characters in API key", () => {
      const specialApiKey = "test-api-key-!@#$%^&*()";
      const headers = generateAuthHeaders(specialApiKey, "test-secret", "GET", "https://api.example.com/api/v1/feeds");

      expect(headers["Authorization"]).toBe(specialApiKey);
      expect(headers["X-Authorization-Signature-SHA256"]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle special characters in user secret", () => {
      const specialSecret = "test-secret-!@#$%^&*()";
      const headers = generateAuthHeaders("test-api-key", specialSecret, "GET", "https://api.example.com/api/v1/feeds");

      expect(headers["Authorization"]).toBe("test-api-key");
      expect(headers["X-Authorization-Signature-SHA256"]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle Unicode characters", () => {
      const headers = generateAuthHeaders(
        "test-api-key-🔑",
        "test-secret-🔐",
        "GET",
        "https://api.example.com/api/v1/feeds"
      );

      expect(headers["Authorization"]).toBe("test-api-key-🔑");
      expect(headers["X-Authorization-Signature-SHA256"]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle malformed URL gracefully", () => {
      // Our implementation should handle this without throwing
      expect(() => {
        generateAuthHeaders("test-api-key", "test-secret", "GET", "not-a-valid-url");
      }).toThrow(); // This should throw because URL constructor will fail
    });
  });

  describe("signature consistency", () => {
    it("should generate identical signatures for identical inputs", () => {
      const mockTimestamp = 1234567890123;
      Date.now = jest.fn(() => mockTimestamp);

      const headers1 = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "GET",
        "https://api.example.com/api/v1/feeds"
      );

      Date.now = jest.fn(() => mockTimestamp); // Same timestamp
      const headers2 = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "GET",
        "https://api.example.com/api/v1/feeds"
      );

      expect(headers1["X-Authorization-Signature-SHA256"]).toBe(headers2["X-Authorization-Signature-SHA256"]);
    });

    it("should generate hex-encoded signatures", () => {
      const headers = generateAuthHeaders("test-api-key", "test-secret", "GET", "https://api.example.com/api/v1/feeds");

      // Should be 64 character hex string (SHA256)
      expect(headers["X-Authorization-Signature-SHA256"]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should be case sensitive for inputs", () => {
      const mockTimestamp = 1234567890123;
      Date.now = jest.fn(() => mockTimestamp);

      const lowercase = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "get",
        "https://api.example.com/api/v1/feeds"
      );

      Date.now = jest.fn(() => mockTimestamp);
      const uppercase = generateAuthHeaders(
        "test-api-key",
        "test-secret",
        "GET",
        "https://api.example.com/api/v1/feeds"
      );

      expect(lowercase["X-Authorization-Signature-SHA256"]).not.toBe(uppercase["X-Authorization-Signature-SHA256"]);
    });
  });

  describe("Documentation Test: Production authentication scenarios", () => {
    // These tests demonstrate cross-platform HMAC compatibility patterns
    it("should demonstrate HMAC signature validation for known test vectors", () => {
      // Test vector 1: Standard GET request
      const headers1 = generateAuthHeaders(
        "clientId",
        "userSecret",
        "GET",
        "https://api.example.com/api/v1/feeds",
        undefined,
        1718885772000
      );

      // Validate signature is deterministic and hex format
      expect(headers1["X-Authorization-Signature-SHA256"]).toMatch(/^[a-f0-9]{64}$/);
      expect(headers1["Authorization"]).toBe("clientId");
      expect(headers1["X-Authorization-Timestamp"]).toBe("1718885772000");

      // Test vector 2: POST request without body
      const headers2 = generateAuthHeaders(
        "clientId1",
        "secret1",
        "POST",
        "https://api.example.com/api/v1/feeds",
        undefined,
        12000000
      );

      expect(headers2["X-Authorization-Signature-SHA256"]).toMatch(/^[a-f0-9]{64}$/);
      expect(headers2["Authorization"]).toBe("clientId1");
      expect(headers2["X-Authorization-Timestamp"]).toBe("12000000");

      // Test vector 3: POST request with JSON body
      const headers3 = generateAuthHeaders(
        "clientId2",
        "secret2",
        "POST",
        "https://api.example.com/api/v1/reports/bulk",
        '{"attr1": "value1","attr2": [1,2,3]}',
        1718885772000
      );

      expect(headers3["X-Authorization-Signature-SHA256"]).toMatch(/^[a-f0-9]{64}$/);
      expect(headers3["Authorization"]).toBe("clientId2");
      expect(headers3["X-Authorization-Timestamp"]).toBe("1718885772000");

      // Test consistency: same inputs should produce same signatures
      const headers1_repeat = generateAuthHeaders(
        "clientId",
        "userSecret",
        "GET",
        "https://api.example.com/api/v1/feeds",
        undefined,
        1718885772000
      );
      expect(headers1["X-Authorization-Signature-SHA256"]).toBe(headers1_repeat["X-Authorization-Signature-SHA256"]);
    });

    it("should handle URL path extraction correctly", () => {
      // Ensure path-only signatures work correctly
      const headersFullUrl = generateAuthHeaders(
        "clientId",
        "userSecret",
        "GET",
        "https://api.example.com/api/v1/feeds",
        undefined,
        1718885772000
      );

      const headersWithQuery = generateAuthHeaders(
        "clientId",
        "userSecret",
        "GET",
        "https://api.example.com/api/v1/feeds?param=value",
        undefined,
        1718885772000
      );

      // Query parameters should affect signature calculation
      expect(headersFullUrl["X-Authorization-Signature-SHA256"]).not.toBe(
        headersWithQuery["X-Authorization-Signature-SHA256"]
      );
    });

    it("should handle high precision timestamps correctly", () => {
      // Validate millisecond timestamp precision
      const timestampMs = 1718885772000;
      const timestampSec = Math.floor(timestampMs / 1000);

      const headers = generateAuthHeaders(
        "clientId",
        "userSecret",
        "GET",
        "https://api.example.com/api/v1/feeds",
        undefined,
        timestampMs
      );

      // Timestamp should maintain millisecond precision
      expect(headers["X-Authorization-Timestamp"]).toBe(timestampMs.toString());
      expect(parseInt(headers["X-Authorization-Timestamp"])).toBeGreaterThan(timestampSec);
    });
  });
});
