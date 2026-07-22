/**
 * Report deduplication using a bounded set of recently seen timestamps per feed.
 * Each feed tracks a watermark (highest timestamp) for ordering decisions and a
 * set of recently seen timestamps for deduplication, allowing correct dedup of
 * both in-order and out-of-order HA duplicates.
 */

const SEEN_BUFFER_SIZE = 32;

export interface ReportMetadata {
  feedID: string;
  observationsTimestamp: number;
  validFromTimestamp: number;
  fullReport: string;
}

export interface DeduplicationResult {
  isAccepted: boolean;
  isDuplicate: boolean;
  isOutOfOrder: boolean;
  reason?: string;
}

export interface DeduplicationStats {
  accepted: number;
  deduplicated: number;
  outOfOrder: number;
  totalReceived: number;
  watermarkCount: number;
}

enum Verdict {
  Accept,
  Duplicate,
  OutOfOrder,
}

interface FeedState {
  watermark: number;
  seen: Set<number>;
}

// ReportDeduplicator manages deduplication of reports for a set of feeds.
export class ReportDeduplicator {
  private feedState: Map<string, FeedState> = new Map();
  private acceptedCount = 0;
  private deduplicatedCount = 0;
  private outOfOrderCount = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Configuration
  private readonly maxWatermarkAge: number;
  private readonly cleanupIntervalMs: number;
  private readonly allowOutOfOrder: boolean;

  constructor(
    options: {
      maxWatermarkAge?: number; // How long to keep watermarks (default: 1 hour)
      cleanupIntervalMs?: number; // How often to clean old watermarks (default: 5 minutes)
      allowOutOfOrder?: boolean; // Allow out-of-order reports through (default: false)
    } = {}
  ) {
    this.maxWatermarkAge = options.maxWatermarkAge ?? 60 * 60 * 1000; // 1 hour
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 5 * 60 * 1000; // 5 minutes
    this.allowOutOfOrder = options.allowOutOfOrder ?? false;

    // Start periodic cleanup
    this.startCleanup();
  }

  private check(feedId: string, ts: number): Verdict {
    let state = this.feedState.get(feedId);
    if (!state) {
      state = { watermark: 0, seen: new Set() };
      this.feedState.set(feedId, state);
    }

    if (state.seen.has(ts)) {
      return Verdict.Duplicate;
    }

    if (state.seen.size >= SEEN_BUFFER_SIZE) {
      const oldest = state.seen.values().next().value!;
      state.seen.delete(oldest);
    }
    state.seen.add(ts);

    const isOutOfOrder = state.watermark > 0 && ts < state.watermark;
    if (isOutOfOrder) {
      return Verdict.OutOfOrder;
    }

    if (ts > state.watermark) {
      state.watermark = ts;
    }

    return Verdict.Accept;
  }

  // Process a report and return a verdict on whether it is accepted, duplicated, or out-of-order.
  processReport(report: ReportMetadata): DeduplicationResult {
    const feedId = report.feedID;
    const ts = report.observationsTimestamp;
    const verdict = this.check(feedId, ts);

    switch (verdict) {
      case Verdict.Duplicate:
        this.deduplicatedCount++;
        return {
          isAccepted: false,
          isDuplicate: true,
          isOutOfOrder: false,
          reason: `Duplicate timestamp ${ts} already seen for feed ${feedId}`,
        };

      case Verdict.OutOfOrder: {
        this.outOfOrderCount++;
        if (!this.allowOutOfOrder) {
          this.deduplicatedCount++;
          return {
            isAccepted: false,
            isDuplicate: false,
            isOutOfOrder: true,
            reason: `Out-of-order timestamp ${ts} < watermark ${this.feedState.get(feedId)!.watermark} for feed ${feedId}`,
          };
        }
        this.acceptedCount++;
        return { isAccepted: true, isDuplicate: false, isOutOfOrder: true };
      }

      case Verdict.Accept:
        this.acceptedCount++;
        return { isAccepted: true, isDuplicate: false, isOutOfOrder: false };
    }
  }

  // Get statistics on deduplication performance.
  getStats(): DeduplicationStats {
    return {
      accepted: this.acceptedCount,
      deduplicated: this.deduplicatedCount,
      outOfOrder: this.outOfOrderCount,
      totalReceived: this.acceptedCount + this.deduplicatedCount,
      watermarkCount: this.feedState.size,
    };
  }

  // Get the watermark for a feed.
  getWatermark(feedId: string): number | undefined {
    return this.feedState.get(feedId)?.watermark;
  }

  reset(): void {
    this.acceptedCount = 0;
    this.deduplicatedCount = 0;
    this.outOfOrderCount = 0;
    this.feedState.clear();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldWatermarks();
    }, this.cleanupIntervalMs);
  }

  // Clean up old watermarks to keep memory usage under control.
  private cleanupOldWatermarks(): void {
    const now = Date.now();
    // todo: this assumes that the timestamp is in seconds, introduce millisecond support when sdk is
    // updated to handle millisecond timestamps.
    const cutoffTimestamp = Math.floor((now - this.maxWatermarkAge) / 1000);

    for (const [feedId, state] of this.feedState) {
      if (state.watermark < cutoffTimestamp) {
        this.feedState.delete(feedId);
      }
    }
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
