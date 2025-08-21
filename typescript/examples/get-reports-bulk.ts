import { createClient, decodeReport, LogLevel } from "../src";
import { getReportVersion, formatReport } from "../src/utils/report";
import { getCurrentTimestamp } from "../src/utils/time";
import "dotenv/config";

async function main() {
  if (process.argv.length < 4) {
    console.error("Please provide feed IDs and timestamp as arguments");
    console.error("Get reports for multiple feeds at a specific timestamp:");
    console.error("  npx ts-node examples/get-reports-bulk.ts <feedID1> <feedID2> [feedID3...] <timestamp>");
    console.error("\nExample:");
    console.error(
      `  npx ts-node examples/get-reports-bulk.ts 0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782 0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439 ${getCurrentTimestamp()}`
    );
    console.error("\nNote: The timestamp must be within the last 30 days.");
    process.exit(1);
  }

  // Parse arguments: all except the last are feed IDs, last is timestamp
  const args = process.argv.slice(2);
  const timestamp = parseInt(args[args.length - 1]);
  const feedIds = args.slice(0, -1);

  if (isNaN(timestamp)) {
    console.error("Error: Last argument must be a valid timestamp");
    process.exit(1);
  }

  try {
    const config = {
      apiKey: process.env.API_KEY || "YOUR_API_KEY",
      userSecret: process.env.USER_SECRET || "YOUR_USER_SECRET",
      endpoint: "https://api.testnet-dataengine.chain.link",
      wsEndpoint: "wss://ws.testnet-dataengine.chain.link",
      // Comment to disable SDK logging:
      logging: {
        logger: console,
        logLevel: LogLevel.INFO,
      },
    };

    const client = createClient(config);
    console.log(`\nFetching reports in bulk for ${feedIds.length} feed(s) at timestamp ${timestamp}:`);
    feedIds.forEach(feedId => {
      const version = getReportVersion(feedId);
      console.log(`- ${feedId} (${version})`);
    });
    console.log();

    const reports = await client.getReportsBulk(feedIds, timestamp);
    console.log(`Found ${reports.length} reports:\n`);

    // Process reports safely - order is not guaranteed to match input feedIds
    reports.forEach((report, index) => {
      const version = getReportVersion(report.feedID);
      console.log(`Raw Report Blob #${index + 1}: ${report.fullReport}`);

      // Decode the report
      const decodedData = decodeReport(report.fullReport, report.feedID);

      // Combine decoded data with report metadata
      const decodedReport = {
        ...decodedData,
        feedID: report.feedID,
        validFromTimestamp: report.validFromTimestamp,
        observationsTimestamp: report.observationsTimestamp,
      };
      console.log(formatReport(decodedReport, version));
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
    process.exit(1);
  }
}

main();
