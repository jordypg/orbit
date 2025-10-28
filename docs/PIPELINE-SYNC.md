# Pipeline Sync Architecture

## The Problem

The UI was quickly built and has a **disconnected architecture**:

1. **Pipeline Definitions** - TypeScript files in `src/pipelines/`
2. **Pipeline Registry** - In-memory registry (loads on worker startup)
3. **Database** - Stores pipeline metadata for UI display
4. **No Automatic Sync** - Changes to code don't automatically appear in UI

## Why This Matters

When you create a new pipeline:
- ✅ The code exists and can be executed by the worker
- ❌ The UI won't show it (no database record)
- ❌ You can't trigger it from the UI

## The Solution

After creating or modifying pipelines, run:

```bash
npm run sync:pipelines
```

This script:
1. Discovers all pipeline files in `src/pipelines/`
2. Loads each pipeline definition
3. Creates/updates database records
4. Makes pipelines visible in the UI

## Workflow

### Creating a New Pipeline

1. **Write the pipeline code**
   ```typescript
   // src/pipelines/my-new-pipeline.ts
   import { definePipeline, step } from '../core/index.js';

   export default definePipeline({
     name: 'my-new-pipeline',
     description: 'My awesome pipeline',
     steps: [...]
   });
   ```

2. **Sync to database**
   ```bash
   npm run sync:pipelines
   ```

3. **Refresh the UI** - Your pipeline now appears!

### Updating an Existing Pipeline

If you change a pipeline's **description** or **schedule**:

```bash
npm run sync:pipelines  # Updates database records
```

If you change a pipeline's **steps** (code logic):
- No sync needed! The worker loads code directly
- Changes take effect when worker restarts or picks up new runs

## Architecture Diagram

```
┌─────────────────────┐
│  src/pipelines/*.ts │  ← Pipeline Code (source of truth)
└──────────┬──────────┘
           │
           ├──────────────────────────────────┐
           │                                  │
           ↓                                  ↓
    ┌──────────────┐                 ┌───────────────┐
    │   Registry   │                 │   Database    │
    │  (in-memory) │                 │  (metadata)   │
    └──────┬───────┘                 └───────┬───────┘
           │                                  │
           │ Used by:                         │ Used by:
           ↓                                  ↓
    ┌──────────────┐                 ┌───────────────┐
    │    Worker    │                 │      UI       │
    │ (execution)  │                 │   (display)   │
    └──────────────┘                 └───────────────┘

    Sync Script (npm run sync:pipelines)
    ════════════════════════════════════════
    Reads: src/pipelines/*.ts
    Writes: Database records
```

## What Gets Synced

The sync script syncs **metadata only**:

- ✅ Pipeline name
- ✅ Pipeline description
- ✅ Pipeline schedule (cron expression)
- ❌ Pipeline steps (not stored in DB)
- ❌ Step handlers (not stored in DB)

**Why?** The worker loads pipeline code directly from TypeScript files for execution. The database only stores metadata for the UI.

## Manual Database Operations

If you need to manually add a pipeline to the database:

```typescript
import prisma from './src/core/prisma.js';

await prisma.pipeline.create({
  data: {
    name: 'my-pipeline',
    description: 'My pipeline description',
    schedule: '0 0 * * *', // Optional cron schedule
  },
});
```

Or delete:

```typescript
await prisma.pipeline.delete({
  where: { name: 'my-pipeline' },
});
```

## Troubleshooting

### Pipeline doesn't appear in UI after sync

1. **Check the sync output** - Did it succeed?
   ```bash
   npm run sync:pipelines
   ```

2. **Verify pipeline name** - Must match exactly
   ```bash
   # Check database
   npx prisma studio
   ```

3. **Hard refresh browser** - Clear cache (Cmd+Shift+R)

### Sync script fails

Common issues:

- **"Invalid pipeline definition"** - Pipeline file doesn't export valid definition
- **Database connection error** - Check `DATABASE_URL` in `.env`
- **Module not found** - Run `npm run build` first

### Pipeline executes but not visible

This means:
- ✅ Code is valid (worker can execute it)
- ❌ Not synced to database (UI can't see it)

Solution: `npm run sync:pipelines`

## Future Improvements

This architecture could be improved by:

1. **Auto-sync on startup** - Worker syncs pipelines to DB on boot
2. **File watcher** - Auto-sync when pipeline files change
3. **Single source of truth** - Store everything in code, generate DB from code
4. **API-based creation** - Create pipelines through UI, persist to code

For now, manual sync is the workflow.

## Quick Reference

```bash
# Create new pipeline
# 1. Write code in src/pipelines/my-pipeline.ts

# 2. Sync to database
npm run sync:pipelines

# 3. Refresh UI browser

# Update pipeline description/schedule
# 1. Edit src/pipelines/my-pipeline.ts
# 2. npm run sync:pipelines
# 3. Refresh UI

# Update pipeline steps (code only)
# 1. Edit src/pipelines/my-pipeline.ts
# 2. Restart worker (changes take effect)
# 3. No DB sync needed!
```

## Related Files

- `scripts/sync-pipelines.ts` - Sync script implementation
- `src/core/registry.ts` - In-memory pipeline registry
- `src/server/routers/pipeline.router.ts` - UI pipeline API
- `src/worker.ts` - Worker that loads and executes pipelines
