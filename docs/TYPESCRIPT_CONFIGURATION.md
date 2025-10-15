# TypeScript Configuration Guide

This project uses a dual TypeScript configuration to support both Node.js CLI and Next.js web applications.

## Configuration Files

### tsconfig.json (CLI)
Used for the Node.js CLI application with ES modules:
- **Module**: `NodeNext` - Full ESM support with `.js` extensions required
- **Target**: `ES2022`
- **Includes**: `src/**/*` (CLI and core code)
- **Excludes**: `app/**/*` (Next.js code)

### tsconfig.next.json (Web UI)
Used for Next.js with webpack bundling:
- **Module**: `ESNext`
- **ModuleResolution**: `bundler` - Webpack-style resolution
- **Target**: `ES2022`
- **Includes**: `app/**/*`, `src/server/**/*`
- **Excludes**: `src/core`, `src/cli.ts`, `src/pipelines`

## Import Strategy

### Server Files (src/server/)
These files are shared between CLI and Web UI, so they use `.js` extensions:

```typescript
// Correct - works for both Node.js and Next.js
import { createTRPCRouter } from '../trpc.js';
import { pipelineRouter } from './pipeline.router.js';
```

### Next.js App Files (app/)
These files use webpack bundling, so NO `.js` extensions:

```typescript
// Correct - webpack will resolve
import { appRouter } from '../../../../src/server/routers/_app';
import { createTRPCContext } from '../../../../src/server/trpc';
```

## Webpack Configuration

The `next.config.js` includes a webpack configuration to resolve `.js` extensions to `.ts` files:

```javascript
webpack: (config) => {
  config.resolve.extensionAlias = {
    '.js': ['.js', '.ts'],
    '.jsx': ['.jsx', '.tsx'],
  };
  return config;
},
```

This allows Node.js-style imports (with `.js`) to work in Next.js.

## Build Commands

```bash
# CLI build - uses tsconfig.json
npm run build

# Web UI build - uses tsconfig.next.json
npm run build:ui
```

## Why This Approach?

1. **Node.js ESM Requirement**: Node.js with `"type": "module"` requires explicit `.js` extensions in imports
2. **Webpack Compatibility**: Next.js/webpack prefers no extensions (or uses extensionAlias)
3. **Code Sharing**: Server routers are used by both CLI (for direct Prisma access) and Web UI (for tRPC API)

## Troubleshooting

### Error: "Cannot find module '../trpc.js'"
- In `src/server/` files: Keep `.js` extensions
- In `app/` files: Remove `.js` extensions

### Error: "Relative import paths need explicit file extensions"
- This happens when Node.js code (tsconfig.json with NodeNext) doesn't have `.js` extensions
- Solution: Add `.js` to imports in `src/server/` files

### Next.js build fails with "Module not found"
- Check that `next.config.js` has the `extensionAlias` webpack configuration
- Verify `tsconfig.next.json` uses `moduleResolution: "bundler"`
