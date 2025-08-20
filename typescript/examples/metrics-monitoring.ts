/**
 * Metrics Monitoring Example
 *
 * Demonstrates how to use the metrics API for monitoring and observability.
 *
 * Note: This example uses HA mode (haMode: true) which requires mainnet endpoints.
 * HA mode provides multiple connections for comprehensive metrics demonstration.
 * For testnet usage, set haMode: false and use testnet endpoints.
 */

import { createClient, MetricsSnapshot, ConnectionStatus, decodeReport } from "../src";

async function monitoringExample() {
  // Create client with HA mode for comprehensive metrics
  const client = createClient({
    apiKey: process.env.API_KEY || "YOUR_API_KEY",
    userSecret: process.env.USER_SECRET || "YOUR_USER_SECRET",
    endpoint: "https://api.dataengine.chain.link",
    wsEndpoint: "wss://ws.dataengine.chain.link",
    haMode: true,
    // Advanced connection monitoring with origin tracking
    connectionStatusCallback: (isConnected, host, origin) => {
      const timestamp = new Date().toISOString().substring(11, 19);
      const status = isConnected ? "🟢 UP" : "🔴 DOWN";
      console.log(`[${timestamp}] ${status} ${host}${origin || ""}`);

      // Example: Send alerts for specific origins
      if (!isConnected && origin) {
        console.warn(`⚠️ Alert: Origin ${origin} on ${host} went offline`);
      }
    },
    logging: {
      logger: {
        info: console.log,
        error: console.error,
        debug: console.debug,
        warn: console.warn,
      },
    },
  });

  const stream = client.createStream([
    "0x00039d9e45394f473ab1f050a1b963e6b05351e52d71e507509ada0c95ed75b8", // BTC/USD Mainnet
  ]);

  // Track when to show first dashboard
  let hasShownInitialDashboard = false;

  // Set up event handlers
  stream.on("report", report => {
    // Decode the report to get the price
    const decodedReport = decodeReport(report.fullReport, report.feedID);
    const price =
      (decodedReport as { price?: bigint | string; benchmarkPrice?: bigint | string }).price ||
      (decodedReport as { price?: bigint | string; benchmarkPrice?: bigint | string }).benchmarkPrice ||
      "N/A";
    const priceStr = typeof price === "bigint" ? price.toString() : price;
    console.log(`📊 Report received: ${report.feedID} = ${priceStr}`);

    // Get metrics after each report
    const metrics = stream.getMetrics();
    const deduplicationRate = ((metrics.deduplicated / metrics.totalReceived) * 100).toFixed(1);
    console.log(
      `📈 Reports: ${metrics.accepted} unique, ${metrics.deduplicated} duplicates (${deduplicationRate}% dedup rate)`
    );

    // Show dashboard after 10 accepted reports for quick feedback
    if (!hasShownInitialDashboard && metrics.accepted >= 10) {
      hasShownInitialDashboard = true;
      console.log("\n" + "=".repeat(50));
      console.log("📊 INITIAL METRICS DASHBOARD (after 10 reports)");
      console.log("=".repeat(50));
      logMetrics(stream);
    }
  });

  stream.on("error", error => {
    console.error("🚨 Stream error:", error);
    logMetrics(stream);
  });

  stream.on("disconnected", () => {
    console.warn("⚠️ Stream disconnected - all connections lost");
    logMetrics(stream);
  });

  // Connect and start monitoring
  await stream.connect();
  console.log("🔌 Stream connected successfully");

  // Log metrics every 30 seconds for ongoing monitoring
  const metricsInterval = setInterval(() => {
    console.log("\n" + "=".repeat(50));
    console.log("📊 METRICS DASHBOARD (periodic update)");
    console.log("=".repeat(50));
    logMetrics(stream);
  }, 30000);

  // Simulate running for 5 minutes
  setTimeout(
    async () => {
      clearInterval(metricsInterval);
      console.log("\n🛑 Shutting down...");
      await stream.close();
      console.log("✅ Stream closed gracefully");
    },
    5 * 60 * 1000
  );
}

/**
 * Log comprehensive metrics in a dashboard-friendly format
 */
function logMetrics(stream: { getMetrics(): MetricsSnapshot }) {
  const metrics: MetricsSnapshot = stream.getMetrics();

  console.log("\n📊 Stream Metrics:");
  console.log(`   Reports Accepted:      ${metrics.accepted.toLocaleString()}`);
  console.log(`   Reports Deduplicated:  ${metrics.deduplicated.toLocaleString()}`);
  console.log(`   Total Received:        ${metrics.totalReceived.toLocaleString()}`);

  if (metrics.totalReceived > 0) {
    const deduplicationRate = ((metrics.deduplicated / metrics.totalReceived) * 100).toFixed(1);
    console.log(`   Deduplication Rate:    ${deduplicationRate}% (${metrics.deduplicated} filtered duplicates)`);
    console.log(`   Data Freshness:        ${metrics.accepted} unique reports processed`);
  }

  console.log("\n🔗 Connection Health:");
  console.log(`   Active Connections:    ${metrics.activeConnections}/${metrics.configuredConnections}`);
  console.log(`   Partial Reconnects:    ${metrics.partialReconnects}`);
  console.log(`   Full Reconnects:       ${metrics.fullReconnects}`);

  // Connection status per origin (shows individual backend endpoints)
  console.log("\n🌐 Origin Status:");
  Object.entries(metrics.originStatus).forEach(([origin, status]) => {
    const statusIcon = getStatusIcon(status);
    const host = new URL(origin).host;
    const originId = origin.includes("#") ? origin.split("#")[1] : "";
    console.log(`   ${statusIcon} ${host}${originId ? `#${originId}` : ""}: ${status}`);
  });

  // Connection reliability status
  const isHighlyAvailable = metrics.activeConnections > 1;
  const hasRecentIssues = metrics.fullReconnects > 0 || metrics.partialReconnects > 3;

  console.log(`\n🚀 Stream Status:`);
  console.log(`   Mode: ${isHighlyAvailable ? "High Availability" : "Single Connection"}`);
  console.log(`   Stability: ${hasRecentIssues ? "Some recent reconnections" : "Stable"}`);
}

/**
 * Get emoji icon for connection status
 */
function getStatusIcon(status: ConnectionStatus): string {
  switch (status) {
    case ConnectionStatus.CONNECTED:
      return "🟢";
    case ConnectionStatus.CONNECTING:
      return "🟡";
    case ConnectionStatus.RECONNECTING:
      return "🟠";
    case ConnectionStatus.FAILED:
      return "🔴";
    case ConnectionStatus.DISCONNECTED:
    default:
      return "⚫";
  }
}

/**
 * Assess stream reliability based on connection patterns
 */
function assessStreamReliability(metrics: MetricsSnapshot) {
  const reliability = {
    mode: metrics.activeConnections > 1 ? "HA" : "Single",
    stability: "stable",
    recommendations: [] as string[],
  };

  // Check for connection issues
  if (metrics.activeConnections < metrics.configuredConnections) {
    reliability.stability = "degraded";
    reliability.recommendations.push("Some configured connections are inactive");
  }

  // Frequent full reconnects indicate network issues
  if (metrics.fullReconnects > 2) {
    reliability.stability = "unstable";
    reliability.recommendations.push("Frequent full reconnections detected - check network stability");
  }

  // Too many partial reconnects might indicate load balancing issues
  if (metrics.partialReconnects > 10) {
    reliability.recommendations.push("High partial reconnection rate - consider reviewing connection configuration");
  }

  return reliability;
}

// Run the example
monitoringExample().catch(console.error);

export { monitoringExample, logMetrics, assessStreamReliability };
