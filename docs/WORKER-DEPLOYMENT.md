# Worker Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Local Development](#local-development)
4. [Production Deployment](#production-deployment)
5. [PM2 Process Management](#pm2-process-management)
6. [Configuration](#configuration)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)
9. [Scaling](#scaling)

---

## Overview

The Orbit Worker is a background process that continuously polls the database for pending pipeline runs and executes them automatically. It operates independently from the Next.js web server, enabling distributed and resilient pipeline execution.

**Key Features:**
- Automatic execution of UI-triggered runs
- Graceful shutdown and restart
- PM2 process management
- Metrics collection and monitoring
- Horizontal scaling support
- Zero-downtime deployments

---

## Prerequisites

### System Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **PostgreSQL**: 13.0 or higher
- **PM2** (for production): Install globally with `npm install -g pm2`

### Database Setup

Ensure your PostgreSQL database is configured and accessible:

```bash
# Verify database connection
npm run prisma:generate
npx prisma db push
```

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Database Connection
DATABASE_URL="postgresql://user:password@host:6543/database?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/database"

# Worker Configuration
POLL_INTERVAL=5000          # How often to check for pending runs (ms)
METRICS_INTERVAL=60000      # How often to log metrics (ms)
MAX_EXECUTION_TIMEOUT=600000  # Maximum run execution time (ms)

# Logging
LOG_LEVEL=info              # winston log level: error, warn, info, debug
LOGS_DIR=./logs             # Directory for log files
```

---

## Local Development

### Quick Start

The simplest way to run the worker locally:

```bash
# Terminal 1: Start the worker
npm run worker

# Terminal 2: Start the web UI
npm run dev:ui
```

### Development Workflow

**1. Make Code Changes**

Edit pipeline definitions or worker code:
```bash
# Edit a pipeline
vim src/pipelines/example-pipeline.ts

# Edit worker logic
vim src/worker.ts
```

**2. Test Locally**

```bash
# Run worker in watch mode (auto-restarts on changes)
npm run worker:dev

# Trigger a run via UI or API
# Worker will pick it up automatically
```

**3. View Logs**

```bash
# Worker logs appear in console
# Or check log files
tail -f logs/worker.log
tail -f logs/worker-error.log
```

### Running Multiple Workers Locally

Test multi-worker scenarios:

```bash
# Terminal 1
POLL_INTERVAL=5000 npm run worker

# Terminal 2
POLL_INTERVAL=5000 npm run worker

# Terminal 3
POLL_INTERVAL=5000 npm run worker
```

All workers will compete for runs using atomic database transactions.

---

## Production Deployment

### Step 1: Build the Application

```bash
# Install dependencies
npm ci --production=false

# Build both worker and UI
npm run build        # Compiles TypeScript
npm run build:ui     # Builds Next.js app

# Verify build
ls dist/worker.js    # Worker entry point
ls .next/           # Next.js build output
```

### Step 2: Configure Environment

```bash
# Copy production environment template
cp .env.example .env.production

# Edit with production values
vim .env.production
```

**Production Environment Variables:**

```bash
NODE_ENV=production
DATABASE_URL="postgresql://prod_user:password@prod-host:6543/prod_db?pgbouncer=true"
DIRECT_URL="postgresql://prod_user:password@prod-host:5432/prod_db"
POLL_INTERVAL=3000
METRICS_INTERVAL=60000
LOG_LEVEL=info
LOGS_DIR=/var/log/orbit
```

### Step 3: Install PM2

```bash
# Install PM2 globally
npm install -g pm2

# Verify installation
pm2 --version
```

### Step 4: Start Services

```bash
# Start all processes (worker + UI)
npm run pm2:start

# Or start individually
pm2 start ecosystem.config.cjs --only orbit-worker
pm2 start ecosystem.config.cjs --only orbit-server
```

### Step 5: Configure Auto-Start

```bash
# Generate startup script
pm2 startup

# Follow the instructions (may need sudo)
# Then save current process list
pm2 save
```

### Step 6: Verify Deployment

```bash
# Check process status
pm2 list

# Check logs
pm2 logs orbit-worker --lines 50

# Monitor in real-time
pm2 monit
```

---

## PM2 Process Management

### Essential Commands

#### Process Control

```bash
# Start all processes
pm2 start ecosystem.config.cjs

# Stop all processes
pm2 stop all

# Restart all processes
pm2 restart all

# Delete from PM2
pm2 delete all

# Reload with zero-downtime
pm2 reload all
```

#### Individual Process Control

```bash
# Start only worker
pm2 start ecosystem.config.cjs --only orbit-worker

# Stop worker
pm2 stop orbit-worker

# Restart worker
pm2 restart orbit-worker

# Delete worker
pm2 delete orbit-worker
```

#### Monitoring

```bash
# List all processes
pm2 list

# Show detailed info
pm2 describe orbit-worker

# View logs (all)
pm2 logs

# View logs (specific process)
pm2 logs orbit-worker

# View last 100 lines
pm2 logs orbit-worker --lines 100

# Follow logs in real-time
pm2 logs orbit-worker --lines 0

# Real-time monitoring dashboard
pm2 monit
```

#### Scaling

```bash
# Scale worker to 3 instances
pm2 scale orbit-worker 3

# Scale down to 1 instance
pm2 scale orbit-worker 1
```

### Custom PM2 Scripts

The project includes npm scripts for PM2 management:

```bash
npm run pm2:start     # Start all processes
npm run pm2:stop      # Stop all processes
npm run pm2:restart   # Restart all processes
npm run pm2:delete    # Delete all processes
npm run pm2:reload    # Zero-downtime reload
npm run pm2:status    # Show status
npm run pm2:logs      # View logs
npm run pm2:monitor   # Open monitoring dashboard
npm run pm2:save      # Save process list
```

---

## Configuration

### Worker Configuration File

The worker is configured via `ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [
    {
      name: 'orbit-worker',
      script: './dist/worker.js',
      instances: 1,            // Number of worker instances
      exec_mode: 'fork',       // or 'cluster' for multiple
      autorestart: true,       // Auto-restart on crash
      watch: false,            // Don't watch files in production
      max_memory_restart: '500M',  // Restart if memory exceeds
      env: {
        NODE_ENV: 'production',
        POLL_INTERVAL: '3000',
        METRICS_INTERVAL: '60000',
      },
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'orbit-server',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
};
```

### Environment Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | *required* | PostgreSQL connection string (pooled) |
| `DIRECT_URL` | *required* | PostgreSQL direct connection |
| `POLL_INTERVAL` | `5000` | Milliseconds between polls |
| `METRICS_INTERVAL` | `60000` | Metrics reporting interval |
| `MAX_EXECUTION_TIMEOUT` | `600000` | Maximum run duration (10 min) |
| `LOG_LEVEL` | `info` | Winston log level |
| `LOGS_DIR` | `./logs` | Log file directory |
| `NODE_ENV` | `development` | Environment mode |

### Log Configuration

Logs are written to:
- **Console**: Colored output in development
- **File**: `logs/worker.log` - All log levels
- **Error File**: `logs/worker-error.log` - Errors only

PM2 adds additional logging:
- **Output**: `logs/worker-out.log` - stdout
- **Error**: `logs/worker-error.log` - stderr

Configure log rotation in `ecosystem.config.cjs`:
```javascript
{
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  merge_logs: true,
  max_size: '10M',
  max_files: 10,
}
```

---

## Monitoring

### Built-in Metrics

The worker collects and reports metrics every 60 seconds:

```
Worker Metrics Report {
  "uptime": "2h 15m 32s",
  "totalRuns": 342,
  "succeeded": 335,
  "failed": 7,
  "errorRate": "2.05%",
  "successRate": "97.95%",
  "runsPerHour": "151.11",
  "avgDuration": "1423ms",
  "minDuration": "234ms",
  "maxDuration": "8765ms"
}
```

### Metrics API

Query metrics programmatically:

```typescript
// Via tRPC
const metrics = await trpc.worker.metrics.query();

// Returns:
{
  uptime: "2h 15m 32s",
  uptimeSeconds: 8132,
  totalRuns: 342,
  successRate: 97.95,
  errorRate: 2.05,
  runsPerHour: 151.11,
  avgExecutionTime: 1423,
  minExecutionTime: 234,
  maxExecutionTime: 8765,
  succeeded: 335,
  failed: 7,
  workerStartTime: Date,
  lastRunTime: Date,
  timestamp: Date
}
```

### Health Checks

Check worker health:

```typescript
const health = await trpc.worker.health.query();

// Returns:
{
  status: 'healthy' | 'warning' | 'error',
  message: string,
  lastActivity: Date | null,
  stuckRuns: number
}
```

### PM2 Monitoring

```bash
# Real-time dashboard
pm2 monit

# Web-based monitoring (optional)
pm2 install pm2-server-monit

# Keymetrics integration (optional)
pm2 link <secret> <public>
```

### Log Analysis

```bash
# View recent errors
pm2 logs orbit-worker --err --lines 50

# Search logs
pm2 logs orbit-worker --lines 1000 | grep "ERROR"

# Export logs
pm2 logs orbit-worker --lines 10000 --raw > worker-logs.txt
```

---

## Troubleshooting

### Worker Not Starting

**Symptoms:**
- `pm2 list` shows worker as "errored" or "stopped"
- Worker exits immediately after starting

**Solutions:**

1. **Check Environment Variables**
   ```bash
   # Verify DATABASE_URL is set
   pm2 describe orbit-worker | grep -A 5 "env:"

   # Test database connection
   npm run prisma:generate
   npx prisma db push
   ```

2. **Check Pipelines Directory**
   ```bash
   # Worker needs at least one pipeline
   ls src/pipelines/

   # Rebuild if needed
   npm run build
   ```

3. **Check Logs**
   ```bash
   # View error logs
   pm2 logs orbit-worker --err --lines 50

   # Check file logs
   cat logs/worker-error.log
   ```

### Worker Crashes Frequently

**Symptoms:**
- High restart count in `pm2 list`
- `restart_time` incrementing rapidly

**Solutions:**

1. **Check Memory Usage**
   ```bash
   # View memory consumption
   pm2 describe orbit-worker | grep "memory"

   # Increase memory limit in ecosystem.config.cjs
   max_memory_restart: '1G'
   ```

2. **Check for Uncaught Exceptions**
   ```bash
   # Look for error patterns
   pm2 logs orbit-worker --err | tail -100
   ```

3. **Enable Debug Logging**
   ```bash
   # Update ecosystem.config.cjs
   env: {
     LOG_LEVEL: 'debug'
   }

   pm2 restart orbit-worker
   ```

### No Runs Being Processed

**Symptoms:**
- Runs stuck in "pending" status
- Worker running but idle

**Solutions:**

1. **Verify Worker is Polling**
   ```bash
   # Check logs for polling messages
   pm2 logs orbit-worker --lines 50

   # Should see: "Worker polling..." periodically
   ```

2. **Check Database Connection**
   ```bash
   # Test connection
   npm run prisma:generate
   npx prisma db push

   # Check for connection errors in logs
   pm2 logs orbit-worker --err
   ```

3. **Verify Pipeline Registration**
   ```bash
   # Look for "Loaded pipeline:" messages on startup
   pm2 logs orbit-worker --lines 100

   # Should see: "Loaded pipeline: <name>"
   ```

### Runs Stuck in "Running" Status

**Symptoms:**
- Runs marked as "running" but not completing
- Worker shows as healthy

**Solutions:**

1. **Check for Crashed Worker**
   ```bash
   # Use recovery system
   orbit check-interrupted
   orbit recover --auto-resume
   ```

2. **Check MAX_EXECUTION_TIMEOUT**
   ```bash
   # Verify timeout in ecosystem.config.cjs
   env: {
     MAX_EXECUTION_TIMEOUT: '600000'  # 10 minutes
   }
   ```

3. **Manual Recovery**
   ```bash
   # Resume specific run
   orbit resume <run-id>
   ```

### High Database Connection Usage

**Symptoms:**
- "Too many connections" errors
- Worker can't acquire connections

**Solutions:**

1. **Use Connection Pooling**
   ```bash
   # Ensure DATABASE_URL uses pgbouncer
   DATABASE_URL="...?pgbouncer=true"
   ```

2. **Reduce Poll Frequency**
   ```bash
   # Increase POLL_INTERVAL
   POLL_INTERVAL=10000  # 10 seconds instead of 5
   ```

3. **Limit Worker Instances**
   ```bash
   # Scale down if needed
   pm2 scale orbit-worker 1
   ```

### Metrics Not Updating

**Symptoms:**
- tRPC metrics endpoint returns zeros
- No metrics in logs

**Solutions:**

1. **Verify Worker is Running**
   ```bash
   pm2 list | grep orbit-worker
   ```

2. **Check Metrics Interval**
   ```bash
   # Verify METRICS_INTERVAL in ecosystem.config.cjs
   env: {
     METRICS_INTERVAL: '60000'
   }
   ```

3. **Restart Worker**
   ```bash
   pm2 restart orbit-worker
   ```

---

## Scaling

### Horizontal Scaling

Run multiple worker instances for increased throughput:

```bash
# Scale to 3 instances
pm2 scale orbit-worker 3

# Each instance polls independently
# Atomic database transactions prevent conflicts
```

**Considerations:**
- Each worker consumes a database connection
- Total throughput = N × (1000ms / POLL_INTERVAL)
- Monitor database connection pool usage

### Vertical Scaling

Increase resources per worker:

```bash
# Update ecosystem.config.cjs
{
  max_memory_restart: '2G',  // More memory
  node_args: '--max-old-space-size=4096'  // Larger heap
}

pm2 restart orbit-worker
```

### Load Balancing

For distributed deployments:

1. **Multiple Servers**
   ```bash
   # Server 1
   pm2 start ecosystem.config.cjs --only orbit-worker

   # Server 2
   pm2 start ecosystem.config.cjs --only orbit-worker

   # Both workers poll the same database
   # Automatic load distribution via atomic claiming
   ```

2. **Pipeline-Specific Workers**
   ```javascript
   // Create specialized workers for different pipelines
   {
     name: 'orbit-worker-analytics',
     script: './dist/worker.js',
     env: {
       PIPELINE_FILTER: 'analytics-*'  // Custom logic needed
     }
   }
   ```

### Performance Tuning

Optimize for your workload:

```bash
# High-throughput (many short runs)
POLL_INTERVAL=1000      # Poll every second
METRICS_INTERVAL=300000  # Report every 5 minutes

# Low-throughput (few long runs)
POLL_INTERVAL=10000     # Poll every 10 seconds
METRICS_INTERVAL=60000   # Report every minute

# Balanced (production default)
POLL_INTERVAL=3000      # Poll every 3 seconds
METRICS_INTERVAL=60000   # Report every minute
```

---

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm run build:ui

FROM node:18-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

RUN npm install -g pm2

EXPOSE 3000

CMD ["pm2-runtime", "ecosystem.config.cjs"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: orbit
      POSTGRES_USER: orbit
      POSTGRES_PASSWORD: password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  orbit:
    build: .
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://orbit:password@postgres:5432/orbit
      DIRECT_URL: postgresql://orbit:password@postgres:5432/orbit
      NODE_ENV: production
    ports:
      - "3000:3000"
    volumes:
      - ./logs:/app/logs

volumes:
  postgres-data:
```

---

## Additional Resources

- **Metrics Documentation**: [docs/METRICS.md](./METRICS.md)
- **Recovery System**: [docs/RECOVERY.md](./RECOVERY.md)
- **Worker PRD**: [docs/worker-prd.txt](./worker-prd.txt)
- **PM2 Documentation**: https://pm2.keymetrics.io/docs/usage/quick-start/
- **Prisma Documentation**: https://www.prisma.io/docs/

---

## Quick Reference

### Essential Commands Cheat Sheet

```bash
# Development
npm run worker           # Run worker locally
npm run worker:dev       # Run with auto-restart

# Production
npm run pm2:start        # Start all processes
npm run pm2:stop         # Stop all processes
npm run pm2:restart      # Restart all processes
npm run pm2:logs         # View logs

# Monitoring
pm2 list                 # Show process status
pm2 monit                # Real-time dashboard
pm2 logs orbit-worker    # View worker logs

# Troubleshooting
orbit check-interrupted  # Find stuck runs
orbit recover --auto-resume  # Recover all
pm2 logs orbit-worker --err  # View errors

# Scaling
pm2 scale orbit-worker 3 # Scale to 3 instances
pm2 scale orbit-worker 1 # Scale down to 1
```

---

**Last Updated**: 2025-10-13
**Version**: 1.0
