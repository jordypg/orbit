# Performance Monitoring

Real-time metrics collection and performance monitoring for the worker process.

## Features

- **Execution Statistics** - Success rate, error rate, throughput (runs/hour)
- **Timing Metrics** - Average, min, max execution times
- **Worker Health** - Uptime tracking and health status
- **Recent History** - Sliding 1-hour window (max 1000 executions)
- **tRPC API** - Real-time metrics endpoint for dashboards

## Usage

### Automatic Collection

Metrics are automatically recorded for every pipeline execution. No configuration required.

### Periodic Logging

Worker logs metrics every 60 seconds (configurable via `METRICS_INTERVAL`):
```
Worker Metrics Report {
  "uptime": "5m 23s", "totalRuns": 42, "succeeded": 40, "failed": 2,
  "errorRate": "4.76%", "successRate": "95.24%", "runsPerHour": "480.00",
  "avgDuration": "1250ms", "minDuration": "234ms", "maxDuration": "3456ms"
}
```

### tRPC API

```typescript
const metrics = await trpc.worker.metrics.query();
// Returns: uptime, totalRuns, successRate, errorRate, runsPerHour,
// avgExecutionTime, minExecutionTime, maxExecutionTime, timestamps
```

### React Component

```typescript
import { trpc } from '../utils/trpc';

function WorkerMetrics() {
  const { data } = trpc.worker.metrics.useQuery();
  return (
    <div>
      <p>Uptime: {data.uptime}</p>
      <p>Success Rate: {data.successRate.toFixed(2)}%</p>
      <p>Throughput: {data.runsPerHour.toFixed(2)} runs/hour</p>
    </div>
  );
}
```

## Configuration

```bash
# Environment variables
METRICS_INTERVAL=60000  # Reporting interval in ms (default: 60s)
POLL_INTERVAL=5000      # Affects throughput calculations (default: 5s)

# Start worker with custom interval
METRICS_INTERVAL=30000 npm run worker
```

## Metrics Data

```typescript
interface WorkerMetrics {
  // Uptime
  uptime: string;              // Formatted: "1h 23m 45s"
  uptimeSeconds: number;       // Raw seconds

  // Execution counts
  totalRuns: number;           // Total executions
  succeeded: number;           // Successful runs
  failed: number;              // Failed runs

  // Rates
  successRate: number;         // 0-100%
  errorRate: number;           // 0-100%
  runsPerHour: number;         // Throughput

  // Timing
  avgExecutionTime: number;    // Average ms
  minExecutionTime: number;    // Fastest ms
  maxExecutionTime: number;    // Slowest ms

  // Timestamps
  workerStartTime: Date;
  lastRunTime: Date;
  timestamp: Date;             // Current time
}
```

## Performance

- **Memory**: ~50KB for full history (1000 runs)
- **CPU**: <1% overhead for calculation
- **Accuracy**: Millisecond-precision timing

## Troubleshooting

**Metrics show zero values**
- Worker hasn't processed any runs yet
- Check worker is running: `pm2 list`

**Metrics not updating**
- Verify worker process is running
- Check worker and UI use same database

**High memory usage**
- Automatically capped at 1000 executions
- No action needed - memory is bounded

## References

- Worker implementation: `src/worker.ts`
- Metrics system: `src/core/metrics.ts`
- tRPC endpoint: `src/server/routers/worker.router.ts`
- Test suite: `tests/metrics.test.ts`
