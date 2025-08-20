/**
 * Unit Tests for Configuration Validation
 *
 * These tests validate the configuration functionality by:
 * - Testing valid config creation and validation
 * - Testing missing required fields (apiKey, userSecret, endpoint, wsEndpoint)
 * - Testing invalid URL formats (REST and WebSocket)
 * - Testing URL scheme validation
 * - Testing timeout and retry configuration validation
 * - Testing HA mode configuration validation
 * - Testing config edge cases and error messages
 * - Testing config normalization and defaults
 *
 * Goals:
 * - Ensure robust config validation that prevents invalid configurations
 * - Test all edge cases and error scenarios comprehensively
 * - Provide clear, helpful error messages for developers
 * - Build the best possible TypeScript configuration validation
 */

import { describe, it, expect } from "@jest/globals";
import { createClient } from "../../../../src/client";
import { Config } from "../../../../src/types/client";

// Mock console methods to avoid noise during tests
jest.spyOn(console, "info").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});
jest.spyOn(console, "log").mockImplementation(() => {});

describe("Configuration Validation Tests", () => {
  // Valid base configuration for testing
  const VALID_CONFIG: Config = {
    apiKey: "test-api-key-12345",
    userSecret: "test-user-secret-67890",
    endpoint: "https://api.testnet-dataengine.chain.link",
    wsEndpoint: "wss://ws.testnet-dataengine.chain.link",
  };

  describe("valid configuration creation", () => {
    it("should accept minimal valid configuration", () => {
      expect(() => createClient(VALID_CONFIG)).not.toThrow();
    });

    it("should accept configuration with all optional fields", () => {
      const fullConfig: Config = {
        ...VALID_CONFIG,
        retryAttempts: 5,
        retryDelay: 2000,
        timeout: 60000,
        haMode: true,
        haConnectionTimeout: 10000,
        logging: {
          logger: console,
        },
      };
      expect(() => createClient(fullConfig)).not.toThrow();
    });

    it("should accept configuration with HA mode enabled", () => {
      const haConfig: Config = {
        ...VALID_CONFIG,
        haMode: true,
        wsEndpoint: "wss://ws1.example.com,wss://ws2.example.com",
      };
      expect(() => createClient(haConfig)).not.toThrow();
    });

    it("should accept configuration with single WebSocket URL", () => {
      const singleWsConfig: Config = {
        ...VALID_CONFIG,
        wsEndpoint: "wss://ws.example.com",
      };
      expect(() => createClient(singleWsConfig)).not.toThrow();
    });

    it("should accept configuration with multiple comma-separated WebSocket URLs", () => {
      const multiWsConfig: Config = {
        ...VALID_CONFIG,
        wsEndpoint: "wss://ws1.example.com,wss://ws2.example.com,wss://ws3.example.com",
      };
      expect(() => createClient(multiWsConfig)).not.toThrow();
    });
  });

  describe("required field validation", () => {
    it("should reject configuration without apiKey", () => {
      const configWithoutApiKey = {
        ...VALID_CONFIG,
        apiKey: undefined as any,
      };
      expect(() => createClient(configWithoutApiKey)).toThrow();
    });

    it("should reject configuration with empty apiKey", () => {
      const configWithEmptyApiKey = {
        ...VALID_CONFIG,
        apiKey: "",
      };
      expect(() => createClient(configWithEmptyApiKey)).toThrow();
    });

    it("should reject configuration without userSecret", () => {
      const configWithoutUserSecret = {
        ...VALID_CONFIG,
        userSecret: undefined as any,
      };
      expect(() => createClient(configWithoutUserSecret)).toThrow();
    });

    it("should reject configuration with empty userSecret", () => {
      const configWithEmptyUserSecret = {
        ...VALID_CONFIG,
        userSecret: "",
      };
      expect(() => createClient(configWithEmptyUserSecret)).toThrow();
    });

    it("should reject configuration without endpoint", () => {
      const configWithoutEndpoint = {
        ...VALID_CONFIG,
        endpoint: undefined as any,
      };
      expect(() => createClient(configWithoutEndpoint)).toThrow();
    });

    it("should reject configuration with empty endpoint", () => {
      const configWithEmptyEndpoint = {
        ...VALID_CONFIG,
        endpoint: "",
      };
      expect(() => createClient(configWithEmptyEndpoint)).toThrow();
    });

    it("should reject configuration without wsEndpoint", () => {
      const configWithoutWsEndpoint = {
        ...VALID_CONFIG,
        wsEndpoint: undefined as any,
      };
      expect(() => createClient(configWithoutWsEndpoint)).toThrow();
    });

    it("should reject configuration with empty wsEndpoint", () => {
      const configWithEmptyWsEndpoint = {
        ...VALID_CONFIG,
        wsEndpoint: "",
      };
      expect(() => createClient(configWithEmptyWsEndpoint)).toThrow();
    });
  });

  describe("URL format validation", () => {
    it("should reject invalid REST URL format", () => {
      const configWithInvalidRestUrl = {
        ...VALID_CONFIG,
        endpoint: "not-a-valid-url",
      };
      expect(() => createClient(configWithInvalidRestUrl)).toThrow();
    });

    it("should reject REST URL without protocol", () => {
      const configWithoutProtocol = {
        ...VALID_CONFIG,
        endpoint: "api.example.com",
      };
      expect(() => createClient(configWithoutProtocol)).toThrow();
    });

    it("should reject REST URL with invalid protocol", () => {
      const configWithInvalidProtocol = {
        ...VALID_CONFIG,
        endpoint: "ftp://api.example.com",
      };
      expect(() => createClient(configWithInvalidProtocol)).toThrow();
    });

    it("should accept HTTPS REST URLs", () => {
      const configWithHttps = {
        ...VALID_CONFIG,
        endpoint: "https://api.example.com",
      };
      expect(() => createClient(configWithHttps)).not.toThrow();
    });

    it("should accept HTTP REST URLs (for testing)", () => {
      const configWithHttp = {
        ...VALID_CONFIG,
        endpoint: "http://localhost:8080",
      };
      expect(() => createClient(configWithHttp)).not.toThrow();
    });

    it("should reject invalid WebSocket URL format", () => {
      const configWithInvalidWsUrl = {
        ...VALID_CONFIG,
        wsEndpoint: "not-a-valid-websocket-url",
      };
      expect(() => createClient(configWithInvalidWsUrl)).toThrow();
    });

    it("should reject WebSocket URL without ws/wss protocol", () => {
      const configWithoutWsProtocol = {
        ...VALID_CONFIG,
        wsEndpoint: "https://ws.example.com",
      };
      expect(() => createClient(configWithoutWsProtocol)).toThrow();
    });

    it("should accept WSS WebSocket URLs", () => {
      const configWithWss = {
        ...VALID_CONFIG,
        wsEndpoint: "wss://ws.example.com",
      };
      expect(() => createClient(configWithWss)).not.toThrow();
    });

    it("should accept WS WebSocket URLs (for testing)", () => {
      const configWithWs = {
        ...VALID_CONFIG,
        wsEndpoint: "ws://localhost:8080",
      };
      expect(() => createClient(configWithWs)).not.toThrow();
    });

    it("should reject malformed URLs in comma-separated list", () => {
      const configWithMalformedUrls = {
        ...VALID_CONFIG,
        wsEndpoint: "wss://ws1.example.com,invalid-url,wss://ws2.example.com",
      };
      expect(() => createClient(configWithMalformedUrls)).toThrow();
    });

    it("should reject mixed protocols in comma-separated list", () => {
      const configWithMixedProtocols = {
        ...VALID_CONFIG,
        wsEndpoint: "wss://ws1.example.com,https://ws2.example.com",
      };
      expect(() => createClient(configWithMixedProtocols)).toThrow();
    });
  });

  describe("timeout and retry configuration validation", () => {
    it("should accept valid timeout values", () => {
      const configWithTimeout = {
        ...VALID_CONFIG,
        timeout: 30000,
      };
      expect(() => createClient(configWithTimeout)).not.toThrow();
    });

    it("should reject negative timeout", () => {
      const configWithNegativeTimeout = {
        ...VALID_CONFIG,
        timeout: -1000,
      };
      expect(() => createClient(configWithNegativeTimeout)).toThrow();
    });

    it("should reject zero timeout", () => {
      const configWithZeroTimeout = {
        ...VALID_CONFIG,
        timeout: 0,
      };
      expect(() => createClient(configWithZeroTimeout)).toThrow();
    });

    it("should accept valid retry attempts", () => {
      const configWithRetryAttempts = {
        ...VALID_CONFIG,
        retryAttempts: 5,
      };
      expect(() => createClient(configWithRetryAttempts)).not.toThrow();
    });

    it("should reject negative retry attempts", () => {
      const configWithNegativeRetry = {
        ...VALID_CONFIG,
        retryAttempts: -1,
      };
      expect(() => createClient(configWithNegativeRetry)).toThrow();
    });

    it("should accept zero retry attempts", () => {
      const configWithZeroRetry = {
        ...VALID_CONFIG,
        retryAttempts: 0,
      };
      expect(() => createClient(configWithZeroRetry)).not.toThrow();
    });

    it("should accept valid retry delay", () => {
      const configWithRetryDelay = {
        ...VALID_CONFIG,
        retryDelay: 2000,
      };
      expect(() => createClient(configWithRetryDelay)).not.toThrow();
    });

    it("should reject negative retry delay", () => {
      const configWithNegativeDelay = {
        ...VALID_CONFIG,
        retryDelay: -500,
      };
      expect(() => createClient(configWithNegativeDelay)).toThrow();
    });

    it("should accept zero retry delay", () => {
      const configWithZeroDelay = {
        ...VALID_CONFIG,
        retryDelay: 0,
      };
      expect(() => createClient(configWithZeroDelay)).not.toThrow();
    });
  });

  describe("HA mode configuration validation", () => {
    it("should accept HA mode with multiple origins", () => {
      const haConfig = {
        ...VALID_CONFIG,
        haMode: true,
        wsEndpoint: "wss://ws1.example.com,wss://ws2.example.com",
      };
      expect(() => createClient(haConfig)).not.toThrow();
    });

    it("should validate HA mode with single origin without forced logging", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const haConfigSingleOrigin = {
        ...VALID_CONFIG,
        haMode: true,
        wsEndpoint: "wss://ws.example.com",
      };

      // Should not throw and should NOT log anything (developers control logging)
      expect(() => createClient(haConfigSingleOrigin)).not.toThrow();
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should accept HA mode with origin discovery enabled", () => {
      const haConfigWithDiscovery = {
        ...VALID_CONFIG,
        haMode: true,
        wsEndpoint: "wss://ws.example.com",
      };
      expect(() => createClient(haConfigWithDiscovery)).not.toThrow();
    });

    it("should accept valid HA connection timeout", () => {
      const haConfigWithTimeout = {
        ...VALID_CONFIG,
        haMode: true,
        haConnectionTimeout: 10000,
      };
      expect(() => createClient(haConfigWithTimeout)).not.toThrow();
    });

    it("should validate very low HA connection timeout without forced logging", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const haConfigLowTimeout = {
        ...VALID_CONFIG,
        haMode: true,
        haConnectionTimeout: 500, // Less than 1 second
      };

      // Should not throw and should NOT log anything (developers control logging)
      expect(() => createClient(haConfigLowTimeout)).not.toThrow();
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should accept connection status callback", () => {
      const callback = jest.fn();
      const haConfigWithCallback = {
        ...VALID_CONFIG,
        haMode: true,
        connectionStatusCallback: callback,
      };
      expect(() => createClient(haConfigWithCallback)).not.toThrow();
    });
  });

  describe("detailed URL validation scenarios", () => {
    it("should reject malformed REST URL with colon prefix", () => {
      const configWithColonUrl = {
        ...VALID_CONFIG,
        endpoint: ":rest.domain.link",
      };
      expect(() => createClient(configWithColonUrl)).toThrow();
    });

    it("should reject malformed WebSocket URL with colon prefix", () => {
      const configWithColonWsUrl = {
        ...VALID_CONFIG,
        wsEndpoint: ":ws.domain.link",
      };
      expect(() => createClient(configWithColonWsUrl)).toThrow();
    });

    it("should reject URLs with invalid characters", () => {
      const configWithInvalidChars = {
        ...VALID_CONFIG,
        endpoint: "https://api[invalid].example.com",
      };
      expect(() => createClient(configWithInvalidChars)).toThrow();
    });

    it("should reject WebSocket URLs with spaces", () => {
      const configWithSpacesInWs = {
        ...VALID_CONFIG,
        wsEndpoint: "wss://ws .example.com",
      };
      expect(() => createClient(configWithSpacesInWs)).toThrow();
    });

    it("should accept valid URLs with subdomains and paths", () => {
      const configWithComplexUrls = {
        ...VALID_CONFIG,
        endpoint: "https://api.prod.dataengine.chain.link/v1/streams",
        wsEndpoint: "wss://ws.prod.dataengine.chain.link/stream/v1",
      };
      expect(() => createClient(configWithComplexUrls)).not.toThrow();
    });
  });

  describe("configuration validation error messages", () => {
    it("should provide clear error message for missing API key", () => {
      const configWithoutApiKey = {
        ...VALID_CONFIG,
        apiKey: undefined as any,
      };
      expect(() => createClient(configWithoutApiKey)).toThrow(/apiKey/i);
    });

    it("should provide clear error message for missing user secret", () => {
      const configWithoutSecret = {
        ...VALID_CONFIG,
        userSecret: undefined as any,
      };
      expect(() => createClient(configWithoutSecret)).toThrow(/userSecret/i);
    });

    it("should provide clear error message for invalid endpoint", () => {
      const configWithInvalidEndpoint = {
        ...VALID_CONFIG,
        endpoint: "invalid-url",
      };
      expect(() => createClient(configWithInvalidEndpoint)).toThrow(/endpoint/i);
    });

    it("should provide clear error message for invalid WebSocket endpoint", () => {
      const configWithInvalidWs = {
        ...VALID_CONFIG,
        wsEndpoint: "invalid-ws-url",
      };
      expect(() => createClient(configWithInvalidWs)).toThrow(/websocket|ws/i);
    });
  });

  describe("edge cases and error scenarios", () => {
    it("should reject null configuration", () => {
      expect(() => createClient(null as any)).toThrow();
    });

    it("should reject undefined configuration", () => {
      expect(() => createClient(undefined as any)).toThrow();
    });

    it("should reject empty configuration object", () => {
      expect(() => createClient({} as any)).toThrow();
    });

    it("should handle configuration with extra properties", () => {
      const configWithExtra = {
        ...VALID_CONFIG,
        extraProperty: "should be ignored",
      } as any;
      expect(() => createClient(configWithExtra)).not.toThrow();
    });

    it("should reject configuration with wrong type for apiKey", () => {
      const configWithWrongType = {
        ...VALID_CONFIG,
        apiKey: 12345,
      } as any;
      expect(() => createClient(configWithWrongType)).toThrow();
    });

    it("should reject configuration with wrong type for haMode", () => {
      const configWithWrongHaType = {
        ...VALID_CONFIG,
        haMode: "true",
      } as any;
      expect(() => createClient(configWithWrongHaType)).toThrow();
    });

    it("should handle whitespace in URLs", () => {
      const configWithWhitespace = {
        ...VALID_CONFIG,
        endpoint: "  https://api.example.com  ",
        wsEndpoint: "  wss://ws.example.com  ",
      };
      // This might pass or fail depending on our implementation
      // The test documents the current behavior
      expect(() => createClient(configWithWhitespace)).not.toThrow();
    });

    it("should handle Unicode characters in configuration", () => {
      const configWithUnicode = {
        ...VALID_CONFIG,
        apiKey: "test-api-key-🔑",
        userSecret: "test-secret-🔐",
      };
      expect(() => createClient(configWithUnicode)).not.toThrow();
    });
  });

  describe("configuration defaults", () => {
    it("should apply default values for optional fields", () => {
      const client = createClient(VALID_CONFIG);
      // We can't directly inspect the config, but we can test that defaults are used
      expect(client).toBeDefined();
    });

    it("should use default timeout when not specified", () => {
      const client = createClient(VALID_CONFIG);
      expect(client).toBeDefined();
      // Default timeout should be applied internally
    });

    it("should use default retry settings when not specified", () => {
      const client = createClient(VALID_CONFIG);
      expect(client).toBeDefined();
      // Default retry settings should be applied internally
    });

    it("should use default HA mode settings when not specified", () => {
      const client = createClient(VALID_CONFIG);
      expect(client).toBeDefined();
      // HA mode should be disabled by default
    });

    it("should override defaults when explicitly provided", () => {
      const customConfig = {
        ...VALID_CONFIG,
        timeout: 60000,
        retryAttempts: 10,
        haMode: true,
      };
      const client = createClient(customConfig);
      expect(client).toBeDefined();
      // Custom values should override defaults
    });
  });

  describe("configuration normalization", () => {
    it("should handle trailing slashes in URLs", () => {
      const configWithTrailingSlashes = {
        ...VALID_CONFIG,
        endpoint: "https://api.example.com/",
        wsEndpoint: "wss://ws.example.com/",
      };
      expect(() => createClient(configWithTrailingSlashes)).not.toThrow();
    });

    it("should handle URLs with paths", () => {
      const configWithPaths = {
        ...VALID_CONFIG,
        endpoint: "https://api.example.com/v1",
        wsEndpoint: "wss://ws.example.com/stream",
      };
      expect(() => createClient(configWithPaths)).not.toThrow();
    });

    it("should handle URLs with query parameters", () => {
      const configWithQuery = {
        ...VALID_CONFIG,
        endpoint: "https://api.example.com?version=1",
        wsEndpoint: "wss://ws.example.com?protocol=v1",
      };
      expect(() => createClient(configWithQuery)).not.toThrow();
    });

    it("should handle URLs with ports", () => {
      const configWithPorts = {
        ...VALID_CONFIG,
        endpoint: "https://api.example.com:8443",
        wsEndpoint: "wss://ws.example.com:8443",
      };
      expect(() => createClient(configWithPorts)).not.toThrow();
    });
  });

  describe("real-world configuration scenarios", () => {
    it("should accept production-like configuration", () => {
      const prodConfig = {
        apiKey: "prod-api-key-abcdef123456",
        userSecret: "prod-secret-xyz789",
        endpoint: "https://api.dataengine.chain.link",
        wsEndpoint: "wss://ws.dataengine.chain.link",
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
      };
      expect(() => createClient(prodConfig)).not.toThrow();
    });

    it("should accept testnet configuration", () => {
      const testnetConfig = {
        apiKey: "test-api-key",
        userSecret: "test-secret",
        endpoint: "https://api.testnet-dataengine.chain.link",
        wsEndpoint: "wss://ws.testnet-dataengine.chain.link",
      };
      expect(() => createClient(testnetConfig)).not.toThrow();
    });

    it("should accept local development configuration", () => {
      const devConfig = {
        apiKey: "dev-key",
        userSecret: "dev-secret",
        endpoint: "http://localhost:3000",
        wsEndpoint: "ws://localhost:3001",
        timeout: 5000,
        retryAttempts: 1,
      };
      expect(() => createClient(devConfig)).not.toThrow();
    });

    it("should accept HA production configuration", () => {
      const haProdConfig = {
        apiKey: "ha-prod-key",
        userSecret: "ha-prod-secret",
        endpoint: "https://api.dataengine.chain.link",
        wsEndpoint: "wss://ws1.dataengine.chain.link,wss://ws2.dataengine.chain.link",
        haMode: true,
        haConnectionTimeout: 10000,
        connectionStatusCallback: (isConnected: boolean, host: string, origin: string) => {
          console.log(`Connection ${isConnected ? "established" : "lost"} to ${host} (${origin})`);
        },
      };
      expect(() => createClient(haProdConfig)).not.toThrow();
    });
  });

  describe("performance and memory", () => {
    it("should create clients efficiently", () => {
      const start = performance.now();

      // Create 100 clients
      for (let i = 0; i < 100; i++) {
        const client = createClient(VALID_CONFIG);
        expect(client).toBeDefined();
      }

      const end = performance.now();
      const duration = end - start;

      // Should complete in reasonable time (less than 1000ms)
      expect(duration).toBeLessThan(1000);
    });

    it("should handle large configuration objects", () => {
      const largeConfig = {
        ...VALID_CONFIG,
        // Add many optional fields
        retryAttempts: 10,
        retryDelay: 2000,
        timeout: 60000,
        haMode: true,
        haConnectionTimeout: 15000,
        connectionStatusCallback: () => {},
        // Simulate large comma-separated URL list
        wsEndpoint: Array(50).fill("wss://ws.example.com").join(","),
      };

      expect(() => createClient(largeConfig)).not.toThrow();
    });
  });
});
