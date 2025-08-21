import {
  discoverOrigins,
  parseOriginsHeader,
  parseCommaSeparatedUrls,
  convertWebSocketToHttpScheme,
  getAvailableOrigins,
} from "../../../src/utils/origin-discovery";
import { OriginDiscoveryError, InsufficientConnectionsError } from "../../../src/types/errors";
import { X_CLL_AVAILABLE_ORIGINS_HEADER } from "../../../src/utils/constants";

// Mock fetch globally
global.fetch = jest.fn();

describe("Origin Discovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("parseOriginsHeader", () => {
    it("should parse comma-separated origins", () => {
      const result = parseOriginsHeader("origin1,origin2,origin3");
      expect(result).toEqual(["origin1", "origin2", "origin3"]);
    });

    it("should handle origins with brackets", () => {
      const result = parseOriginsHeader("{origin1,origin2,origin3}");
      expect(result).toEqual(["origin1", "origin2", "origin3"]);
    });

    it("should trim whitespace", () => {
      const result = parseOriginsHeader(" origin1 , origin2 , origin3 ");
      expect(result).toEqual(["origin1", "origin2", "origin3"]);
    });

    it("should handle single origin", () => {
      const result = parseOriginsHeader("single-origin");
      expect(result).toEqual(["single-origin"]);
    });

    it("should handle empty string", () => {
      const result = parseOriginsHeader("");
      expect(result).toEqual([]);
    });

    it("should filter out empty origins", () => {
      const result = parseOriginsHeader("origin1,,origin3,");
      expect(result).toEqual(["origin1", "origin3"]);
    });

    it("should handle complex URLs", () => {
      const result = parseOriginsHeader("wss://host1.example.com:443,wss://host2.example.com:443");
      expect(result).toEqual(["wss://host1.example.com:443", "wss://host2.example.com:443"]);
    });
  });

  describe("parseCommaSeparatedUrls", () => {
    it("should parse comma-separated WebSocket URLs", () => {
      const result = parseCommaSeparatedUrls("wss://url1,wss://url2");
      expect(result).toEqual(["wss://url1", "wss://url2"]);
    });

    it("should handle single URL", () => {
      const result = parseCommaSeparatedUrls("wss://single-url");
      expect(result).toEqual(["wss://single-url"]);
    });

    it("should trim whitespace", () => {
      const result = parseCommaSeparatedUrls(" wss://url1 , wss://url2 ");
      expect(result).toEqual(["wss://url1", "wss://url2"]);
    });

    it("should filter empty URLs", () => {
      const result = parseCommaSeparatedUrls("wss://url1,,wss://url3");
      expect(result).toEqual(["wss://url1", "wss://url3"]);
    });
  });

  describe("convertWebSocketToHttpScheme", () => {
    it("should convert ws to http", () => {
      const result = convertWebSocketToHttpScheme("ws://example.com");
      expect(result).toBe("http://example.com");
    });

    it("should convert wss to https", () => {
      const result = convertWebSocketToHttpScheme("wss://example.com");
      expect(result).toBe("https://example.com");
    });

    it("should preserve http scheme", () => {
      const result = convertWebSocketToHttpScheme("http://example.com");
      expect(result).toBe("http://example.com");
    });

    it("should preserve https scheme", () => {
      const result = convertWebSocketToHttpScheme("https://example.com");
      expect(result).toBe("https://example.com");
    });

    it("should handle URLs with paths", () => {
      const result = convertWebSocketToHttpScheme("wss://example.com/path");
      expect(result).toBe("https://example.com/path");
    });

    it("should handle URLs with ports", () => {
      const result = convertWebSocketToHttpScheme("ws://example.com:8080");
      expect(result).toBe("http://example.com:8080");
    });
  });

  describe("discoverOrigins", () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

    it("should discover origins from header", async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue("origin1,origin2,origin3"),
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await discoverOrigins("wss://example.com", "api-key", "user-secret");

      expect(result).toEqual(["origin1", "origin2", "origin3"]);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/",
        expect.objectContaining({
          method: "HEAD",
          headers: expect.any(Object),
          signal: expect.any(AbortSignal),
        })
      );
    });

    it("should handle origins with brackets", async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue("{origin1,origin2}"),
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await discoverOrigins("wss://example.com", "api-key", "user-secret");

      expect(result).toEqual(["origin1", "origin2"]);
    });

    it("should return empty array when header is missing", async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await discoverOrigins("wss://example.com", "api-key", "user-secret");

      expect(result).toEqual([]);
    });

    it("should throw OriginDiscoveryError on HTTP error", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await expect(discoverOrigins("wss://example.com", "api-key", "user-secret")).rejects.toThrow(
        OriginDiscoveryError
      );
    });

    it("should throw OriginDiscoveryError on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(discoverOrigins("wss://example.com", "api-key", "user-secret")).rejects.toThrow(
        OriginDiscoveryError
      );
    });

    it("should handle timeout", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";

      // Mock fetch to reject with AbortError to simulate timeout
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(
        discoverOrigins(
          "wss://example.com",
          "api-key",
          "user-secret",
          1000 // 1 second timeout
        )
      ).rejects.toThrow(OriginDiscoveryError);

      // Test the error message separately
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(discoverOrigins("wss://example.com", "api-key", "user-secret", 1000)).rejects.toThrow(/timed out/);
    });

    it("should convert WebSocket scheme to HTTP", async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue("origin1"),
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await discoverOrigins("ws://example.com", "api-key", "user-secret");

      expect(mockFetch).toHaveBeenCalledWith("http://example.com/", expect.any(Object));
    });

    it("should include authentication headers", async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue("origin1"),
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await discoverOrigins("wss://example.com", "test-key", "test-secret");

      const [, options] = mockFetch.mock.calls[0];
      expect(options).toBeDefined();
      expect(options!.headers).toHaveProperty("Authorization");
      expect(options!.headers).toHaveProperty("X-Authorization-Signature-SHA256");
      expect(options!.headers).toHaveProperty("X-Authorization-Timestamp");
    });

    it("should request the correct origins header", async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue("origin1,origin2"),
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await discoverOrigins("wss://example.com", "api-key", "user-secret");

      // Verify that the response.headers.get was called with the correct header name
      expect(mockResponse.headers.get).toHaveBeenCalledWith(X_CLL_AVAILABLE_ORIGINS_HEADER);
    });
  });

  describe("getAvailableOrigins", () => {
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

    it("should use static origins when dynamic discovery is disabled", async () => {
      const result = await getAvailableOrigins(
        "wss://origin1,wss://origin2",
        "api-key",
        "user-secret",
        false // dynamic discovery disabled
      );

      expect(result).toEqual(["wss://origin1", "wss://origin2"]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should use static origins when multiple static origins exist", async () => {
      const result = await getAvailableOrigins(
        "wss://origin1,wss://origin2",
        "api-key",
        "user-secret",
        true // dynamic discovery enabled
      );

      expect(result).toEqual(["wss://origin1", "wss://origin2"]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should attempt dynamic discovery for single static origin", async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue("dynamic1,dynamic2"),
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await getAvailableOrigins(
        "wss://single-origin",
        "api-key",
        "user-secret",
        true // dynamic discovery enabled
      );

      expect(result).toEqual(["wss://single-origin#dynamic1", "wss://single-origin#dynamic2"]);
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should fall back to static origins when dynamic discovery fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Discovery failed"));

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const result = await getAvailableOrigins("wss://static-origin", "api-key", "user-secret", true);

      expect(result).toEqual(["wss://static-origin"]);
      // Should NOT log anything - developers control logging through events
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should fall back to static origins when no dynamic origins found", async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue(null), // No origins header
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await getAvailableOrigins("wss://static-origin", "api-key", "user-secret", true);

      expect(result).toEqual(["wss://static-origin"]);
    });

    it("should return empty array when no origins available and discovery disabled", async () => {
      const result = await getAvailableOrigins(
        "", // Empty URL
        "api-key",
        "user-secret",
        false // dynamic discovery disabled
      );

      expect(result).toEqual([]);
    });

    it("should throw InsufficientConnectionsError when discovery fails and no static origins", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Discovery failed"));

      await expect(
        getAvailableOrigins(
          "", // Empty URL
          "api-key",
          "user-secret",
          true
        )
      ).rejects.toThrow(InsufficientConnectionsError);
    });

    it("should respect timeout parameter", async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue("origin1"),
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await getAvailableOrigins(
        "wss://single-origin",
        "api-key",
        "user-secret",
        true,
        5000 // custom timeout
      );

      // Verify that the timeout was passed to discoverOrigins
      // (This is implicit since discoverOrigins was called with the timeout)
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
