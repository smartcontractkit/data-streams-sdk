import { ValidationError } from "../types/errors";
import { VALIDATION_REGEX } from "./constants";

/**
 * Validates a feed ID
 * @param feedId The feed ID to validate
 * @throws {ValidationError} If the feed ID is invalid
 */
export function validateFeedId(feedId: string): void {
  if (!feedId) {
    throw new ValidationError("Feed ID is required");
  }
  if (!VALIDATION_REGEX.FEED_ID.test(feedId)) {
    throw new ValidationError("Invalid feed ID format. Must be 0x followed by 64 hex characters");
  }
  const version = feedId.slice(2, 6);
  if (!VALIDATION_REGEX.SCHEMA_VERSION.test(`0x${version}`)) {
    throw new ValidationError(
      "Invalid feed ID version. Must start with 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0x0008, 0x0009, or 0x000a"
    );
  }
}

/**
 * Validates a timestamp
 * @param timestamp The timestamp to validate
 * @throws {ValidationError} If the timestamp is invalid
 */
export function validateTimestamp(timestamp: number): void {
  if (!Number.isInteger(timestamp)) {
    throw new ValidationError("Timestamp must be an integer");
  }
  if (timestamp < 0) {
    throw new ValidationError("Timestamp cannot be negative");
  }
}

/**
 * Validates an array of feed IDs
 * @param feedIds The array of feed IDs to validate
 * @throws {ValidationError} If any feed ID is invalid
 */
export function validateFeedIds(feedIds: string[]): void {
  if (!Array.isArray(feedIds)) {
    throw new ValidationError("Feed IDs must be an array");
  }
  if (feedIds.length === 0) {
    throw new ValidationError("At least one feed ID is required");
  }
  feedIds.forEach(validateFeedId);
}

/**
 * Validates a hex string (must start with 0x and contain only hex characters)
 * @param hexString The hex string to validate
 * @param fieldName The name of the field being validated (for error messages)
 * @throws {ValidationError} If the hex string is invalid
 */
export function validateHexString(hexString: string, fieldName: string = "hex string"): void {
  if (!hexString) {
    throw new ValidationError(`${fieldName} is required`);
  }
  if (typeof hexString !== "string") {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  if (!hexString.startsWith("0x")) {
    throw new ValidationError(`${fieldName} must start with 0x`);
  }
  if (!/^0x[0-9a-fA-F]+$/.test(hexString)) {
    throw new ValidationError(`${fieldName} contains invalid hex characters`);
  }
  if (hexString.length < 3) {
    throw new ValidationError(`${fieldName} must contain at least one hex character after 0x`);
  }
}

/**
 * Validate required environment variables
 * @throws ValidationError if required environment variables are missing
 */
export function validateEnvironment(): void {
  if (!process.env.API_KEY) {
    throw new ValidationError("API_KEY environment variable is required");
  }
  if (!process.env.USER_SECRET) {
    throw new ValidationError("USER_SECRET environment variable is required");
  }
}
