# Demo Pipeline Suite

This document provides comprehensive documentation for the Demo Pipeline Suite - a collection of 8 demonstration pipelines that showcase the capabilities, patterns, and best practices of the Orbit Pipeline framework.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Pipeline Catalog](#pipeline-catalog)
- [Running the Demos](#running-the-demos)
- [Testing](#testing)
- [Performance Benchmarks](#performance-benchmarks)
- [Common Patterns](#common-patterns)

## Overview

The Demo Pipeline Suite consists of 8 carefully crafted pipelines that demonstrate different aspects of pipeline development:

1. **Async & Timing Demo** - Configurable delays and timing validation
2. **Retry Logic Demo** - Automatic retry mechanisms with exponential backoff
3. **Parallel Execution Demo** - Concurrent task execution
4. **Error Recovery Demo** - Error handling and recovery patterns
5. **Connection Pool Demo** - Resource management with limited pools
6. **Data Transformation Demo** - Multi-stage data processing
7. **Multi-Service Integration Demo** - Orchestrating multiple mock services
8. **Document Processing** - Real-world integration with S3, Veryfi API, and PostgreSQL

### Purpose

These demos serve multiple purposes:

- **Learning Resource**: Help developers understand pipeline patterns
- **Testing Suite**: Validate framework functionality
- **Performance Baselines**: Establish performance expectations
- **Reference Implementation**: Provide examples for real-world use cases

## Getting Started

### Prerequisites

- Node.js v18+ or v20+
- PostgreSQL database
- Dependencies installed (`npm install`)

### Initial Setup

1. **Build the Project**
   ```bash
   npm run build
   ```

2. **Sync Pipelines to Database**
   ```bash
   npm run sync:pipelines
   ```

3. **Verify Installation**
   ```bash
   npm test -- tests/integration/demo-suite.test.ts
   ```

## Pipeline Catalog

### 1. Async & Timing Demo

**Purpose**: Demonstrates asynchronous operations with varying delays and timing validation.

**Key Features**:
- Sequential execution with different delay profiles (5s, 2s, 0s, 3s)
- Timeout enforcement and error handling
- Timing accuracy validation
- Performance metrics calculation

**Location**: `src/pipelines/async-timing-demo.ts`

**Expected Duration**: ~10 seconds (10-13s with overhead)

**Steps**:
1. `slow-step` - 5000ms delay
2. `medium-step` - 2000ms delay
3. `instant-step` - Near 0ms delay
4. `timeout-test` - 3000ms delay
5. `timing-summary` - Validates all timings

**Example Output**:
```
⏱️  Step 1: Slow Step (5000ms)
  ✅ Completed in 5001ms

⏱️  Step 2: Medium Step (2000ms)
  ✅ Completed in 2001ms

⚡ Step 3: Instant Step (~0ms)
  ✅ Completed in 1ms

⏱️  Step 4: Timeout Test (3000ms)
  ✅ Completed in 3000ms

📊 Step 5: Timing Summary
  ✅ slow-step: expected 5000ms, actual 5001ms
  ✅ medium-step: expected 2000ms, actual 2001ms
  ✅ instant-step: expected 0ms, actual 1ms
  ✅ timeout-test: expected 3000ms, actual 3000ms

  📈 Performance Metrics:
     Total Duration: 10003ms
     Efficiency: 99.97%
```

**CLI Commands**:
```bash
# Run via test script
node scripts/test-async-timing.mjs

# Run via test suite
npm test -- tests/integration/async-timing-demo.test.ts
```

---

### 2. Retry Logic Demo

**Purpose**: Demonstrates automatic retry mechanisms with exponential backoff.

**Key Features**:
- Configurable retry attempts (maxRetries)
- Exponential backoff delays
- Success after retries
- Failure after exhausting retries

**Location**: `src/pipelines/retry-logic-demo.ts`

**Expected Duration**: ~15 seconds (can vary with retries)

**Steps**:
1. `init-retry-config` - Initialize configuration
2. `first-failure-then-success` - Fails first, succeeds on retry
3. `always-fail-step` - Exhausts all retries
4. `retry-summary` - Reports on retry behavior

**Example Output**:
```
🔄 Step 2: First Failure Then Success
  🔄 Attempt 1 - Failed
  🔄 Attempt 2 - Success!
  ✅ Completed after 2 attempts

🔄 Step 3: Always Fail Step
  🔄 Attempt 1 - Failed
  🔄 Attempt 2 - Failed
  🔄 Attempt 3 - Failed
  ❌ Failed after 3 attempts

📊 Step 4: Retry Summary
  Successful Retries: 1
  Failed Retries: 1
  Total Attempts: 6
```

**CLI Commands**:
```bash
# Run individual pipeline
node scripts/test-retry-logic.mjs

# Run tests
npm test -- tests/integration/retry-logic-demo.test.ts
```

---

### 3. Parallel Execution Demo

**Purpose**: Demonstrates concurrent task execution using Promise.all.

**Key Features**:
- Multiple tasks executing simultaneously
- Reduced total execution time vs sequential
- Proper Promise handling
- Result aggregation

**Location**: `src/pipelines/parallel-execution-demo.ts`

**Expected Duration**: ~1 second (vs ~3s sequential)

**Steps**:
1. `task-config` - Initialize task configuration
2. `parallel-task-executor` - Execute 3 tasks in parallel (1s each)
3. `result-aggregator` - Aggregate and validate results

**Example Output**:
```
🔀 Step 2: Parallel Task Executor
  Executing 3 tasks in parallel...

  🚀 Task 1 started
  🚀 Task 2 started
  🚀 Task 3 started

  ✅ Task 1 completed in 1001ms
  ✅ Task 2 completed in 1001ms
  ✅ Task 3 completed in 1002ms

  ✅ All tasks completed in ~1s (parallel)
     Sequential would have taken ~3s
```

**CLI Commands**:
```bash
npm test -- tests/integration/parallel-execution-demo.test.ts
```

---

### 4. Error Recovery Demo

**Purpose**: Demonstrates error handling and recovery patterns.

**Key Features**:
- Graceful error handling
- Partial pipeline completion
- Error recovery strategies
- Fallback mechanisms

**Location**: `src/pipelines/error-recovery-demo.ts`

**Expected Duration**: ~5 seconds

**Steps**:
1. `success-step` - Always succeeds
2. `error-step` - Intentionally fails
3. `recovery-step` - Recovers from error
4. `error-recovery-summary` - Reports results

**Example Output**:
```
✅ Step 1: Success Step
  Completed successfully

❌ Step 2: Error Step
  Intentional error occurred

🔧 Step 3: Recovery Step
  Recovering from previous error...
  ✅ Recovery successful

📊 Step 4: Error Recovery Summary
  Total Steps: 4
  Successful: 3
  Failed: 1
  Recovery Applied: Yes
```

**CLI Commands**:
```bash
npm test -- tests/integration/error-recovery-demo.test.ts
```

---

### 5. Connection Pool Demo

**Purpose**: Demonstrates resource management with a limited connection pool.

**Key Features**:
- Connection pool with max 3 connections
- 5 concurrent queries competing for connections
- FIFO queuing when pool exhausted
- Wait time analysis and metrics

**Location**: `src/pipelines/connection-pool-demo.ts`

**Expected Duration**: ~4 seconds (2 rounds of 2s)

**Steps**:
1. `init-pool` - Initialize connection pool (max 3)
2. `parallel-queries` - Launch 5 concurrent database queries (2s each)
3. `pool-metrics-analyzer` - Analyze pool metrics and wait times

**Example Output**:
```
🏊 Step 1: Initialize Connection Pool
  ✅ Connection pool initialized with 3 connections

💾 Step 2: Execute 5 Parallel Queries
  🚀 Launching Query 1
  🔌 Connection conn-1 acquired. Active: 1/3

  🚀 Launching Query 2
  🔌 Connection conn-2 acquired. Active: 2/3

  🚀 Launching Query 3
  🔌 Connection conn-3 acquired. Active: 3/3

  🚀 Launching Query 4
  ⏳ No connections available. Queued. Queue length: 1

  🚀 Launching Query 5
  ⏳ No connections available. Queued. Queue length: 2

  [After 2000ms]
  🔄 Connection conn-1 released and immediately reassigned
  ✅ Query 1 completed in 2001ms

  🔄 Connection conn-2 released and immediately reassigned
  ✅ Query 2 completed in 2001ms

  ✅ Connection conn-3 released
  ✅ Query 3 completed in 2000ms

  ✅ Query 4 completed in 4002ms (waited 2000ms)
  ✅ Query 5 completed in 4002ms (waited 2000ms)

📊 Step 3: Pool Metrics Analysis
  📈 Pool Metrics:
     Total Queries: 5
     Peak Active Connections: 3/3 ✅
     Max Queue Length: 2
     Average Wait Time: 801ms

  ⏱️  Query Timings:
     ✅ Query 1: 2001ms total, 1ms wait (~0ms wait)
     ✅ Query 2: 2001ms total, 1ms wait (~0ms wait)
     ✅ Query 3: 2001ms total, 1ms wait (~0ms wait)
     ✅ Query 4: 4002ms total, 2002ms wait (~2000ms wait)
     ✅ Query 5: 4002ms total, 2002ms wait (~2000ms wait)

  🎯 Validation Results:
     ✅ Peak usage within limit (3 ≤ 3)
     ✅ Wait times as expected
     ✅ Total execution time ~4000ms
```

**CLI Commands**:
```bash
node scripts/test-connection-pool.mjs

npm test -- tests/integration/connection-pool-demo.test.ts
```

---

### 6. Data Transformation Demo

**Purpose**: Demonstrates multi-stage data transformation pipelines.

**Key Features**:
- Data validation
- Transformation stages
- Data enrichment
- Result validation

**Location**: `src/pipelines/data-transformation-demo.ts`

**Expected Duration**: ~5 seconds

**Steps**:
1. `load-data` - Load raw data
2. `transform-data` - Apply transformations
3. `enrich-data` - Add enrichment
4. `validate-transformations` - Validate final result

**Example Output**:
```
📥 Step 1: Load Data
  Loaded 100 records

🔄 Step 2: Transform Data
  Transformed 100 records
  Applied: normalization, filtering

📊 Step 3: Enrich Data
  Enriched 95 records (5 filtered out)
  Added: metadata, timestamps

✅ Step 4: Validate Transformations
  All transformations successful
  Output: 95 valid records
```

**CLI Commands**:
```bash
npm test -- tests/integration/data-transformation-demo.test.ts
```

---

### 7. Multi-Service Integration Demo

**Purpose**: Demonstrates orchestration of multiple services.

**Key Features**:
- Service coordination
- Data flow between services
- Error handling across services
- Integration patterns

**Location**: `src/pipelines/multi-service-integration-demo.ts`

**Expected Duration**: ~15 seconds

**Steps**:
1. `init-services` - Initialize all services
2. `service-a` - Call Service A
3. `service-b` - Call Service B (depends on A)
4. `service-c` - Call Service C (depends on B)
5. `orchestration-summary` - Summary of integration

**Example Output**:
```
🚀 Step 1: Initialize Services
  ✅ Service A initialized
  ✅ Service B initialized
  ✅ Service C initialized

📞 Step 2: Service A
  ✅ Processing complete
  Output: data_a

📞 Step 3: Service B
  Input: data_a
  ✅ Processing complete
  Output: data_b

📞 Step 4: Service C
  Input: data_b
  ✅ Processing complete
  Output: data_c

📊 Step 5: Orchestration Summary
  Services Called: 3
  Success Rate: 100%
  Total Processing Time: 15002ms
```

**CLI Commands**:
```bash
npm test -- tests/integration/multi-service-integration-demo.test.ts
```

---

### 8. Document Processing

**Purpose**: Demonstrates a complete real-world workflow integrating external services.

**Key Features**:
- Real AWS S3 integration (not mocked)
- Real Veryfi API integration for document data extraction
- PostgreSQL database storage with Run ID association
- Production-ready retry configuration
- Service-to-service data flow
- Complete error handling at each stage

**Location**: `src/pipelines/document-processing.ts`

**Expected Duration**: ~10-20 seconds (varies with API response time)

**Steps**:
1. `s3-upload` - Upload document to S3 bucket (3 retries, 60s timeout)
2. `veryfi-process` - Process document via Veryfi API (2 retries, 3min timeout)
3. `veryfi-storage` - Store extracted data in PostgreSQL (2 retries, 30s timeout)

**Example Output**:
```
📤 Step 1: S3 Upload
  Uploading: /path/to/document.pdf
  ✅ Uploaded to S3: s3://bucket/uploads/2024-01-01-uuid-document.pdf
  Size: 1,024,000 bytes

📄 Step 2: Veryfi Processing
  Processing S3 document...
  Veryfi API called for document extraction
  ✅ Veryfi processing complete
  Veryfi ID: 12345
  Document Type: receipt
  Vendor: Example Store
  Total: $150.50

💾 Step 3: Database Storage
  Storing Veryfi results...
  ✅ Stored in database
  Document ID: cuid_abc123
  Run ID: run_xyz789
  Status: completed
```

**Configuration Requirements**:
- AWS credentials (S3_BUCKET_NAME, AWS_REGION, or AWS credentials)
- Veryfi API credentials (VERYFI_CLIENT_ID, VERYFI_USERNAME, VERYFI_API_KEY)
- PostgreSQL database connection
- File path in metadata: `{ filePath: '/path/to/document.pdf' }`

**CLI Commands**:
```bash
# Run via test script (requires real credentials)
node scripts/test-document-processing.mjs

# Run via test suite
npm test -- tests/integration/document-processing.test.ts
```

**Notes**:
- This pipeline requires real credentials and will make actual API calls
- Costs may be incurred for Veryfi API usage
- Suitable for production use cases
- Demonstrates integration patterns for real-world applications

---

## Running the Demos

### Method 1: Individual Test Scripts

Some pipelines have dedicated test scripts:

```bash
# Connection Pool Demo
node scripts/test-connection-pool.mjs

# Document Processing (multi-service example)
node scripts/test-document-processing.mjs
```

### Method 2: Jest Test Suite

Run individual pipeline tests:

```bash
# Single pipeline
npm test -- tests/integration/async-timing-demo.test.ts

# All integration tests
npm test -- tests/integration/

# Comprehensive demo suite
npm test -- tests/integration/demo-suite.test.ts
```

### Method 3: Benchmark Suite

Run performance benchmarks:

```bash
# Single run of all pipelines
node scripts/benchmark-demos.mjs

# Multiple runs for averaging
node scripts/benchmark-demos.mjs --runs=5

# Verbose output
node scripts/benchmark-demos.mjs --verbose
```

## Testing

### Integration Test Suite

The comprehensive test suite validates all pipelines:

```bash
npm test -- tests/integration/demo-suite.test.ts
```

This suite includes:
- ✅ Smoke test (all pipelines execute successfully)
- ✅ Individual pipeline validation
- ✅ Performance benchmark tests
- ✅ Success criteria verification

### Test Coverage

Run with coverage reporting:

```bash
npm run test:coverage -- tests/integration/
```

### Continuous Testing

Watch mode for development:

```bash
npm run test:watch -- tests/integration/demo-suite.test.ts
```

## Performance Benchmarks

### Expected Performance

| Pipeline | Expected | Max | Description |
|----------|----------|-----|-------------|
| Async & Timing | 10s | 13s | Sequential delays |
| Retry Logic | 15s | 25s | With retries |
| Parallel Execution | 1s | 5s | 3 parallel tasks |
| Error Recovery | 5s | 15s | Error handling |
| Connection Pool | 4s | 7s | Pool management |
| Data Transformation | 5s | 10s | Multi-stage transform |
| Multi-Service | 15s | 25s | Service orchestration |
| Document Processing | 10s | 30s | Real API integration (S3 + Veryfi) |

### Running Benchmarks

```bash
# Standard benchmark
node scripts/benchmark-demos.mjs

# Multiple runs (recommended for accurate results)
node scripts/benchmark-demos.mjs --runs=5

# Save results to file
node scripts/benchmark-demos.mjs --runs=5 > benchmark-results.txt
```

### Interpreting Results

The benchmark script outputs:
- ✅ **PASSED**: Pipeline completed within max target
- ⚠️ **WARNING**: Pipeline exceeded max target
- ❌ **FAILED**: Pipeline encountered errors

Example output:
```
✅ Async & Timing Demo
   Target: 10000ms (max: 13000ms)
   Average: 10523ms
   Status: PASSED ✅

⚠️ Retry Logic Demo
   Target: 15000ms (max: 25000ms)
   Average: 26103ms
   ⚠️  Exceeded by 1103ms
   Status: WARNING: Exceeded target ⚠️
```

## Common Patterns

### Pattern 1: Retry Logic

```typescript
step(
  'flaky-operation',
  async (ctx) => {
    // Your operation here
    return await someOperation();
  },
  {
    maxRetries: 3,
    timeout: 5000
  }
)
```

### Pattern 2: Parallel Execution

```typescript
step('parallel-tasks', async (ctx) => {
  const tasks = Array.from({ length: 5 }, () =>
    someAsyncOperation()
  );

  const results = await Promise.all(tasks);

  return {
    success: true,
    data: results
  };
})
```

### Pattern 3: Connection Pool

```typescript
const pool = new MockConnectionPool(3);

step('query', async (ctx) => {
  const conn = await pool.acquire();
  try {
    const result = await executeQuery(conn);
    return { success: true, data: result };
  } finally {
    pool.release(conn);
  }
})
```

### Pattern 4: Error Recovery

```typescript
step('operation-with-fallback', async (ctx) => {
  try {
    return await primaryOperation();
  } catch (error) {
    console.warn('Primary failed, using fallback');
    return await fallbackOperation();
  }
})
```

## Troubleshooting

### Common Issues

**1. Pipeline Times Out**
- Check that services are running
- Increase Jest timeout: `jest.setTimeout(30000)`
- Review step timeouts

**2. Connection Pool Deadlock**
- Ensure connections are always released
- Use try/finally blocks
- Check max connection limits

**3. Performance Below Target**
- Run benchmarks multiple times
- Check system resource usage
- Review database connection settings

**4. Test Failures**
- Ensure database is running
- Clear old test data
- Check environment variables

### Debug Mode

Enable verbose logging:

```bash
# Jest debug
DEBUG=* npm test -- tests/integration/demo-suite.test.ts

# Benchmark verbose
node scripts/benchmark-demos.mjs --verbose
```

## Additional Resources

- [Pipeline Development Guide](./PIPELINE-DEVELOPMENT.md)
- [API Reference](./API-REFERENCE.md)
- [Best Practices](./BEST-PRACTICES.md)
- [Contributing Guide](../CONTRIBUTING.md)

## Support

For questions or issues:
1. Check the [troubleshooting section](#troubleshooting)
2. Review existing [GitHub issues](https://github.com/org/repo/issues)
3. Create a new issue with:
   - Demo pipeline name
   - Expected vs actual behavior
   - Error messages and logs
   - System information

---

**Last Updated**: 2025-10-26
**Version**: 1.0.0
