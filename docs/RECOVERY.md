# Run Recovery and Resume Logic

This document explains how Orbit handles pipeline crashes and interruptions, allowing seamless resumption of pipeline execution from the last successful step.

## Overview

Orbit's run recovery system provides automatic detection and resumption of interrupted pipeline runs. When a pipeline crashes or is interrupted (e.g., server restart, process kill, system failure), the recovery system can detect these interrupted runs and resume execution from the last successfully completed step.

## Key Features

- **Automatic Interruption Detection**: Identifies runs stuck in "running" status with no recent activity
- **Smart Resumption**: Resumes from the last successful step, skipping already-completed steps
- **Context Reconstruction**: Rebuilds step context from database, preserving results from completed steps
- **CLI Integration**: Multiple CLI commands for manual and automatic recovery
- **Failed Run Handling**: Detects and reports runs with failed steps that cannot be auto-resumed

## Architecture

### Components

1. **detectInterruptedRuns()**: Scans for runs in "running" status with no activity for >10 minutes
2. **analyzeStepCompletion()**: Analyzes which steps completed, failed, or remain pending
3. **reconstructStepContext()**: Rebuilds the `StepContext` from completed step results in PostgreSQL
4. **resumeRun()**: Executes remaining steps using reconstructed context
5. **RunRecoveryOrchestrator**: Coordinates detection and recovery of multiple runs

### Database Schema Support

The PostgreSQL schema tracks all necessary information for recovery:

```prisma
model Run {
  id          String    @id
  pipelineId  String
  startedAt   DateTime
  finishedAt  DateTime?
  status      String    // "pending" | "running" | "success" | "failed"
  triggeredBy String?
}

model Step {
  id           String    @id
  runId        String
  name         String
  startedAt    DateTime?
  finishedAt   DateTime?
  status       String    // "pending" | "running" | "success" | "failed" | "retrying"
  attemptCount Int
  error        String?
  result       String?   // JSON-serialized step result data
  nextRetryAt  DateTime?
}
```

## CLI Usage

### Check for Interrupted Runs

```bash
# Check without resuming
orbit check-interrupted
```

Output example:
```
Checking for Interrupted Runs

Found 2 interrupted run(s):

Run ID: clx1234567
  Pipeline: data-pipeline
  Started: 2025-01-15T10:30:00.000Z
  Last activity: 2025-01-15T10:35:00.000Z
  Completed steps: 3
  Failed steps: 0
  Next step: transform-data

To resume a specific run, use: orbit resume <runId>
To auto-resume all runs, use: orbit recover --auto-resume
```

### Resume a Specific Run

```bash
# Resume by run ID
orbit resume clx1234567
```

Output:
```
Resuming Run: clx1234567

✓ Run clx1234567 resumed successfully
ℹ Steps executed: 2
```

### Auto-Recover All Interrupted Runs

```bash
# Detect and recover all interrupted runs
orbit recover --auto-resume
```

Output:
```
Run Recovery

Scanning for interrupted runs...

Attempting to recover run clx1234567 (data-pipeline)...
✓ Recovered run clx1234567, executed 2 step(s)
Attempting to recover run clx7654321 (etl-pipeline)...
✓ Recovered run clx7654321, executed 4 step(s)

Recovery Summary:
  Detected: 2
  Recovered: 2
  Failed: 0

All interrupted runs recovered successfully
```

### Auto-Recovery on Startup

Enable automatic recovery when starting the CLI:

```bash
# Run with auto-recovery enabled
orbit --auto-recover run my-pipeline
```

This will automatically detect and resume any interrupted runs before executing the requested command.

## Programmatic Usage

### Using the Recovery API

```typescript
import {
  detectInterruptedRuns,
  resumeRun,
  RunRecoveryOrchestrator,
} from 'orbit-pipeline';

// Detect interrupted runs
const interruptedRuns = await detectInterruptedRuns();
console.log(`Found ${interruptedRuns.length} interrupted runs`);

// Resume a specific run
const result = await resumeRun('run-id');
if (result.success) {
  console.log(`Executed ${result.stepsExecuted} steps`);
} else {
  console.error(`Recovery failed: ${result.error}`);
}

// Orchestrated recovery of all runs
const orchestrator = new RunRecoveryOrchestrator();
const summary = await orchestrator.recoverInterruptedRuns();
console.log(`Recovered ${summary.recovered}/${summary.detected} runs`);
```

### Custom Recovery Logic

```typescript
import {
  detectInterruptedRuns,
  analyzeStepCompletion,
  reconstructStepContext
} from 'orbit-pipeline';

// Custom recovery workflow
const runs = await detectInterruptedRuns();

for (const run of runs) {
  // Analyze step completion
  const analysis = await analyzeStepCompletion(run.runId);

  // Only resume if no failures
  if (analysis.failedSteps.length === 0) {
    // Reconstruct context
    const context = await reconstructStepContext(
      run.runId,
      run.pipelineId
    );

    // Custom logic here...
  }
}
```

## Idempotent Step Design

For reliable recovery, pipeline steps should be designed to be **idempotent** - meaning they can be safely executed multiple times without unintended side effects.

### Best Practices

#### 1. Check-Before-Execute Pattern

```typescript
definePipeline({
  name: 'data-import',
  steps: [
    {
      name: 'import-data',
      handler: async (ctx: StepContext) => {
        // Check if already imported
        const existing = await db.query(
          'SELECT id FROM imports WHERE batch_id = $1',
          [ctx.metadata?.batchId]
        );

        if (existing.rows.length > 0) {
          // Already imported, return early
          return {
            success: true,
            data: { importId: existing.rows[0].id, skipped: true }
          };
        }

        // Perform import
        const result = await performImport(ctx.metadata?.batchId);
        return { success: true, data: result };
      }
    }
  ]
});
```

#### 2. Unique Identifiers

Use unique identifiers to track operations:

```typescript
{
  name: 'send-notifications',
  handler: async (ctx: StepContext) => {
    // Generate idempotency key from run context
    const idempotencyKey = `notification-${ctx.runId}-${ctx.metadata?.userId}`;

    // Check if notification already sent
    const sent = await redis.get(idempotencyKey);
    if (sent) {
      return { success: true, data: { notificationId: sent, skipped: true } };
    }

    // Send notification
    const notificationId = await sendNotification(ctx.metadata?.userId);

    // Store idempotency key
    await redis.set(idempotencyKey, notificationId, 'EX', 86400);

    return { success: true, data: { notificationId } };
  }
}
```

#### 3. Upsert Operations

Use upsert (INSERT ... ON CONFLICT UPDATE) for database operations:

```typescript
{
  name: 'update-user-profile',
  handler: async (ctx: StepContext) => {
    const userId = ctx.prevResults['fetch-user']?.data?.userId;

    // Upsert ensures safe re-execution
    await db.query(`
      INSERT INTO user_profiles (user_id, data, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET data = $2, updated_at = NOW()
    `, [userId, ctx.metadata?.profileData]);

    return { success: true };
  }
}
```

#### 4. State Tracking

Track operation state explicitly:

```typescript
{
  name: 'process-payment',
  handler: async (ctx: StepContext) => {
    const orderId = ctx.metadata?.orderId;

    // Check current state
    const order = await db.query(
      'SELECT payment_status FROM orders WHERE id = $1',
      [orderId]
    );

    if (order.rows[0]?.payment_status === 'completed') {
      // Payment already processed
      return { success: true, data: { status: 'already_processed' } };
    }

    // Process payment with idempotent external API
    const result = await paymentGateway.charge({
      orderId,
      idempotencyKey: `order-${orderId}-${ctx.runId}`
    });

    // Update state
    await db.query(
      'UPDATE orders SET payment_status = $1 WHERE id = $2',
      ['completed', orderId]
    );

    return { success: true, data: result };
  }
}
```

### Anti-Patterns to Avoid

#### ❌ Non-Idempotent Operations

```typescript
// BAD: Increments on every execution
{
  name: 'update-counter',
  handler: async () => {
    await db.query('UPDATE counters SET count = count + 1');
    return { success: true };
  }
}

// GOOD: Set to specific value
{
  name: 'update-counter',
  handler: async (ctx: StepContext) => {
    const newCount = ctx.prevResults['calculate-count']?.data?.count;
    await db.query('UPDATE counters SET count = $1', [newCount]);
    return { success: true };
  }
}
```

#### ❌ Duplicate Side Effects

```typescript
// BAD: Sends email on every retry
{
  name: 'send-welcome-email',
  handler: async (ctx: StepContext) => {
    await emailService.send(ctx.metadata?.email, 'Welcome!');
    return { success: true };
  }
}

// GOOD: Track sent emails
{
  name: 'send-welcome-email',
  handler: async (ctx: StepContext) => {
    const emailId = `welcome-${ctx.runId}`;

    if (await emailLog.exists(emailId)) {
      return { success: true, data: { skipped: true } };
    }

    await emailService.send(ctx.metadata?.email, 'Welcome!');
    await emailLog.record(emailId);

    return { success: true };
  }
}
```

#### ❌ Stateful Dependencies

```typescript
// BAD: Relies on in-memory state
let processedCount = 0;

{
  name: 'process-items',
  handler: async () => {
    processedCount++; // Lost on crash!
    return { success: true, data: { count: processedCount } };
  }
}

// GOOD: Store state in database
{
  name: 'process-items',
  handler: async (ctx: StepContext) => {
    const count = await db.query(
      'SELECT COUNT(*) FROM processed_items WHERE run_id = $1',
      [ctx.runId]
    );
    return { success: true, data: { count: count.rows[0].count } };
  }
}
```

## Limitations

### Cannot Auto-Resume With Failed Steps

Runs with failed steps cannot be automatically resumed. You must:

1. Fix the underlying issue
2. Manually resume the run, or
3. Create a new run

```bash
# Check shows failed steps
orbit check-interrupted
# Output: Failed steps: 1

# Attempting to resume will fail
orbit resume <runId>
# Error: Run has 1 failed step(s), cannot auto-resume
```

### Pipeline Definition Must Be Available

The pipeline definition must be registered in the system for recovery to work:

```typescript
// Pipeline must be registered
import { registry } from 'orbit-pipeline';
import myPipeline from './pipelines/my-pipeline';

registry.registerPipeline(myPipeline);

// Now recovery can find and execute the pipeline
```

### Interrupted Run Threshold

By default, runs are considered "interrupted" if they've been in "running" status for more than **10 minutes** without step activity. This threshold is configurable:

```typescript
// In src/core/recovery.ts
const INTERRUPTED_RUN_THRESHOLD_MINUTES = 10;
```

## Testing Recovery

### Manual Testing

1. Start a pipeline execution
2. Kill the process during execution (Ctrl+C or kill command)
3. Check for interrupted runs:
   ```bash
   orbit check-interrupted
   ```
4. Resume the run:
   ```bash
   orbit resume <runId>
   ```

### Integration Tests

See `tests/recovery.test.ts` for comprehensive recovery tests:

```bash
# Run recovery tests
npm run test:recovery

# Run all tests with coverage
npm run test:coverage
```

## Monitoring and Observability

### Detecting Interrupted Runs in Production

Set up a cron job or scheduled task to periodically check for and recover interrupted runs:

```bash
# Run every 15 minutes
*/15 * * * * cd /app && orbit recover --auto-resume >> /var/log/orbit-recovery.log 2>&1
```

### Logging

Recovery operations are logged with detailed information:

```typescript
console.log(`Attempting to recover run ${runId} (${pipelineName})...`);
console.log(`✓ Recovered run ${runId}, executed ${stepsExecuted} step(s)`);
console.log(`✗ Failed to recover run ${runId}: ${error}`);
```

### Metrics

Track recovery metrics:

- Number of interrupted runs detected
- Recovery success rate
- Steps re-executed per recovery
- Average recovery time

## Best Practices Summary

1. **Design idempotent steps** - Steps should be safely re-executable
2. **Use check-before-execute patterns** - Verify work isn't already done
3. **Store state in database** - Don't rely on in-memory state
4. **Use unique identifiers** - Track operations with idempotency keys
5. **Test recovery scenarios** - Simulate crashes in development
6. **Monitor for interrupted runs** - Set up automated recovery checks
7. **Log recovery operations** - Track what was recovered and why

## See Also

- [Pipeline Development Guide](./PIPELINES.md)
- [Step Retry Logic](./RETRY.md)
- [Database Schema](../prisma/schema.prisma)
- [Recovery Tests](../tests/recovery.test.ts)
