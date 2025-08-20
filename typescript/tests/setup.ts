import { jest } from "@jest/globals";

// Increase timeout for integration tests
jest.setTimeout(30000);

// Add any global test setup here
process.env.NODE_ENV = "test";
