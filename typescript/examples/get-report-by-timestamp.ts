import { createClient, decodeReport, LogLevel } from "../src";
import { getReportVersion, formatReport } from "../src/utils/report";
import { getCurrentTimestamp } from "../src/utils/time";
import "dotenv/config";

async function main() {
  if (process.argv.length < 4) {
    console.error("Please provide a feed ID and timestamp as arguments");
    console.error(
      "Example: npx ts-node examples/get-report-by-timestamp.ts 0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782 1754604071"
    );
    console.error(`Current timestamp: ${getCurrentTimestamp()}`);
    console.error("Note: The timestamp must be within the last 30 days.");
    process.exit(1);
  }

  const feedId = process.argv[2];
  const timestamp = parseInt(process.argv[3]);
  const version = getReportVersion(feedId);

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
    console.log(`\nFetching report for feed ${feedId} (${version}) at timestamp ${timestamp}...\n`);

    // Get raw report data
    const report = await client.getReportByTimestamp(feedId, timestamp);
    console.log(`Raw Report Blob: ${report.fullReport}`);

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
