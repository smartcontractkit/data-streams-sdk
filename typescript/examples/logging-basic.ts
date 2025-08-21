/**
 * Basic logging configuration example
 *
 * This example demonstrates comprehensive logging configuration options:
 * - Basic console logging setup
 * - Log level filtering and control
 * - Connection debug controls for WebSocket troubleshooting
 * - Integration patterns with external loggers (winston, pino, etc.)
 * - Production vs development logging strategies
 */

import { createClient, LogLevel } from "../src";
import { getReportVersion } from "../src/utils/report";

async function demonstrateLogging() {
  console.log("🎛️ Data Streams SDK - Logging Configuration Examples\n");

  // =====================================================
  // Example 1: Silent Mode (Default)
  // =====================================================
  console.log("1️⃣ Silent Mode (Default - Zero Overhead)");
  const silentClient = createClient({
    apiKey: process.env.API_KEY!,
    userSecret: process.env.USER_SECRET!,
    endpoint: "https://api.testnet-dataengine.chain.link",
    wsEndpoint: "wss://ws.testnet-dataengine.chain.link",
    // No logging config = silent mode
  });

  console.log("✅ Silent client created (no logs will appear)\n");

  // =====================================================
  // Example 2: Basic Console Logging
  // =====================================================
  console.log("2️⃣ Basic Console Logging");
  const basicClient = createClient({
    apiKey: process.env.API_KEY!,
    userSecret: process.env.USER_SECRET!,
    endpoint: "https://api.testnet-dataengine.chain.link",
    wsEndpoint: "wss://ws.testnet-dataengine.chain.link",
    logging: {
      logger: {
        info: console.log,
        warn: console.warn,
        error: console.error,
      },
    },
  });

  console.log("✅ Basic console logging enabled\n");

  // =====================================================
  // Example 3: Advanced Logging with Level Control
  // =====================================================
  console.log("3️⃣ Advanced Logging with Level Control");
  const advancedClient = createClient({
    apiKey: process.env.API_KEY!,
    userSecret: process.env.USER_SECRET!,
    endpoint: "https://api.testnet-dataengine.chain.link",
    wsEndpoint: "wss://ws.testnet-dataengine.chain.link",
    logging: {
      logger: {
        debug: (msg, ...args) => console.log("🐛 DEBUG:", msg, ...args),
        info: (msg, ...args) => console.log("ℹ️ INFO:", msg, ...args),
        warn: (msg, ...args) => console.log("⚠️ WARN:", msg, ...args),
        error: (msg, ...args) => console.log("❌ ERROR:", msg, ...args),
      },
      logLevel: LogLevel.INFO, // Only INFO, WARN, ERROR (no DEBUG)
      enableConnectionDebug: false, // WebSocket debugging off
    },
  });

  console.log("✅ Advanced logging configured\n");

  // =====================================================
  // Example 4: Development Mode (Full Debugging)
  // =====================================================
  console.log("4️⃣ Development Mode (Full Debugging)");
  const devClient = createClient({
    apiKey: process.env.API_KEY!,
    userSecret: process.env.USER_SECRET!,
    endpoint: "https://api.testnet-dataengine.chain.link",
    wsEndpoint: "wss://ws.testnet-dataengine.chain.link",
    logging: {
      logger: {
        debug: (msg, ...args) => console.log("🔍 DEBUG:", msg, ...args),
        info: (msg, ...args) => console.log("📝 INFO:", msg, ...args),
        warn: (msg, ...args) => console.log("⚠️ WARN:", msg, ...args),
        error: (msg, ...args) => console.log("💥 ERROR:", msg, ...args),
      },
      logLevel: LogLevel.DEBUG, // Show everything
      enableConnectionDebug: true, // Show WebSocket ping/pong
    },
  });

  console.log("✅ Development mode logging enabled\n");

  // =====================================================
  // Example 5: Production-Ready Structured Logging
  // =====================================================
  console.log("5️⃣ Production-Ready Structured Logging");

  // Simulate structured logger (like winston/pino)
  const structuredLogger = {
    debug: (msg: string, ...args: any[]) => {
      console.log(
        JSON.stringify({
          level: "debug",
          timestamp: new Date().toISOString(),
          message: msg,
          data: args,
          service: "data-streams-sdk",
        })
      );
    },
    info: (msg: string, ...args: any[]) => {
      console.log(
        JSON.stringify({
          level: "info",
          timestamp: new Date().toISOString(),
          message: msg,
          data: args,
          service: "data-streams-sdk",
        })
      );
    },
    warn: (msg: string, ...args: any[]) => {
      console.log(
        JSON.stringify({
          level: "warn",
          timestamp: new Date().toISOString(),
          message: msg,
          data: args,
          service: "data-streams-sdk",
        })
      );
    },
    error: (msg: string, ...args: any[]) => {
      console.log(
        JSON.stringify({
          level: "error",
          timestamp: new Date().toISOString(),
          message: msg,
          data: args,
          service: "data-streams-sdk",
        })
      );
    },
  };

  const prodClient = createClient({
    apiKey: process.env.API_KEY!,
    userSecret: process.env.USER_SECRET!,
    endpoint: "https://api.testnet-dataengine.chain.link",
    wsEndpoint: "wss://ws.testnet-dataengine.chain.link",
    logging: {
      logger: structuredLogger,
      logLevel: LogLevel.INFO,
      enableConnectionDebug: false,
    },
  });

  console.log("✅ Production structured logging enabled\n");

  // =====================================================
  // Example 6: Error-Resilient Logging
  // =====================================================
  console.log("6️⃣ Error-Resilient Logging");

  const faultyLogger = {
    info: (msg: string) => {
      throw new Error("Logger is broken!");
    },
    error: console.error, // This one works
  };

  const resilientClient = createClient({
    apiKey: process.env.API_KEY!,
    userSecret: process.env.USER_SECRET!,
    endpoint: "https://api.testnet-dataengine.chain.link",
    wsEndpoint: "wss://ws.testnet-dataengine.chain.link",
    logging: {
      logger: faultyLogger,
    },
  });

  console.log("✅ Error-resilient client created (SDK won't crash if logger fails)\n");

  // =====================================================
  // Demonstrate API Calls with Logging
  // =====================================================
  console.log("🚀 Testing API calls with different logging configurations:\n");

  try {
    console.log("📡 Fetching feeds with advanced logging...");
    const feeds = await advancedClient.listFeeds();
    console.log(`📊 Retrieved ${feeds.length} feeds\n`);

    if (feeds.length > 0) {
      console.log("📈 Creating stream with development logging...");
      const stream = devClient.createStream([feeds[0].feedID]);

      // Set up event listeners
      stream.on("report", report => {
        console.log("📝 Received report:", {
          feedID: report.feedID,
          version: getReportVersion(report.feedID),
          timestamp: report.observationsTimestamp,
        });
      });

      stream.on("error", error => {
        console.log("❌ Stream error:", error.message);
      });

      console.log("✅ Stream configured (would connect in real usage)");

      // Close stream to prevent hanging
      await stream.close();
      console.log("🔌 Stream closed to allow demo to exit\n");
    }
  } catch (error) {
    console.log("⚠️ Demo error (expected in demo environment):", (error as Error).message);
  }

  // =====================================================
  // Best Practices Summary
  // =====================================================
  console.log("💡 Logging Best Practices:\n");
  console.log("✅ Use silent mode in production unless debugging");
  console.log("✅ Enable INFO level for general monitoring");
  console.log("✅ Enable DEBUG level only during development");
  console.log("✅ Use enableConnectionDebug for WebSocket issues");
  console.log("✅ Integrate with your existing logging infrastructure");
  console.log("✅ Logger failures won't crash your application");
  console.log("✅ Zero performance overhead when logging is disabled\n");

  console.log("🎉 Logging configuration examples completed!");
}

// Handle environment check
if (!process.env.API_KEY || !process.env.USER_SECRET) {
  console.log("⚠️ Environment variables API_KEY and USER_SECRET are required");
  console.log("Set them with: export API_KEY='your_key' && export USER_SECRET='your_secret'");
  console.log("This example will still demonstrate logging configuration without API calls.\n");
}

// Run the demonstration
demonstrateLogging().catch(error => {
  console.error("❌ Demo failed:", error);
  process.exit(1);
});
