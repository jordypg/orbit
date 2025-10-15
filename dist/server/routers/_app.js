import { createTRPCRouter } from '../trpc.js';
import { pipelineRouter } from './pipeline.router.js';
import { runRouter } from './run.router.js';
import { stepRouter } from './step.router.js';
import { workerRouter } from './worker.router.js';
/**
 * Main application router
 * Combines all resource routers
 */
export const appRouter = createTRPCRouter({
    pipeline: pipelineRouter,
    run: runRouter,
    step: stepRouter,
    worker: workerRouter,
});
//# sourceMappingURL=_app.js.map