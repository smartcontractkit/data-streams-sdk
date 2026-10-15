import { AbiCoder, dataSlice, getBytes, isHexString, Result } from "ethers";
import { ReportDecodingError } from "../types/errors";
import {
  DecodedReport,
  DecodedReportFields,
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
  Ripcord,
} from "../types";

import { SDKLogger } from "../utils/logger";
import { getReportVersion, ReportVersion } from "../utils/report";

const globalAbiCoder = new AbiCoder();
const outerReportAbiCoder = new AbiCoder();

const reportSchemaV2 = [
  { type: "bytes32", name: "feedId" },
  { type: "uint64", name: "validFromTimestamp" },
  { type: "uint64", name: "observationsTimestamp" },
  { type: "uint192", name: "nativeFee" },
  { type: "uint192", name: "linkFee" },
  { type: "uint64", name: "expiresAt" },
  { type: "int192", name: "price" },
];

const reportSchemaV3 = [
  { type: "bytes32", name: "feedId" },
  { type: "uint64", name: "validFromTimestamp" },
  { type: "uint64", name: "observationsTimestamp" },
  { type: "uint192", name: "nativeFee" },
  { type: "uint192", name: "linkFee" },
  { type: "uint64", name: "expiresAt" },
  { type: "int192", name: "price" },
  { type: "int192", name: "bid" },
  { type: "int192", name: "ask" },
];

const reportSchemaV4 = [
  { type: "bytes32", name: "feedId" },
  { type: "uint64", name: "validFromTimestamp" },
  { type: "uint64", name: "observationsTimestamp" },
  { type: "uint192", name: "nativeFee" },
  { type: "uint192", name: "linkFee" },
  { type: "uint64", name: "expiresAt" },
  { type: "int192", name: "price" },
  { type: "uint8", name: "marketStatus" },
];

const reportSchemaV5 = [
  { type: "bytes32", name: "feedId" },
  { type: "uint64", name: "validFromTimestamp" },
  { type: "uint64", name: "observationsTimestamp" },
  { type: "uint192", name: "nativeFee" },
  { type: "uint192", name: "linkFee" },
  { type: "uint64", name: "expiresAt" },
  { type: "int192", name: "rate" },
  { type: "uint64", name: "timestamp" },
  { type: "uint32", name: "duration" },
];

const reportSchemaV6 = [
  { type: "bytes32", name: "feedId" },
  { type: "uint64", name: "validFromTimestamp" },
  { type: "uint64", name: "observationsTimestamp" },
  { type: "uint192", name: "nativeFee" },
  { type: "uint192", name: "linkFee" },
  { type: "uint64", name: "expiresAt" },
  { type: "int192", name: "price" },
  { type: "int192", name: "price2" },
  { type: "int192", name: "price3" },
  { type: "int192", name: "price4" },
  { type: "int192", name: "price5" },
];

const reportSchemaV7 = [
  { type: "bytes32", name: "feedId" },
  { type: "uint64", name: "validFromTimestamp" },
  { type: "uint64", name: "observationsTimestamp" },
  { type: "uint192", name: "nativeFee" },
  { type: "uint192", name: "linkFee" },
  { type: "uint64", name: "expiresAt" },
  { type: "int192", name: "exchangeRate" },
];

const reportSchemaV8 = [
  { type: "bytes32", name: "feedId" },
  { type: "uint64", name: "validFromTimestamp" },
  { type: "uint64", name: "observationsTimestamp" },
  { type: "uint192", name: "nativeFee" },
  { type: "uint192", name: "linkFee" },
  { type: "uint64", name: "expiresAt" },
  { type: "uint64", name: "lastUpdateTimestamp" },
  { type: "int192", name: "midPrice" },
  { type: "uint32", name: "marketStatus" },
];

const reportSchemaV9 = [
  { type: "bytes32", name: "feedId" },
  { type: "uint64", name: "validFromTimestamp" },
  { type: "uint64", name: "observationsTimestamp" },
  { type: "uint192", name: "nativeFee" },
  { type: "uint192", name: "linkFee" },
  { type: "uint64", name: "expiresAt" },
  { type: "int192", name: "navPerShare" },
  { type: "uint64", name: "navDate" },
  { type: "int192", name: "aum" },
  { type: "uint32", name: "ripcord" },
];

const reportSchemaV10 = [
  { type: "bytes32", name: "feedId" },
  { type: "uint64", name: "validFromTimestamp" },
  { type: "uint64", name: "observationsTimestamp" },
  { type: "uint192", name: "nativeFee" },
  { type: "uint192", name: "linkFee" },
  { type: "uint64", name: "expiresAt" },
  { type: "uint64", name: "lastUpdateTimestamp" },
  { type: "int192", name: "price" },
  { type: "uint32", name: "marketStatus" },
  { type: "int192", name: "currentMultiplier" },
  { type: "int192", name: "newMultiplier" },
  { type: "uint64", name: "activationDateTime" },
  { type: "int192", name: "tokenizedPrice" },
];

const reportSchemaV11 = [
  { type: "bytes32", name: "feedId" },
  { type: "uint64", name: "validFromTimestamp" },
  { type: "uint64", name: "observationsTimestamp" },
  { type: "uint192", name: "nativeFee" },
  { type: "uint192", name: "linkFee" },
  { type: "uint64", name: "expiresAt" },
  { type: "int192", name: "mid" },
  { type: "uint64", name: "lastSeenTimestampNs" },
  { type: "int192", name: "bid" },
  { type: "int192", name: "bidVolume" },
  { type: "int192", name: "ask" },
  { type: "int192", name: "askVolume" },
  { type: "int192", name: "lastTradedPrice" },
  { type: "uint32", name: "marketStatus" },
];

const reportSchemaV12 = [
  { type: "bytes32", name: "feedId" },
  { type: "uint64", name: "validFromTimestamp" },
  { type: "uint64", name: "observationsTimestamp" },
  { type: "uint192", name: "nativeFee" },
  { type: "uint192", name: "linkFee" },
  { type: "uint64", name: "expiresAt" },
  { type: "int192", name: "navPerShare" },
  { type: "int192", name: "nextNavPerShare" },
  { type: "uint64", name: "navDate" },
  { type: "uint32", name: "ripcord" },
];

const reportSchemaV13 = [
  { type: "bytes32", name: "feedId" },
  { type: "uint64", name: "validFromTimestamp" },
  { type: "uint64", name: "observationsTimestamp" },
  { type: "uint192", name: "nativeFee" },
  { type: "uint192", name: "linkFee" },
  { type: "uint64", name: "expiresAt" },
  { type: "int192", name: "bestAsk" },
  { type: "int192", name: "bestBid" },
  { type: "uint64", name: "askVolume" },
  { type: "uint64", name: "bidVolume" },
  { type: "int192", name: "lastTradedPrice" },
];

const reportSchemaV14 = [
  { type: "bytes32", name: "feedId" },
  { type: "uint64", name: "validFromTimestamp" },
  { type: "uint64", name: "observationsTimestamp" },
  { type: "uint192", name: "nativeFee" },
  { type: "uint192", name: "linkFee" },
  { type: "uint64", name: "expiresAt" },
  { type: "int192", name: "midPrice" },
  { type: "int192", name: "bidPrice" },
  { type: "int192", name: "askPrice" },
  { type: "uint64", name: "expiryTime" },
  { type: "uint64", name: "firstDayOfNotice" },
  { type: "uint64", name: "lastSeenTimestampNs" },
  { type: "uint32", name: "marketStatus" },
  { type: "uint32", name: "contractMonth" },
  { type: "int192", name: "goldmanRollPrice" },
  { type: "uint32", name: "currentBusinessDay" },
  { type: "int192", name: "interpolatedGoldmanRollPrice" },
];

/**
 * Decode a report from its hex string representation
 * @param reportHex The hex string representation of the report
 * @param feedId The feed ID (stream ID) which contains the version information
 * @returns The decoded report data
 * @throws ReportDecodingError if decoding fails
 */
export function decodeReport(
  reportHex: string,
  feedId: string,
  logger?: SDKLogger
):
  | DecodedV2Report
  | DecodedV3Report
  | DecodedV4Report
  | DecodedV5Report
  | DecodedV6Report
  | DecodedV7Report
  | DecodedV8Report
  | DecodedV9Report
  | DecodedV10Report
  | DecodedV11Report
  | DecodedV12Report
  | DecodedV13Report
  | DecodedV14Report {
  logger?.debug(`Decoding report for feed ${feedId}`);

  try {
    // Ensure the report starts with 0x
    if (!isHexString(reportHex)) {
      throw new ReportDecodingError("Report hex string must start with 0x");
    }

    // Extract version from feed ID, masking the resolution nibble
    const version = getReportVersion(feedId);
    logger?.debug(`Detected report version: ${version}`);

    // First decode the full report structure to get the report blob
    const fullReportAbi = [
      { type: "bytes32[3]", name: "reportContext" },
      { type: "bytes", name: "reportBlob" },
      { type: "bytes32[]", name: "rawRs" },
      { type: "bytes32[]", name: "rawSs" },
      { type: "bytes32", name: "rawVs" },
    ];

    const decodedFullReport = outerReportAbiCoder.decode(
      fullReportAbi.map(item => item.type),
      reportHex
    );

    const reportBlob = decodedFullReport[1];

    // The schema is selected from the caller's feed ID, so it must match the signed one
    const signedFeedId = dataSlice(reportBlob, 0, 32);
    if (signedFeedId.toLowerCase() !== feedId.toLowerCase()) {
      throw new ReportDecodingError(`Feed ID mismatch: expected ${feedId}, but report is signed for ${signedFeedId}`);
    }

    return reportDecoders[version](reportBlob);
  } catch (error) {
    if (error instanceof ReportDecodingError) {
      throw error;
    }
    throw new ReportDecodingError(`Failed to decode report: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const reportDecoders: Record<ReportVersion, (reportBlob: string) => DecodedReport> = {
  V2: decodeV2Report,
  V3: decodeV3Report,
  V4: decodeV4Report,
  V5: decodeV5Report,
  V6: decodeV6Report,
  V7: decodeV7Report,
  V8: decodeV8Report,
  V9: decodeV9Report,
  V10: decodeV10Report,
  V11: decodeV11Report,
  V12: decodeV12Report,
  V13: decodeV13Report,
  V14: decodeV14Report,
};

/**
 * Decode the fields shared by every report schema, which occupy the first six ABI slots
 */
function decodeCommonFields(decoded: Result): DecodedReportFields {
  return {
    feedID: decoded[0],
    validFromTimestamp: Number(decoded[1]),
    observationsTimestamp: Number(decoded[2]),
    nativeFee: decoded[3],
    linkFee: decoded[4],
    expiresAt: Number(decoded[5]),
  };
}

function decodeV2Report(reportBlob: string): DecodedV2Report {
  try {
    const decoded = globalAbiCoder.decode(
      reportSchemaV2.map(item => item.type),
      getBytes(reportBlob)
    );

    return {
      version: "V2",
      ...decodeCommonFields(decoded),
      price: decoded[6],
    };
  } catch (error) {
    throw new ReportDecodingError(
      `Failed to decode V2 report: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function decodeV3Report(reportBlob: string): DecodedV3Report {
  try {
    const decoded = globalAbiCoder.decode(
      reportSchemaV3.map(item => item.type),
      getBytes(reportBlob)
    );

    return {
      version: "V3",
      ...decodeCommonFields(decoded),
      price: decoded[6],
      bid: decoded[7],
      ask: decoded[8],
    };
  } catch (error) {
    throw new ReportDecodingError(
      `Failed to decode V3 report: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function decodeV4Report(reportBlob: string): DecodedV4Report {
  try {
    const decoded = globalAbiCoder.decode(
      reportSchemaV4.map(item => item.type),
      getBytes(reportBlob)
    );

    const marketStatus = Number(decoded[7]);
    if (
      marketStatus !== MarketStatus.UNKNOWN &&
      marketStatus !== MarketStatus.INACTIVE &&
      marketStatus !== MarketStatus.ACTIVE
    ) {
      throw new ReportDecodingError(`Invalid market status: ${marketStatus}`);
    }

    return {
      version: "V4",
      ...decodeCommonFields(decoded),
      price: decoded[6],
      marketStatus,
    };
  } catch (error) {
    throw new ReportDecodingError(
      `Failed to decode V4 report: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function decodeV5Report(reportBlob: string): DecodedV5Report {
  try {
    const decoded = globalAbiCoder.decode(
      reportSchemaV5.map(item => item.type),
      getBytes(reportBlob)
    );

    return {
      version: "V5",
      ...decodeCommonFields(decoded),
      rate: decoded[6],
      timestamp: Number(decoded[7]),
      duration: Number(decoded[8]),
    };
  } catch (error) {
    throw new ReportDecodingError(
      `Failed to decode V5 report: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function decodeV6Report(reportBlob: string): DecodedV6Report {
  try {
    const decoded = globalAbiCoder.decode(
      reportSchemaV6.map(item => item.type),
      getBytes(reportBlob)
    );

    return {
      version: "V6",
      ...decodeCommonFields(decoded),
      price: decoded[6],
      price2: decoded[7],
      price3: decoded[8],
      price4: decoded[9],
      price5: decoded[10],
    } as unknown as DecodedV6Report; // price fields are bigint
  } catch (error) {
    throw new ReportDecodingError(
      `Failed to decode V6 report: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function decodeV7Report(reportBlob: string): DecodedV7Report {
  try {
    const decoded = globalAbiCoder.decode(
      reportSchemaV7.map(item => item.type),
      getBytes(reportBlob)
    );

    return {
      version: "V7",
      ...decodeCommonFields(decoded),
      exchangeRate: decoded[6],
    } as unknown as DecodedV7Report;
  } catch (error) {
    throw new ReportDecodingError(
      `Failed to decode V7 report: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function decodeV8Report(reportBlob: string): DecodedV8Report {
  try {
    const decoded = globalAbiCoder.decode(
      reportSchemaV8.map(item => item.type),
      getBytes(reportBlob)
    );

    const marketStatus = Number(decoded[8]);
    if (
      marketStatus !== MarketStatus.UNKNOWN &&
      marketStatus !== MarketStatus.INACTIVE &&
      marketStatus !== MarketStatus.ACTIVE
    ) {
      throw new ReportDecodingError(`Invalid market status: ${marketStatus}`);
    }

    return {
      version: "V8",
      ...decodeCommonFields(decoded),
      lastUpdateTimestamp: decoded[6],
      midPrice: decoded[7],
      marketStatus,
    };
  } catch (error) {
    throw new ReportDecodingError(
      `Failed to decode V8 report: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function decodeV9Report(reportBlob: string): DecodedV9Report {
  try {
    const decoded = globalAbiCoder.decode(
      reportSchemaV9.map(item => item.type),
      getBytes(reportBlob)
    );

    const ripcord = Number(decoded[9]);
    if (ripcord !== Ripcord.NORMAL && ripcord !== Ripcord.PAUSED) {
      throw new ReportDecodingError(`Invalid ripcord value: ${ripcord}. Must be 0 (normal) or 1 (paused)`);
    }

    return {
      version: "V9",
      ...decodeCommonFields(decoded),
      navPerShare: decoded[6],
      navDate: Number(decoded[7]),
      aum: decoded[8],
      ripcord,
    };
  } catch (error) {
    throw new ReportDecodingError(
      `Failed to decode V9 report: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function decodeV10Report(reportBlob: string): DecodedV10Report {
  try {
    const decoded = globalAbiCoder.decode(
      reportSchemaV10.map(item => item.type),
      getBytes(reportBlob)
    );

    const marketStatus = Number(decoded[8]);
    if (
      marketStatus !== MarketStatus.UNKNOWN &&
      marketStatus !== MarketStatus.INACTIVE &&
      marketStatus !== MarketStatus.ACTIVE
    ) {
      throw new ReportDecodingError(`Invalid market status: ${marketStatus}`);
    }

    return {
      version: "V10",
      ...decodeCommonFields(decoded),
      lastUpdateTimestamp: decoded[6],
      price: decoded[7],
      marketStatus,
      currentMultiplier: decoded[9],
      newMultiplier: decoded[10],
      activationDateTime: Number(decoded[11]),
      tokenizedPrice: decoded[12],
    };
  } catch (error) {
    throw new ReportDecodingError(
      `Failed to decode V10 report: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function decodeV11Report(reportBlob: string): DecodedV11Report {
  try {
    const decoded = globalAbiCoder.decode(
      reportSchemaV11.map(item => item.type),
      getBytes(reportBlob)
    );

    return {
      version: "V11",
      ...decodeCommonFields(decoded),
      mid: decoded[6],
      lastSeenTimestampNs: decoded[7],
      bid: decoded[8],
      bidVolume: decoded[9],
      ask: decoded[10],
      askVolume: decoded[11],
      lastTradedPrice: decoded[12],
      marketStatus: Number(decoded[13]),
    };
  } catch (error) {
    throw new ReportDecodingError(
      `Failed to decode V11 report: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function decodeV12Report(reportBlob: string): DecodedV12Report {
  try {
    const decoded = globalAbiCoder.decode(
      reportSchemaV12.map(item => item.type),
      getBytes(reportBlob)
    );

    const ripcord = Number(decoded[9]);
    if (ripcord !== Ripcord.NORMAL && ripcord !== Ripcord.PAUSED) {
      throw new ReportDecodingError(`Invalid ripcord value: ${ripcord}. Must be 0 (normal) or 1 (paused)`);
    }

    return {
      version: "V12",
      ...decodeCommonFields(decoded),
      navPerShare: decoded[6],
      nextNavPerShare: decoded[7],
      navDate: Number(decoded[8]),
      ripcord,
    };
  } catch (error) {
    throw new ReportDecodingError(
      `Failed to decode V12 report: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function decodeV13Report(reportBlob: string): DecodedV13Report {
  try {
    const decoded = globalAbiCoder.decode(
      reportSchemaV13.map(item => item.type),
      getBytes(reportBlob)
    );

    return {
      version: "V13",
      ...decodeCommonFields(decoded),
      bestAsk: decoded[6],
      bestBid: decoded[7],
      askVolume: Number(decoded[8]),
      bidVolume: Number(decoded[9]),
      lastTradedPrice: decoded[10],
    };
  } catch (error) {
    throw new ReportDecodingError(
      `Failed to decode V13 report: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function decodeV14Report(reportBlob: string): DecodedV14Report {
  try {
    const decoded = globalAbiCoder.decode(
      reportSchemaV14.map(item => item.type),
      getBytes(reportBlob)
    );

    // contractMonth must be a number from 1 (Jan) to 12 (Dec).
    const contractMonth = Number(decoded[13]);
    if (!Number.isInteger(contractMonth) || contractMonth < 1 || contractMonth > 12) {
      throw new ReportDecodingError(`Invalid contract month: ${contractMonth}. Must be a number from 1 to 12`);
    }

    return {
      version: "V14",
      ...decodeCommonFields(decoded),
      midPrice: decoded[6],
      bidPrice: decoded[7],
      askPrice: decoded[8],
      expiryTime: decoded[9],
      firstDayOfNotice: decoded[10],
      lastSeenTimestampNs: decoded[11],
      marketStatus: Number(decoded[12]),
      contractMonth,
      goldmanRollPrice: decoded[14],
      currentBusinessDay: Number(decoded[15]),
      interpolatedGoldmanRollPrice: decoded[16],
    };
  } catch (error) {
    throw new ReportDecodingError(
      `Failed to decode V14 report: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
