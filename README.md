# Orbit Pipeline

A resilient job execution pipeline with retry logic, state persistence, background workers, and a web dashboard.

## Features

- **Background Worker**: Automatic execution of pending runs
  - Continuous polling of pending pipeline runs
  - PM2 process management with auto-restart
  - Horizontal scaling support
  - Real-time metrics collection
  - Graceful shutdown and recovery
- **Resilient Execution**: Automatic retry with exponential backoff
- **State Persistence**: PostgreSQL-backed state management with Prisma
- **Run Recovery**: Automatic detection and resumption of interrupted runs
  - Smart crash detection
  - Context reconstruction from database
  - Idempotent step design support
  - CLI and programmatic recovery
- **Performance Monitoring**: Built-in metrics collection
  - Execution statistics (success rate, throughput, duration)
  - Worker health monitoring
  - Real-time metrics via tRPC API
- **Web Dashboard**: Next.js/tRPC web interface for monitoring
- **CLI Interface**: Command-line tool for pipeline execution
- **TypeScript**: Full type safety across the stack

## Project Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Installation

```bash
# Install dependencies
npm install

# Set up database
cp .env.example .env
# Edit .env with your DATABASE_URL

# Run Prisma migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate
```

### Development

```bash
# Run background worker (recommended for development)
npm run worker          # Run worker in development mode
npm run worker:dev      # Run worker with auto-restart on changes

# Run web UI in development mode
npm run dev:ui

# Run CLI in development mode
npm run dev

# Build for production
npm run build        # Build both worker and CLI
npm run build:ui     # Build web UI

# Run built versions
npm run worker       # Run worker
npm start            # Run CLI
npm run start:ui     # Run web UI
```

### Worker Usage

The background worker automatically executes runs created via the web UI:

```bash
# Development: Run worker locally
npm run worker

# Production: Use PM2 process manager
npm run pm2:start       # Start worker + web server
npm run pm2:stop        # Stop all processes
npm run pm2:restart     # Restart all processes
npm run pm2:logs        # View logs
pm2 monit               # Real-time monitoring dashboard

# Scaling: Run multiple workers
pm2 scale orbit-worker 3    # Scale to 3 worker instances
```

For complete worker setup and deployment guide, see [docs/WORKER-DEPLOYMENT.md](./docs/WORKER-DEPLOYMENT.md).

### CLI Usage

```bash
# List available pipelines
orbit list

# Run a pipeline directly (bypasses worker)
orbit run <pipeline-name>

# Check for interrupted runs
orbit check-interrupted

# Resume a specific run
orbit resume <run-id>

# Auto-recover all interrupted runs
orbit recover --auto-resume

# Run with auto-recovery on startup
orbit --auto-recover run <pipeline-name>
```

For detailed recovery documentation, see [docs/RECOVERY.md](./docs/RECOVERY.md).

## Project Structure

```
.
├── app/                    # Next.js App Router pages
│   ├── api/trpc/          # tRPC API routes
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── providers.tsx      # tRPC & React Query providers
├── docs/                   # Documentation
│   ├── RECOVERY.md        # Run recovery system
│   ├── METRICS.md         # Metrics collection system
│   ├── WORKER-DEPLOYMENT.md  # Worker deployment guide
│   └── worker-prd.txt     # Worker PRD
├── prisma/
│   └── schema.prisma      # Database schema
├── src/
│   ├── core/              # Core pipeline logic
│   │   ├── executor.ts    # Pipeline execution engine
│   │   ├── recovery.ts    # Run recovery system
│   │   ├── run-claimer.ts # Atomic run acquisition
│   │   ├── metrics.ts     # Metrics collection
│   │   └── logger.ts      # Winston logging
│   ├── pipelines/         # Pipeline definitions
│   ├── server/            # tRPC server & routers
│   │   ├── routers/       # API route handlers
│   │   │   ├── _app.ts    # Main router
│   │   │   ├── pipeline.router.ts
│   │   │   ├── run.router.ts
│   │   │   ├── step.router.ts
│   │   │   └── worker.router.ts  # Worker metrics API
│   │   ├── trpc.ts        # tRPC configuration
│   │   └── types/         # Shared types
│   ├── worker.ts          # Background worker process
│   └── cli.ts             # CLI entry point
├── tests/                 # Test files
│   ├── worker.test.ts     # Worker tests
│   ├── recovery.test.ts   # Recovery tests
│   ├── metrics.test.ts    # Metrics tests
│   └── worker-integration.test.ts  # Integration tests
└── ecosystem.config.cjs   # PM2 configuration
```

## API Routes

The tRPC API provides the following routes:

### Pipeline Routes
- `pipeline.list()` - Get all pipelines
- `pipeline.get({ id })` - Get a single pipeline
- `pipeline.create({ name, description, schedule })` - Create a pipeline
- `pipeline.update({ id, ...data })` - Update a pipeline
- `pipeline.delete({ id })` - Delete a pipeline

### Run Routes
- `run.list({ status?, limit? })` - List all runs
- `run.getByPipeline({ pipelineId, limit?, cursor? })` - Get runs for a pipeline
- `run.get({ id })` - Get a single run with steps
- `run.retry({ id })` - Retry a failed run

### Step Routes
- `step.list({ status?, limit? })` - List steps
- `step.get({ id })` - Get a single step
- `step.getByRun({ runId })` - Get steps for a run
- `step.getLogs({ id })` - Get step logs with parsed output

### Worker Routes
- `worker.stats()` - Get worker dashboard statistics
- `worker.recentRuns({ limit?, status? })` - Get recent runs with details
- `worker.health()` - Get worker health status
- `worker.metrics()` - Get real-time performance metrics

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **API**: tRPC v10
- **Frontend**: Next.js 14 (App Router), React 18
- **State Management**: TanStack Query (React Query)
- **Styling**: Tailwind CSS v3
- **CLI**: Commander.js
- **Process Management**: PM2
- **Logging**: Winston
- **Testing**: Jest

## Documentation

- **[Worker Deployment Guide](./docs/WORKER-DEPLOYMENT.md)** - Complete guide to deploying and managing the background worker
- **[Metrics Documentation](./docs/METRICS.md)** - Performance monitoring and metrics collection
- **[Recovery System](./docs/RECOVERY.md)** - Run recovery and crash handling
- **[Worker PRD](./docs/worker-prd.txt)** - Product requirements document for the worker

## Quick Start

### Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up database
cp .env.example .env
npm run prisma:migrate
npm run prisma:generate

# 3. Build the application
npm run build

# 4. Start worker and UI
npm run worker    # Terminal 1
npm run dev:ui    # Terminal 2
```

### Production Setup

```bash
# 1. Build for production
npm ci --production=false
npm run build
npm run build:ui

# 2. Start with PM2
npm run pm2:start

# 3. Configure auto-start
pm2 startup
pm2 save
```

## License

ISC
