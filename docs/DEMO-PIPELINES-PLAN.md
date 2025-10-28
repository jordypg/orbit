# Demo Pipelines - Comprehensive Plan

This document outlines a comprehensive set of demonstration pipelines to showcase the pipeline framework's capabilities, robustness, and features.

---

## 1. Async & Timing Pipeline
**Purpose:** Demonstrate asynchronous operations and time delay handling

### Pipeline: `async-timing-demo`

**Steps:**
1. **instant-step** (immediate)
   - Returns instantly
   - Demonstrates baseline timing

2. **slow-step** (5 second delay)
   - Simulates slow API call or processing
   - Uses `setTimeout` to delay 5 seconds
   - Returns processing results

3. **medium-step** (2 second delay)
   - Demonstrates different timing scenarios
   - Shows pipeline handles varying delays

4. **timeout-test** (configurable timeout)
   - Tests timeout enforcement
   - Can be configured to exceed timeout for failure testing
   - Demonstrates timeout recovery

**Key Features:**
- ✅ Async/await handling
- ✅ Configurable delays
- ✅ Timeout enforcement
- ✅ Progress tracking over time

**Test Scenarios:**
- All steps complete within timeouts → SUCCESS
- One step exceeds timeout → PARTIAL FAILURE
- Retry after timeout → RECOVERY

---

## 2. Retry Logic Pipeline
**Purpose:** Demonstrate retry mechanisms and exponential backoff

### Pipeline: `retry-demo`

**Steps:**
1. **flaky-service-1** (fails 2x, succeeds on 3rd)
   - Simulates unreliable external service
   - Tracks attempt count in context
   - Fails on attempts 1 and 2
   - Succeeds on attempt 3
   - Max retries: 3

2. **flaky-service-2** (fails 1x, succeeds on 2nd)
   - Different failure pattern
   - Succeeds faster to show variation
   - Max retries: 2

3. **permanent-failure** (always fails)
   - Demonstrates max retry exhaustion
   - Shows error handling when retries exhausted
   - Max retries: 2

4. **verify-retry-metrics** (analysis step)
   - Checks retry counts from previous steps
   - Validates retry behavior
   - Reports retry statistics

**Key Features:**
- ✅ Configurable max retries per step
- ✅ Exponential backoff timing
- ✅ Retry count tracking
- ✅ Eventual success vs permanent failure

**Test Data:**
```javascript
// Step tracks attempts in shared context
const attemptCount = (ctx.metadata.attemptCount || 0) + 1;
ctx.metadata.attemptCount = attemptCount;

if (attemptCount < 3) {
  return { success: false, error: `Attempt ${attemptCount} failed` };
}
```

---

## 3. Parallel Execution Pipeline
**Purpose:** Demonstrate parallel task execution with shared prerequisites

### Pipeline: `parallel-execution-demo`

**Steps:**
1. **prerequisite-step** (shared dependency)
   - Fetches common data needed by all parallel steps
   - Returns configuration object
   - Completes first

2. **parallel-task-a** (independent, uses prerequisite)
   - Processes data from prerequisite
   - Simulates 3 second operation
   - Can run parallel with B and C

3. **parallel-task-b** (independent, uses prerequisite)
   - Different processing from A
   - Simulates 4 second operation
   - Can run parallel with A and C

4. **parallel-task-c** (independent, uses prerequisite)
   - Yet another independent operation
   - Simulates 2 second operation
   - Can run parallel with A and B

5. **aggregator-step** (depends on A, B, C)
   - Waits for all parallel steps to complete
   - Combines results from A, B, C
   - Demonstrates fan-in pattern

**Key Features:**
- ✅ Shared prerequisite (fan-out pattern)
- ✅ Parallel execution (A, B, C run concurrently)
- ✅ Result aggregation (fan-in pattern)
- ✅ Optimal execution time (max of parallel steps, not sum)

**Execution Timeline:**
```
Time 0s:  [prerequisite] starts
Time 1s:  [prerequisite] completes
          [A], [B], [C] start in parallel
Time 3s:  [C] completes (2s duration)
Time 4s:  [A] completes (3s duration)
Time 5s:  [B] completes (4s duration)
          [aggregator] starts
Time 6s:  [aggregator] completes

Total: ~6s (not 1+3+4+2+1 = 11s if sequential)
```

---

## 4. Complex Dependency DAG Pipeline
**Purpose:** Demonstrate complex dependency graphs

### Pipeline: `complex-dag-demo`

**Steps:**
```
     [A]
    /   \
  [B]   [C]
    \   / \
     [D]  [E]
       \ /
       [F]
```

1. **step-a** (root)
   - No dependencies
   - Generates seed data

2. **step-b** (depends on A)
   - Processes A's data - path 1

3. **step-c** (depends on A)
   - Processes A's data - path 2
   - Can run parallel with B

4. **step-d** (depends on B and C)
   - Waits for both B and C
   - Merges results from both paths

5. **step-e** (depends on C only)
   - Independent from D
   - Can run parallel with D after C completes

6. **step-f** (depends on D and E)
   - Final aggregation
   - Waits for all paths to complete

**Key Features:**
- ✅ Diamond dependency pattern
- ✅ Multiple parallel branches
- ✅ Complex dependency resolution
- ✅ Optimal execution scheduling

**Execution Order:**
- Sequential: A → (B || C) → (D || E) → F
- B and C run in parallel after A
- D waits for both B and C
- E runs parallel with D (only needs C)
- F waits for both D and E

---

## 5. Error Recovery Pipeline
**Purpose:** Demonstrate error handling, propagation, and graceful degradation

### Pipeline: `error-recovery-demo`

**Steps:**
1. **reliable-step-1**
   - Always succeeds
   - Provides fallback data

2. **risky-step-2** (50% failure rate)
   - Randomly fails or succeeds
   - Tests error handling paths

3. **fallback-handler**
   - Checks if step-2 failed
   - If failed: uses step-1's data as fallback
   - If succeeded: uses step-2's data
   - Demonstrates graceful degradation

4. **optional-enhancement**
   - Only runs if step-2 succeeded
   - Skipped if using fallback path
   - Demonstrates conditional execution

5. **final-validator**
   - Runs regardless of path taken
   - Validates final result quality
   - Reports which path was used

**Key Features:**
- ✅ Error detection and handling
- ✅ Graceful fallback mechanisms
- ✅ Conditional step execution
- ✅ Multiple success paths

**Execution Paths:**
```
Success Path:
  reliable-step-1 → risky-step-2 (success) →
  fallback-handler (uses step-2) → optional-enhancement →
  final-validator

Fallback Path:
  reliable-step-1 → risky-step-2 (fail) →
  fallback-handler (uses step-1) → [skip optional-enhancement] →
  final-validator
```

---

## 6. Data Transformation Pipeline
**Purpose:** Demonstrate data flow and transformation through multiple steps

### Pipeline: `data-transformation-demo`

**Steps:**
1. **data-generator**
   - Creates sample dataset (array of objects)
   - Returns: `{ items: [...], count: 100 }`

2. **filter-step**
   - Filters items based on criteria
   - Uses data from data-generator
   - Returns: `{ items: [...], count: 50, filterRatio: 0.5 }`

3. **transform-step**
   - Transforms each filtered item
   - Adds computed fields
   - Returns: `{ items: [...], transformed: true }`

4. **parallel-analyzer-1** (analyze subset)
   - Analyzes first half of items
   - Computes statistics

5. **parallel-analyzer-2** (analyze subset)
   - Analyzes second half of items
   - Computes statistics
   - Runs parallel with analyzer-1

6. **merge-analysis**
   - Combines results from both analyzers
   - Computes overall statistics
   - Returns comprehensive report

**Key Features:**
- ✅ Data passing between steps
- ✅ Data transformation chains
- ✅ Parallel data processing
- ✅ Result aggregation

**Data Flow:**
```javascript
Generator → Filter → Transform → Split → [Analyzer-1, Analyzer-2] → Merge
   100        50        50              [25, 25]                      50
```

---

## 7. Resource Management Pipeline
**Purpose:** Demonstrate resource limits, rate limiting, and connection pooling

### Pipeline: `resource-management-demo`

**Steps:**
1. **resource-pool-init**
   - Creates shared resource pool
   - Stores in context metadata
   - Max connections: 3

2. **concurrent-task-1** (uses 1 connection)
   - Acquires resource from pool
   - Holds for 2 seconds
   - Releases back to pool

3. **concurrent-task-2** (uses 1 connection)
   - Same as task-1
   - Runs parallel with 1, 3, 4, 5

4. **concurrent-task-3** (uses 1 connection)
   - Same as task-1

5. **concurrent-task-4** (uses 1 connection)
   - Waits for available resource
   - Demonstrates queuing

6. **concurrent-task-5** (uses 1 connection)
   - Waits for available resource

7. **resource-metrics**
   - Reports pool usage statistics
   - Shows wait times
   - Validates resource cleanup

**Key Features:**
- ✅ Connection pool management
- ✅ Resource limiting (max 3 concurrent)
- ✅ Queuing when resources exhausted
- ✅ Proper resource cleanup

**Resource Timeline:**
```
Time 0s:  Pool initialized [3 available]
          Tasks 1,2,3 start [0 available]
          Tasks 4,5 queued
Time 2s:  Tasks 1,2,3 complete
          Tasks 4,5 start [1 available]
Time 4s:  Tasks 4,5 complete
          Pool cleaned up
```

---

## 8. Rate Limiting Pipeline
**Purpose:** Demonstrate API rate limiting and backoff strategies

### Pipeline: `rate-limit-demo`

**Steps:**
1. **api-call-1** (immediate)
   - First call succeeds immediately
   - Updates rate limit counter

2. **api-call-2** (immediate)
   - Second call succeeds
   - Updates counter

3. **api-call-3** (immediate)
   - Third call succeeds
   - Counter at limit (3 per 10 seconds)

4. **api-call-4** (rate limited)
   - Detects rate limit hit
   - Waits for window reset (10 seconds)
   - Retries successfully

5. **burst-handler**
   - Demonstrates burst handling
   - Queues multiple requests
   - Processes at allowed rate

6. **rate-limit-metrics**
   - Reports rate limit statistics
   - Shows wait times
   - Validates rate limit compliance

**Key Features:**
- ✅ Rate limit detection
- ✅ Automatic backoff and retry
- ✅ Sliding window enforcement
- ✅ Burst traffic handling

---

## 9. Conditional Branching Pipeline
**Purpose:** Demonstrate conditional execution paths based on runtime data

### Pipeline: `conditional-branching-demo`

**Steps:**
1. **input-classifier**
   - Analyzes input data
   - Returns classification: "small", "medium", or "large"

2. **small-processor** (conditional)
   - Only runs if classification == "small"
   - Fast processing path
   - Duration: 1 second

3. **medium-processor** (conditional)
   - Only runs if classification == "medium"
   - Moderate processing
   - Duration: 3 seconds

4. **large-processor** (conditional)
   - Only runs if classification == "large"
   - Heavy processing
   - Duration: 10 seconds

5. **result-normalizer**
   - Runs after whichever processor executed
   - Normalizes output format
   - Works with any processor result

**Key Features:**
- ✅ Runtime condition evaluation
- ✅ Conditional step skipping
- ✅ Dynamic execution paths
- ✅ Path convergence

**Execution Paths:**
```
Small:  classifier → small-processor → normalizer
Medium: classifier → medium-processor → normalizer
Large:  classifier → large-processor → normalizer
```

---

## 10. Event-Driven Pipeline
**Purpose:** Demonstrate event emission and handling during pipeline execution

### Pipeline: `event-driven-demo`

**Steps:**
1. **event-generator**
   - Emits custom events during execution
   - Events: `data_loaded`, `processing_started`, `milestone_reached`
   - Continues processing while emitting

2. **event-listener-step**
   - Listens for events from previous step
   - Reacts to events in real-time
   - Accumulates event log

3. **progress-reporter**
   - Emits progress events (0%, 25%, 50%, 75%, 100%)
   - Demonstrates progress tracking
   - Long-running step (10 seconds)

4. **event-aggregator**
   - Collects all events from pipeline
   - Generates event timeline
   - Reports event statistics

**Key Features:**
- ✅ Event emission during steps
- ✅ Event listening across steps
- ✅ Progress tracking
- ✅ Event timeline reconstruction

---

## 11. Cleanup and Rollback Pipeline
**Purpose:** Demonstrate cleanup handlers and rollback on failure

### Pipeline: `cleanup-rollback-demo`

**Steps:**
1. **allocate-resources**
   - Allocates temporary resources
   - Registers cleanup handler
   - Returns resource handles

2. **risky-operation**
   - Uses allocated resources
   - May fail (50% chance)
   - If fails, triggers rollback

3. **cleanup-handler** (always runs)
   - Runs even if previous steps failed
   - Releases all allocated resources
   - Logs cleanup actions

4. **rollback-if-needed**
   - Only runs if risky-operation failed
   - Reverts any partial changes
   - Restores system to clean state

5. **verify-cleanup**
   - Validates resources were released
   - Checks system state
   - Reports cleanup success

**Key Features:**
- ✅ Resource allocation tracking
- ✅ Cleanup on success or failure
- ✅ Rollback mechanisms
- ✅ State verification

---

## 12. Multi-Service Integration Pipeline
**Purpose:** Demonstrate integration of multiple external services

### Pipeline: `multi-service-integration-demo`

**Steps:**
1. **service-a-call** (HTTP API)
   - Calls external service A
   - Handles authentication
   - Retry on network failure

2. **service-b-call** (Database)
   - Queries database
   - Uses connection pooling
   - Timeout handling

3. **service-c-call** (Message Queue)
   - Publishes to queue
   - Waits for acknowledgment
   - Handles queue unavailability

4. **cross-service-validation**
   - Validates data consistency across services
   - Detects conflicts
   - Reports discrepancies

5. **reconciliation**
   - Resolves any conflicts found
   - Updates all services
   - Ensures eventual consistency

**Key Features:**
- ✅ Multiple service types
- ✅ Different failure modes
- ✅ Cross-service validation
- ✅ Consistency management

---

## Implementation Priority

### Phase 1: Core Capabilities (Week 1)
1. ✅ **Async & Timing Pipeline** - Demonstrates basic async handling
2. ✅ **Retry Logic Pipeline** - Shows retry mechanisms
3. ✅ **Parallel Execution Pipeline** - Demonstrates concurrency

### Phase 2: Advanced Patterns (Week 2)
4. **Complex Dependency DAG Pipeline** - Shows complex dependencies
5. **Error Recovery Pipeline** - Demonstrates resilience
6. **Data Transformation Pipeline** - Shows data flow

### Phase 3: Production Features (Week 3)
7. **Resource Management Pipeline** - Connection pooling
8. **Rate Limiting Pipeline** - API rate limits
9. **Cleanup and Rollback Pipeline** - Proper cleanup

### Phase 4: Polish & Documentation (Week 4)
10. **Conditional Branching Pipeline** - Dynamic paths
11. **Event-Driven Pipeline** - Event handling
12. **Multi-Service Integration Pipeline** - Real-world scenario

---

## Testing Strategy

### For Each Pipeline:

1. **Success Path Test**
   - All steps succeed
   - Verify expected results
   - Check timing/performance

2. **Failure Path Test**
   - Inject failures at each step
   - Verify error handling
   - Check cleanup/rollback

3. **Edge Case Tests**
   - Timeout scenarios
   - Resource exhaustion
   - Rate limit hits
   - Invalid input data

4. **Performance Tests**
   - Measure execution times
   - Verify parallel speedup
   - Check resource usage

### Test Scripts Naming Convention:
```
scripts/test-async-timing.mjs
scripts/test-retry-logic.mjs
scripts/test-parallel-execution.mjs
... etc
```

---

## Documentation Structure

Each pipeline will include:

1. **Source Code Documentation**
   - Inline comments explaining behavior
   - Type definitions for data structures
   - Configuration examples

2. **README per Pipeline**
   - Purpose and use cases
   - Step-by-step breakdown
   - Expected outcomes
   - How to run tests

3. **Video/GIF Demonstrations**
   - Visual timeline of execution
   - Progress indicators
   - Result visualization

4. **API Documentation**
   - Service interfaces
   - Data contracts
   - Error codes

---

## Metrics to Capture

For comprehensive demonstration:

1. **Execution Metrics**
   - Total pipeline duration
   - Per-step duration
   - Retry counts
   - Failure rates

2. **Resource Metrics**
   - Memory usage
   - Connection counts
   - Queue depths
   - API call counts

3. **Reliability Metrics**
   - Success rates
   - Error types distribution
   - Recovery time
   - Cleanup success rate

4. **Performance Metrics**
   - Parallel speedup
   - Resource utilization
   - Throughput
   - Latency percentiles

---

## Example Test Output Format

```
🧪 Testing Parallel Execution Pipeline

📊 Pipeline Configuration:
   - Prerequisite: 1s
   - Parallel Tasks: 3s, 4s, 2s
   - Aggregator: 1s
   - Expected Total: ~6s (not 11s)

🚀 Starting execution...

[0.0s] ✓ prerequisite-step started
[1.0s] ✓ prerequisite-step completed (1.0s)
[1.0s] ⚡ parallel-task-a started
[1.0s] ⚡ parallel-task-b started
[1.0s] ⚡ parallel-task-c started
[3.0s] ✓ parallel-task-c completed (2.0s)
[4.0s] ✓ parallel-task-a completed (3.0s)
[5.0s] ✓ parallel-task-b completed (4.0s)
[5.0s] ✓ aggregator-step started
[6.0s] ✓ aggregator-step completed (1.0s)

✅ Pipeline completed successfully!

📈 Performance Results:
   Total Duration: 6.1s
   Expected: ~6.0s
   Speedup: 1.8x (vs 11s sequential)
   Parallel Efficiency: 90%

✅ All tests PASSED!
```

---

## Next Steps

1. **Prioritize Phase 1 Pipelines**
   - Start with Async & Timing
   - Then Retry Logic
   - Then Parallel Execution

2. **Create Reusable Test Utilities**
   - Mock service generators
   - Timing helpers
   - Assertion utilities

3. **Build Visualization Tools**
   - Execution timeline viewer
   - Dependency graph renderer
   - Metrics dashboard

4. **Document Best Practices**
   - When to use which pattern
   - Common pitfalls
   - Performance optimization tips
