# Worker Metrics and Performance Monitoring

## Overview

The worker process now includes comprehensive metrics collection and performance monitoring. This system tracks execution statistics, calculates performance indicators, and exposes real-time metrics via tRPC endpoints.

## Features

### 1. Metrics Collection

The metrics system automatically tracks:

**Counters:**
- Total runs executed
- Successful runs count
- Failed runs count

**Timing Metrics:**
- Average execution time
- Minimum execution time
- Maximum execution time
- Total execution time

**Derived Metrics:**
- Success rate (percentage)
- Error rate (percentage)
- Runs per hour (throughput)
- Worker uptime (formatted)

**Recent Activity:**
- Maintains sliding window of recent executions (last 1 hour)
- Automatically prunes old data
- Limits storage to last 1000 executions

### 2. Automatic Metrics Tracking

Metrics are automatically recorded for every run execution:

```typescript
// In worker.ts
const startTime = Date.now();

try {
  await executeExistingRun(run, pipeline);
  const duration = Date.now() - startTime;

  // Record successful run
  recordRun(duration, true);
} catch (error) {
  const duration = Date.now() - startTime;

  // Record failed run
  recordRun(duration, false);
}
```

### 3. Periodic Metrics Logging

The worker logs metrics reports at regular intervals (default: 60 seconds):

```
Worker Metrics Report {
  "uptime": "5m 23s",
  "totalRuns": 42,
  "succeeded": 40,
  "failed": 2,
  "errorRate": "4.76%",
  "successRate": "95.24%",
  "runsPerHour": "480.00",
  "avgDuration": "1250ms",
  "minDuration": "234ms",
  "maxDuration": "3456ms"
}
```

### 4. tRPC Metrics Endpoint

Metrics are exposed via the tRPC API for consumption by dashboards:

```typescript
// Query worker metrics
const metrics = await trpc.worker.metrics.query();

// Response:
{
  uptime: "1h 23m 45s",
  uptimeSeconds: 5025,
  totalRuns: 150,
  successRate: 96.67,
  errorRate: 3.33,
  runsPerHour: 107.46,
  avgExecutionTime: 1234,
  minExecutionTime: 123,
  maxExecutionTime: 5678,
  succeeded: 145,
  failed: 5,
  workerStartTime: Date,
  lastRunTime: Date,
  timestamp: Date
}
```

## Configuration

### Environment Variables

```bash
# Metrics reporting interval (milliseconds)
METRICS_INTERVAL=60000  # Default: 60 seconds

# Poll interval (affects throughput calculations)
POLL_INTERVAL=5000      # Default: 5 seconds
```

### Starting the Worker with Metrics

```bash
# Development mode
npm run worker

# Production with PM2
npm run pm2:start

# Custom metrics interval
METRICS_INTERVAL=30000 npm run worker  # Report every 30 seconds
```

## API Usage

### Using tRPC Client

```typescript
import { trpc } from '../utils/trpc';

function WorkerMetrics() {
  const { data } = trpc.worker.metrics.useQuery();

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h2>Worker Performance</h2>
      <p>Uptime: {data.uptime}</p>
      <p>Total Runs: {data.totalRuns}</p>
      <p>Success Rate: {data.successRate.toFixed(2)}%</p>
      <p>Error Rate: {data.errorRate.toFixed(2)}%</p>
      <p>Throughput: {data.runsPerHour.toFixed(2)} runs/hour</p>
      <p>Avg Duration: {data.avgExecutionTime}ms</p>
    </div>
  );
}
```

### Direct Usage in Worker Code

```typescript
import {
  recordRun,
  getMetrics,
  getMetricsSnapshot,
  startMetricsReporting,
  stopMetricsReporting,
} from './core/metrics.js';

// Record a run manually
recordRun(1234, true);  // 1234ms, success

// Get current metrics
const metrics = getMetrics();
console.log(`Success rate: ${metrics.successRate}%`);

// Get full snapshot
const snapshot = getMetricsSnapshot();
console.log(snapshot);

// Start periodic reporting (60 second interval)
startMetricsReporting(60000);

// Stop periodic reporting
stopMetricsReporting();
```

## Architecture

### Core Components

**1. MetricsCollector Class** (`src/core/metrics.ts`)
- Singleton class managing metrics state
- Tracks raw counters and timing data
- Calculates derived metrics on demand
- Handles periodic reporting

**2. Worker Integration** (`src/worker.ts`)
- Records metrics for every run execution
- Starts periodic reporting on startup
- Stops reporting on graceful shutdown

**3. tRPC Endpoint** (`src/server/routers/worker.router.ts`)
- Exposes `worker.metrics` query
- Returns real-time metrics data
- Handles cases where worker isn't running

### Data Flow

```
┌─────────────────────────────────────────────┐
│  Worker Process                             │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │ Run Execution                      │    │
│  │   ├─ Start Timer                   │    │
│  │   ├─ Execute Pipeline              │    │
│  │   └─ Record Metrics                │    │
│  └────────────┬───────────────────────┘    │
│               ▼                             │
│  ┌────────────────────────────────────┐    │
│  │ MetricsCollector                   │    │
│  │   ├─ Update Counters               │    │
│  │   ├─ Update Min/Max                │    │
│  │   ├─ Store Recent Executions       │    │
│  │   └─ Calculate Derived Metrics     │    │
│  └────────────┬───────────────────────┘    │
└───────────────┼─────────────────────────────┘
                │
                ├─────► Periodic Logs (Winston)
                │
                └─────► tRPC API Endpoint
                            │
                            ▼
                       Dashboard UI
```

## Metrics Details

### Raw Metrics

```typescript
interface WorkerMetrics {
  runsExecuted: number;           // Total count
  runsSucceeded: number;          // Success count
  runsFailed: number;             // Failure count
  totalExecutionTime: number;     // Cumulative ms
  minExecutionTime: number;       // Fastest run (ms)
  maxExecutionTime: number;       // Slowest run (ms)
  workerStartTime: number;        // Unix timestamp
  lastRunTime: number;            // Unix timestamp
  lastReportTime: number;         // Unix timestamp
  recentExecutions: Array<{       // Sliding window
    timestamp: number;
    duration: number;
    success: boolean;
  }>;
}
```

### Derived Metrics

```typescript
interface DerivedMetrics {
  errorRate: number;              // 0-100%
  successRate: number;            // 0-100%
  runsPerHour: number;           // Throughput
  avgExecutionTime: number;      // Average ms
  minExecutionTime: number;      // Fastest ms
  maxExecutionTime: number;      // Slowest ms
  uptime: number;                // Seconds
  uptimeFormatted: string;       // "1h 23m 45s"
  totalRuns: number;             // Total count
  totalSucceeded: number;        // Success count
  totalFailed: number;           // Failure count
}
```

## Performance Considerations

### Memory Usage

- Recent executions window limited to 1000 entries
- Automatic pruning of executions older than 1 hour
- Minimal memory footprint (~50KB for full history)

### CPU Usage

- Metrics calculation is O(n) where n = recent executions count
- Derived metrics calculated on-demand, not stored
- Negligible overhead (<1% CPU)

### Reporting Frequency

- Default: 60 seconds (recommended)
- Minimum: 10 seconds (for high-throughput scenarios)
- Maximum: No limit (adjust based on monitoring needs)

## Testing

Comprehensive test suite in `tests/metrics.test.ts`:

```bash
# Run metrics tests
npm test -- tests/metrics.test.ts

# All tests (21/21 passing):
✓ Basic Metrics Recording (3 tests)
✓ Min/Max Tracking (3 tests)
✓ Uptime Formatting (2 tests)
✓ Runs Per Hour Calculation (2 tests)
✓ Metrics Snapshot (1 test)
✓ Metrics Reset (1 test)
✓ Periodic Reporting (2 tests)
✓ Edge Cases (3 tests)
✓ Convenience Functions (2 tests)
✓ Recent Executions Window (2 tests)
```

## Troubleshooting

### Metrics Show Zero Values

**Cause**: Worker hasn't processed any runs yet, or metrics were reset

**Solution**:
- Create a pending run via UI
- Verify worker is running: `pm2 list`
- Check worker logs: `pm2 logs orbit-worker`

### Metrics Not Updating in UI

**Cause**: tRPC endpoint returns fallback values when worker isn't running

**Solution**:
- Verify worker process is running
- Check if metrics collection is enabled in worker
- Verify worker and UI are using same database

### High Memory Usage

**Cause**: Large number of runs in recent window

**Solution**:
- System automatically caps at 1000 recent executions
- Increase `METRICS_INTERVAL` to reduce reporting overhead
- No action needed - memory usage is bounded

### Metrics Inaccurate

**Cause**: Clock skew or timezone issues

**Solution**:
- Ensure system time is accurate
- All timestamps use `Date.now()` (UTC)
- Restart worker to reset baseline

## Future Enhancements

Potential additions for future versions:

1. **Persistent Metrics Storage**
   - Store historical metrics in database
   - Enable trend analysis over time
   - Support metric queries for specific time ranges

2. **Alerting System**
   - Configure threshold alerts (error rate > 10%)
   - Notification via email/Slack/webhook
   - Automatic recovery actions

3. **Distributed Metrics**
   - Aggregate metrics from multiple workers
   - Per-worker and cluster-wide views
   - Load balancing insights

4. **Advanced Analytics**
   - Percentile metrics (p50, p95, p99)
   - Pipeline-specific metrics
   - Step-level performance tracking

5. **Prometheus Integration**
   - Export metrics in Prometheus format
   - Enable Grafana dashboards
   - Industry-standard monitoring

## References

- Worker implementation: `src/worker.ts`
- Metrics system: `src/core/metrics.ts`
- tRPC endpoint: `src/server/routers/worker.router.ts`
- Test suite: `tests/metrics.test.ts`
- Worker PRD: `docs/worker-prd.txt`
