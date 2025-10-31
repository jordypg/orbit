# Demo Pipeline Suite

Eight demonstration pipelines showcasing the framework's capabilities, patterns, and best practices.

## Overview

| Pipeline | Purpose | Duration | Key Features |
|----------|---------|----------|--------------|
| Async & Timing | Asynchronous operations and timing | ~10s | Delays, timeouts, timing validation |
| Retry Logic | Automatic retry with backoff | ~15s | Configurable retries, failure handling |
| Parallel Execution | Concurrent task execution | ~1s | Promise.all, result aggregation |
| Error Recovery | Error handling patterns | ~5s | Graceful degradation, fallbacks |
| Connection Pool | Resource management | ~4s | Pool limits, queuing, metrics |
| Data Transformation | Multi-stage processing | ~5s | Data flow, validation, enrichment |
| Multi-Service Integration | Service orchestration | ~15s | Multiple services, coordination |
| Document Processing | Production workflow | ~10-20s | S3, Veryfi API, PostgreSQL |

## Getting Started

```bash
# Build and sync
npm run build
npm run sync:pipelines

# Run all demos
npm test -- tests/integration/demo-suite.test.ts

# Run individual demo
npm test -- tests/integration/async-timing-demo.test.ts
```

## Pipeline Details

### 1. Async & Timing Demo

**File**: `src/pipelines/async-timing-demo.ts` | **Duration**: ~10s

Demonstrates asynchronous operations with configurable delays (5s, 2s, 0s, 3s) and timing validation. Tests timeout enforcement and calculates performance metrics.

```bash
npm test -- tests/integration/async-timing-demo.test.ts
```

### 2. Retry Logic Demo

**File**: `src/pipelines/retry-logic-demo.ts` | **Duration**: ~15s

Automatic retry mechanisms with exponential backoff. Demonstrates eventual success after failures and maximum retry exhaustion handling.

```bash
npm test -- tests/integration/retry-logic-demo.test.ts
```

### 3. Parallel Execution Demo

**File**: `src/pipelines/parallel-execution-demo.ts` | **Duration**: ~1s

Concurrent task execution using Promise.all. Three 1-second tasks complete in ~1s total (vs ~3s sequential), demonstrating parallel speedup.

```bash
npm test -- tests/integration/parallel-execution-demo.test.ts
```

### 4. Error Recovery Demo

**File**: `src/pipelines/error-recovery-demo.ts` | **Duration**: ~5s

Error handling and recovery patterns. Demonstrates graceful degradation, fallback mechanisms, and partial pipeline completion.

```bash
npm test -- tests/integration/error-recovery-demo.test.ts
```

### 5. Connection Pool Demo

**File**: `src/pipelines/connection-pool-demo.ts` | **Duration**: ~4s

Resource management with limited connection pool (max 3 connections). Five concurrent queries demonstrate pool exhaustion, FIFO queuing, and wait time analysis.

```bash
node scripts/test-connection-pool.mjs
npm test -- tests/integration/connection-pool-demo.test.ts
```

### 6. Data Transformation Demo

**File**: `src/pipelines/data-transformation-demo.ts` | **Duration**: ~5s

Multi-stage data transformation pipeline with validation, filtering, enrichment, and result validation.

```bash
npm test -- tests/integration/data-transformation-demo.test.ts
```

### 7. Multi-Service Integration Demo

**File**: `src/pipelines/multi-service-integration-demo.ts` | **Duration**: ~15s

Service orchestration demonstrating coordination between multiple services, data flow, and cross-service validation.

```bash
npm test -- tests/integration/multi-service-integration-demo.test.ts
```

### 8. Document Processing

**File**: `src/pipelines/document-processing.ts` | **Duration**: ~10-20s

**Production-ready pipeline** integrating real external services:

1. **S3 Upload** - Upload document to AWS S3 (3 retries, 60s timeout)
2. **Veryfi Processing** - Extract data via Veryfi API (2 retries, 3min timeout)
3. **Database Storage** - Store results in PostgreSQL (2 retries, 30s timeout)

**Required Environment Variables**:
```env
# AWS S3
AWS_S3_BUCKET=bucket-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=key
AWS_SECRET_ACCESS_KEY=secret

# Veryfi API
VERYFI_CLIENT_ID=client-id
VERYFI_USERNAME=username
VERYFI_API_KEY=api-key

# Database (Prisma)
DATABASE_URL=postgresql://...
```

**Usage**:
```bash
node scripts/test-document-processing.mjs
npm test -- tests/integration/document-processing.test.ts
```

## Common Patterns

### Retry Logic
```typescript
step('flaky-operation', async (ctx) => {
  return await someOperation();
}, {
  maxRetries: 3,
  timeout: 5000
})
```

### Parallel Execution
```typescript
step('parallel-tasks', async (ctx) => {
  const tasks = Array.from({ length: 5 }, () => someAsyncOperation());
  const results = await Promise.all(tasks);
  return { success: true, data: results };
})
```

### Connection Pool
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

### Error Recovery
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

## Performance Benchmarks

| Pipeline | Target | Max | Status |
|----------|--------|-----|--------|
| Async & Timing | 10s | 13s | ✅ |
| Retry Logic | 15s | 25s | ✅ |
| Parallel Execution | 1s | 5s | ✅ |
| Error Recovery | 5s | 15s | ✅ |
| Connection Pool | 4s | 7s | ✅ |
| Data Transformation | 5s | 10s | ✅ |
| Multi-Service | 15s | 25s | ✅ |
| Document Processing | 10s | 30s | ✅ |

Run benchmarks:
```bash
node scripts/benchmark-demos.mjs --runs=5
```

## Troubleshooting

**Pipeline times out**
- Increase Jest timeout: `jest.setTimeout(30000)`
- Review step timeout configuration
- Check service availability

**Connection pool deadlock**
- Ensure connections are always released
- Use try/finally blocks
- Check max connection limits

**Test failures**
- Ensure database is running
- Clear old test data
- Verify environment variables

**Enable debug mode**:
```bash
DEBUG=* npm test -- tests/integration/demo-suite.test.ts
```

## Additional Resources

- [Pipeline Development Guide](./PIPELINE-DEVELOPMENT.md) (if exists)
- [Worker Deployment Guide](./WORKER-DEPLOYMENT.md)
- [Metrics Documentation](./METRICS.md)
- [Recovery System](./RECOVERY.md)
