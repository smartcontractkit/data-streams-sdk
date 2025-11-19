# Chainlink Data Streams SDK - Examples

Example scripts demonstrating various SDK features and usage patterns.

## Setup

1. **Clone the repository:**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the SDK:**
   ```bash
   npm run build
   ```

4. **Set your API credentials:**

   Option 1 - Environment variables:
   ```bash
   export API_KEY="your_api_key_here"
   export USER_SECRET="your_user_secret_here"
   ```

   Option 2 - `.env` file:
   ```bash
   # Create .env file from template
   cp .env.example .env
   
   # Edit .env with your credentials
   API_KEY="your_api_key_here"
   USER_SECRET="your_user_secret_here"
   ```

## Examples

### Streaming Reports

**`stream-reports.ts`** - Real-time report streaming with optional High Availability (HA) mode
```bash
# Single feed
npx ts-node examples/stream-reports.ts <feedID>

# Multiple feeds
npx ts-node examples/stream-reports.ts <feedID1>,<feedID2>

# High Availability mode (mainnet only - uses multiple connections)
## Single feed
npx ts-node examples/stream-reports.ts <feedID> --ha
## Multiple feeds
npx ts-node examples/stream-reports.ts <feedID1>,<feedID2> --ha
```

### Historical Data

**`get-latest-report.ts`** - Fetch latest report for a feed
```bash
npx ts-node examples/get-latest-report.ts <feedID>
```

**`get-report-by-timestamp.ts`** - Fetch report at specific timestamp
```bash
npx ts-node examples/get-report-by-timestamp.ts <feedID> <timestamp>
```

**`get-reports-page.ts`** - Fetch range of reports
```bash
# Get 10 reports starting from timestamp
npx ts-node examples/get-reports-page.ts <feedID> <timestamp> 10
```

**`get-reports-bulk.ts`** - Fetch reports for multiple feeds
```bash
npx ts-node examples/get-reports-bulk.ts <feedID1> <feedID2> [feedID3...] <timestamp>
```

**Note**: Reports are not guaranteed to be returned in the same order as input feedIds. Always use `report.feedID` to identify each report rather than relying on array position.

### Feed Management

**`list-feeds.ts`** - List available feeds
```bash
npx ts-node examples/list-feeds.ts
```

## Feed IDs

The SDK automatically detects and supports all report schema versions (V2, V3, V4, V5, V6, V7, V8, V9, V10, V11, V13).

For available feed IDs, see the official [Chainlink documentation](https://docs.chain.link/data-streams/).

## Configuration & Debugging

### Logging Configuration

**`logging-basic.ts`** - **Comprehensive logging configuration showcase**
```bash
npx ts-node examples/logging-basic.ts
```

This example demonstrates **6 complete logging configurations** covering different use cases:

- **1️⃣ Silent Mode** - Default zero-overhead configuration
- **2️⃣ Basic Console** - Simple console.log integration  
- **3️⃣ Advanced Level Control** - Custom log level filtering
- **4️⃣ Development Debug** - Full debugging with WebSocket logs
- **5️⃣ Production Structured** - Enterprise-ready JSON logging
- **6️⃣ Error-Resilient** - Fault-tolerant logger integration

Shows 6 different logging scenarios. See the main [README](../README.md#logging-configuration) for detailed logging documentation.

### Metrics & Monitoring

**`metrics-monitoring.ts`** - **Metrics and monitoring showcase**
```bash
npx ts-node examples/metrics-monitoring.ts
```

**Note:** This example uses High Availability mode which requires mainnet endpoints.

This example demonstrates **comprehensive stream monitoring** with real-time metrics:

- **Stream Metrics** - Reports accepted, deduplicated, total received
- **Connection Health** - Active connections, reconnection tracking
- **Origin Status** - Per-origin connection status monitoring  
- **Stream Status** - High Availability mode detection, stability assessment
- **Real-time Dashboard** - Live metrics updates every 30 seconds + quick initial dashboard

Perfect for **monitoring integration** and understanding stream performance patterns. Shows how deduplication works in HA mode and provides actionable insights for reliability assessment.

## SDK Logging in Examples

All examples include **SDK logging integration** to help with debugging and learning. Simply uncomment the logging section to see internal SDK operations.

### Simple Examples (REST API)
Most examples like `get-latest-report.ts`, `get-reports-bulk.ts`, etc. include commented logging configuration:

```typescript
const config = {
  apiKey: process.env.API_KEY || "YOUR_API_KEY",
  userSecret: process.env.USER_SECRET || "YOUR_USER_SECRET",
  endpoint: "https://api.testnet-dataengine.chain.link",
  wsEndpoint: "wss://ws.testnet-dataengine.chain.link",
  // Uncomment to enable SDK logging for debugging:
  // logging: {
  //   logger: console,
  //   logLevel: LogLevel.INFO
  // }
};
```
