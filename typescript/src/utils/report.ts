import {
  DecodedReport,
  DecodedV10Report,
  DecodedV11Report,
  DecodedV12Report,
  DecodedV13Report,
  DecodedV14Report,
  DecodedV2Report,
  DecodedV3Report,
  DecodedV4Report,
  DecodedV5Report,
  DecodedV6Report,
  DecodedV7Report,
  DecodedV8Report,
  DecodedV9Report,
  MarketStatus,
} from "../types";

/**
 * Extracts the report schema version from a feed ID.
 *
 * The first two bytes of a feed ID encode the schema version in the low 12 bits;
 * the high nibble of the first byte encodes the timestamp resolution
 * (see go/feed/feed.go), so it must be masked off before dispatching.
 * @param feedId The feed ID to extract the schema version from
 * @returns The 4-character hex schema version, e.g. "0003" for V3 feeds
 */
export function getSchemaVersion(feedId: string): string {
  return (parseInt(feedId.slice(2, 6), 16) & 0x0fff).toString(16).padStart(4, "0");
}

/**
 * Extracts the timestamp resolution nibble from a feed ID (the high nibble of the first byte).
 *
 * Only 0 (seconds) and 1 (milliseconds) are defined (see go/feed/feed.go); any other
 * value is undefined and must be rejected rather than decoded with unknown timestamp units.
 * @param feedId The feed ID to extract the resolution from
 * @returns The resolution nibble, from 0x0 to 0xf
 */
export function getResolution(feedId: string): number {
  return parseInt(feedId.slice(2, 3), 16);
}

/**
 * Checks whether a feed ID encodes a defined timestamp resolution (seconds or milliseconds)
 * @param feedId The feed ID to check
 */
export function hasKnownResolution(feedId: string): boolean {
  const resolution = getResolution(feedId);
  return resolution === 0 || resolution === 1;
}

const REPORT_VERSIONS = {
  "0002": "V2",
  "0003": "V3",
  "0004": "V4",
  "0005": "V5",
  "0006": "V6",
  "0007": "V7",
  "0008": "V8",
  "0009": "V9",
  "000a": "V10",
  "000b": "V11",
  "000c": "V12",
  "000d": "V13",
  "000e": "V14",
} as const;

export type ReportVersion = (typeof REPORT_VERSIONS)[keyof typeof REPORT_VERSIONS];

/**
 * Determines the version of a feed based on its ID
 * @param feedId The feed ID to check
 * @returns "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12", "V13" or "V14" depending on the feed ID schema version
 * @throws Error if the feed ID has an unknown schema version or timestamp resolution
 */
export function getReportVersion(feedId: string): ReportVersion {
  const schemaVersion = getSchemaVersion(feedId);
  const version = REPORT_VERSIONS[schemaVersion as keyof typeof REPORT_VERSIONS];
  if (!version) {
    throw new Error(`Unknown report version: 0x${schemaVersion}`);
  }
  if (!hasKnownResolution(feedId)) {
    throw new Error(`Unknown feed ID resolution: 0x${getResolution(feedId).toString(16)}`);
  }
  return version;
}

/**
 * Formats a report as a human-readable string
 * @param report The report object to format
 * @param version The version of the report (V2, V3, V4, V5, V6, V7, V8, V9, V10, V11, V12, V13 or V14)
 * @returns Formatted string representation of the report
 */
export function formatReport(report: DecodedReport, version: ReportVersion): string {
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
    case "V11": {
      const r = report as DecodedV11Report;
      output += `Mid: ${r.mid.toString()}\n`;
      output += `Last Seen Timestamp Nanos: ${r.lastSeenTimestampNs.toString()}\n`;
      output += `Bid: ${r.bid.toString()}\n`;
      output += `Bid Volume: ${r.bidVolume.toString()}\n`;
      output += `Ask: ${r.ask.toString()}\n`;
      output += `Ask Volume: ${r.askVolume.toString()}\n`;
      output += `Last Traded Price: ${r.lastTradedPrice.toString()}\n`;
      output += `Market Status: ${r.marketStatus.toString()}\n`;
      break;
    }
    case "V12": {
      const r = report as DecodedV12Report;
      output += `NAV per Share: ${r.navPerShare.toString()}\n`;
      output += `Next NAV per Share: ${r.nextNavPerShare.toString()}\n`;
      output += `NAV Date: ${r.navDate}\n`;
      output += `Ripcord: ${r.ripcord === 0 ? `Normal (${r.ripcord})` : `PAUSED - DO NOT CONSUME (${r.ripcord})`}\n`;
      break;
    }
    case "V13": {
      const r = report as DecodedV13Report;
      output += `Best Ask: ${r.bestAsk.toString()}\n`;
      output += `Best Bid: ${r.bestBid.toString()}\n`;
      output += `Ask Volume: ${r.askVolume.toString()}\n`;
      output += `Bid Volume: ${r.bidVolume.toString()}\n`;
      output += `Last Traded Price: ${r.lastTradedPrice.toString()}\n`;
      break;
    }
    case "V14": {
      const r = report as DecodedV14Report;
      output += `Mid Price: ${r.midPrice.toString()}\n`;
      output += `Bid Price: ${r.bidPrice.toString()}\n`;
      output += `Ask Price: ${r.askPrice.toString()}\n`;
      output += `Expiry Time: ${r.expiryTime.toString()}\n`;
      output += `First Day of Notice: ${r.firstDayOfNotice.toString()}\n`;
      output += `Last Seen Timestamp Nanos: ${r.lastSeenTimestampNs.toString()}\n`;
      output += `Market Status: ${r.marketStatus.toString()}\n`;
      output += `Contract Month: ${r.contractMonth.toString()}\n`;
      output += `Goldman Roll Price: ${r.goldmanRollPrice.toString()}\n`;
      output += `Current Business Day: ${r.currentBusinessDay.toString()}\n`;
      output += `Interpolated Goldman Roll Price: ${r.interpolatedGoldmanRollPrice.toString()}\n`;
      break;
    }
  }

  output += "-".repeat(50);
  return output;
}
