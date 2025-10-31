# Orbit Pipeline

A production-ready pipeline execution framework with automatic retry, state persistence, background workers, and real-time monitoring.

## Features

- **Background Workers** - Automatic execution with PM2 process management and horizontal scaling
- **Resilient Execution** - Retry logic with exponential backoff and automatic crash recovery
- **State Persistence** - PostgreSQL with Prisma ORM for reliable state management
- **Performance Monitoring** - Built-in metrics collection with real-time tRPC API
- **Web Dashboard** - Next.js interface for monitoring and management
- **TypeScript** - Full type safety across the entire stack

## Quick Start

**Prerequisites**: Node.js 18+, PostgreSQL

```bash
# Setup
npm install
cp .env.example .env  # Add your DATABASE_URL
npm run prisma:migrate && npm run prisma:generate && npm run build

# Development (2 terminals)
npm run worker     # Background worker
npm run dev:ui     # Dashboard at http://localhost:3000

# Production
npm run pm2:start  # Start with PM2
pm2 logs orbit-worker
```

See [docs/WORKER-DEPLOYMENT.md](./docs/WORKER-DEPLOYMENT.md) for full deployment guide.

## Architecture

```
src/
├── core/                  # Core execution engine
│   ├── executor.ts        # Pipeline execution
│   ├── recovery.ts        # Crash recovery
│   ├── metrics.ts         # Performance monitoring
│   └── logger.ts          # Structured logging
├── pipelines/             # Pipeline definitions
├── services/              # External integrations (S3, Veryfi, etc.)
├── server/                # tRPC API server
│   └── routers/           # API endpoints
└── worker.ts              # Background worker process

app/                       # Next.js dashboard
prisma/                    # Database schema
tests/                     # Test suite
```

## API

```typescript
// tRPC endpoints
pipeline.list() | get() | create() | update() | delete()
run.list() | get() | getByPipeline() | retry()
step.list() | get() | getByRun() | getLogs()
worker.stats() | health() | metrics() | recentRuns()
```

## Example Pipeline

```typescript
// Production-ready document processing: S3 → Veryfi API → PostgreSQL
export default pipeline('document-processing')
  .step('s3-upload', s3Upload, { maxRetries: 3, timeout: 60000 })
  .step('veryfi-process', veryfiProcess, { maxRetries: 2, timeout: 180000 })
  .step('veryfi-storage', veryfiStorage, { maxRetries: 2, timeout: 30000 });
```

See `src/pipelines/` for 8 demo pipelines including async/timing, retry logic, parallel execution, error recovery, and connection pooling.

## Tech Stack

**Backend**: Node.js, TypeScript, PostgreSQL, Prisma, tRPC
**Frontend**: Next.js 14, React 18, TanStack Query, Tailwind CSS
**Infrastructure**: PM2, Winston

## Documentation

- [Worker Deployment](./docs/WORKER-DEPLOYMENT.md) - Production setup and PM2 commands
- [Demo Pipelines](./docs/DEMO-SUITE.md) - 8 example pipelines with patterns
- [Performance Monitoring](./docs/METRICS.md) - Metrics API and worker health

## License

ISC
