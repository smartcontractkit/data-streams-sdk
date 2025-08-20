import {
  DecodedV2Report,
  DecodedV3Report,
  DecodedV4Report,
  DecodedV5Report,
  DecodedV6Report,
  DecodedV7Report,
  DecodedV8Report,
  DecodedV9Report,
  DecodedV10Report,
  DecodedReport,
  MarketStatus,
} from "../types";

/**
 * Determines the version of a feed based on its ID
 * @param feedId The feed ID to check
 * @returns "V2", "V3", "V4", "V8", "V9", or "V10" depending on the feed ID schema version
 */
export function getReportVersion(feedId: string): "V2" | "V3" | "V4" | "V5" | "V6" | "V7" | "V8" | "V9" | "V10" {
  const schemaVersion = feedId.slice(2, 6);
  switch (schemaVersion) {
    case "0002":
      return "V2";
    case "0003":
      return "V3";
    case "0004":
      return "V4";
    case "0005":
      return "V5";
    case "0006":
      return "V6";
    case "0007":
      return "V7";
    case "0008":
      return "V8";
    case "0009":
      return "V9";
    case "000a":
      return "V10";
    default:
      throw new Error(`Unknown schema version: 0x${schemaVersion}`);
  }
}

/**
 * Formats a report as a human-readable string
 * @param report The report object to format
 * @param version The version of the report (V2, V3, V4, V5, V6, V7, V8, V9, or V10)
 * @returns Formatted string representation of the report
 */
export function formatReport(
  report: DecodedReport,
  version: "V2" | "V3" | "V4" | "V5" | "V6" | "V7" | "V8" | "V9" | "V10"
): string {
  let output = "";

  output += "\nReport Metadata:\n";
  output += `Feed ID: ${report.feedID}\n`;
  output += `Valid From: ${report.validFromTimestamp}\n`;
  output += `Observations: ${report.observationsTimestamp}\n`;

  output += "\nDecoded Data:\n";
  output += `Native Fee: ${report.nativeFee.toString()}\n`;
  output += `LINK Fee: ${report.linkFee.toString()}\n`;
  output += `Expires At: ${report.expiresAt}\n`;

  // Handle version-specific fields
  switch (version) {
    case "V2": {
      const r = report as DecodedV2Report;
      output += `Price: ${r.price.toString()}\n`;
      break;
    }
    case "V3": {
      const r = report as DecodedV3Report;
      output += `Price: ${r.price.toString()}\n`;
      output += `Bid Price: ${r.bid.toString()}\n`;
      output += `Ask Price: ${r.ask.toString()}\n`;
      break;
    }
    case "V4": {
      const r = report as DecodedV4Report;
      output += `Price: ${r.price.toString()}\n`;
      output += `Market Status: ${MarketStatus[r.marketStatus]} (${r.marketStatus})\n`;
      break;
    }
    case "V5": {
      const r = report as DecodedV5Report;
      output += `Rate: ${r.rate.toString()}\n`;
      output += `Rate Timestamp: ${r.timestamp}\n`;
      output += `Duration: ${r.duration}\n`;
      break;
    }
    case "V6": {
      const r = report as DecodedV6Report;
      output += `Price: ${r.price.toString()}\n`;
      output += `Price2: ${r.price2.toString()}\n`;
      output += `Price3: ${r.price3.toString()}\n`;
      output += `Price4: ${r.price4.toString()}\n`;
      output += `Price5: ${r.price5.toString()}\n`;
      break;
    }
    case "V7": {
      const r = report as DecodedV7Report;
      output += `Exchange Rate: ${r.exchangeRate.toString()}\n`;
      break;
    }
    case "V8": {
      const r = report as DecodedV8Report;
      output += `Mid Price: ${r.midPrice.toString()}\n`;
      output += `Last Update: ${r.lastUpdateTimestamp}\n`;
      output += `Market Status: ${MarketStatus[r.marketStatus]} (${r.marketStatus})\n`;
      break;
    }
    case "V9": {
      const r = report as DecodedV9Report;
      output += `NAV per Share: ${r.navPerShare.toString()}\n`;
      output += `NAV Date: ${r.navDate}\n`;
      output += `AUM: ${r.aum.toString()}\n`;
      output += `Ripcord: ${r.ripcord === 0 ? `Normal (${r.ripcord})` : `PAUSED - DO NOT CONSUME (${r.ripcord})`}\n`;
      break;
    }
    case "V10": {
      const r = report as DecodedV10Report;
      output += `Price: ${r.price.toString()}\n`;
      output += `Last Update: ${r.lastUpdateTimestamp}\n`;
      output += `Market Status: ${MarketStatus[r.marketStatus]} (${r.marketStatus})\n`;
      output += `Current Multiplier: ${r.currentMultiplier.toString()}\n`;
      output += `New Multiplier: ${r.newMultiplier.toString()}\n`;
      output += `Activation Date: ${r.activationDateTime}\n`;
      output += `Tokenized Price: ${r.tokenizedPrice.toString()}\n`;
      break;
    }
  }

  output += "-".repeat(50);
  return output;
}
