import { createClient, LogLevel } from "../src";
import "dotenv/config";

async function main() {
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
    console.log("\nFetching all available feeds...\n");

    const feeds = await client.listFeeds();
    console.log(`Found ${feeds.length} feeds:\n`);

    feeds.forEach(feed => {
      console.log(`Feed ID: ${feed.feedID}`);
      console.log("-".repeat(50));
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
