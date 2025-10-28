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

## Services

The pipeline includes specialized services for document processing:

### S3 Upload Service

Upload files to AWS S3 with automatic retry and error handling.

**Location**: `src/services/s3-upload.ts`

**Configuration** (Environment Variables):
```env
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

**Usage in Pipeline**:
```typescript
import { step } from './core/index.js';
import { s3Upload } from './services/s3-upload.js';

step('upload-to-s3', s3Upload, {
  maxRetries: 3,
  timeout: 60000, // 60 seconds
});
```

**Returns**:
```typescript
{
  success: true,
  data: {
    bucket: string,    // S3 bucket name
    key: string,       // S3 object key (path)
    url: string,       // Full S3 URL
    contentType: string, // MIME type
    size: number       // File size in bytes
  }
}
```

### Veryfi Processing Service

Process documents through Veryfi API for data extraction.

**Location**: `src/services/veryfi-processor.ts`

**Configuration** (Environment Variables):
```env
VERYFI_CLIENT_ID=your-client-id
VERYFI_CLIENT_SECRET=your-client-secret (optional)
VERYFI_USERNAME=your-username
VERYFI_API_KEY=your-api-key
VERYFI_API_BASE_URL=https://api.veryfi.com/api/v8/partner (optional)
VERYFI_TIMEOUT=120000 (optional, defaults to 120 seconds)
```

**Usage in Pipeline**:
```typescript
import { step } from './core/index.js';
import { veryfiProcess } from './services/veryfi-processor.js';

step('process-document', async (ctx) => {
  // Expects S3 upload data from previous step
  const veryfiContext = {
    ...ctx,
    prevResults: {
      s3Upload: ctx.prevResults['s3-upload'].data
    }
  };
  return await veryfiProcess(veryfiContext);
}, {
  maxRetries: 2,
  timeout: 180000, // 3 minutes
});
```

**Returns**:
```typescript
{
  success: true,
  data: {
    veryfiId: number,           // Veryfi document ID
    response: VeryfiResponse,   // Complete Veryfi API response
    s3Bucket: string,          // Source S3 bucket
    s3Key: string,             // Source S3 key
    s3Url: string              // Source S3 URL
  }
}
```

### Veryfi Storage Service

Store Veryfi processing results in the database.

**Location**: `src/services/veryfi-storage.ts`

**Database Table**: `VeryfiDocument`

**Usage in Pipeline**:
```typescript
import { step } from './core/index.js';
import { veryfiStorage } from './services/veryfi-storage.js';

step('store-results', async (ctx) => {
  const storageContext = {
    ...ctx,
    prevResults: {
      veryfiProcess: ctx.prevResults['veryfi-process'].data
    }
  };
  return await veryfiStorage(storageContext);
}, {
  maxRetries: 2,
  timeout: 30000, // 30 seconds
});
```

**Returns**:
```typescript
{
  success: true,
  data: {
    documentId: string,  // Database record ID (cuid)
    veryfiId: string,    // Veryfi document ID
    status: string       // Processing status
  }
}
```

### Document Processing Pipeline

Complete end-to-end pipeline combining all three services.

**Location**: `src/pipelines/document-processing.ts`

**Pipeline Name**: `document-processing`

**Workflow**:
1. **S3 Upload**: Upload document to S3 bucket
2. **Veryfi Processing**: Send document to Veryfi API for extraction
3. **Database Storage**: Store results in VeryfiDocument table
4. **Pipeline Summary**: Generate execution summary

**Running the Pipeline**:
```typescript
import { PipelineExecutor } from './core/executor.js';
import documentProcessingPipeline from './pipelines/document-processing.js';

const executor = new PipelineExecutor(documentProcessingPipeline);

const result = await executor.execute({
  metadata: {
    filePath: '/path/to/document.pdf',
    userId: 'user-123'
  }
});

console.log('Success:', result.success);
console.log('Run ID:', result.runId);
console.log('Duration:', result.duration, 'ms');
```

**Test Script**:
```bash
# Run the complete document processing pipeline
node scripts/test-document-processing.mjs
```

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
