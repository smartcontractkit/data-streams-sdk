import { ValidationError } from "../types/errors";

/**
 * Get current Unix timestamp in seconds
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get Unix timestamp for 30 days ago in seconds
 */
export function getThirtyDaysAgoTimestamp(): number {
  return getCurrentTimestamp() - 30 * 24 * 60 * 60;
}

/**
 * Check if a timestamp is within the last 30 days
 * @param timestamp Unix timestamp in seconds
 * @returns boolean indicating if timestamp is within last 30 days
 */
export function isTimestampWithinLast30Days(timestamp: number): boolean {
  return timestamp >= getThirtyDaysAgoTimestamp();
}

/**
 * Validate that a timestamp is within the last 30 days
 * @param timestamp Unix timestamp in seconds
 * @throws ValidationError if timestamp is not within last 30 days
 */
export function validateTimestampWithin30Days(timestamp: number): void {
  if (!isTimestampWithinLast30Days(timestamp)) {
    throw new ValidationError(
      `Timestamp ${timestamp} is not within the last 30 days. ` +
        `Earliest allowed timestamp is ${getThirtyDaysAgoTimestamp()}`
    );
  }
}
