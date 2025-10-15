import type { Run, Pipeline } from "@prisma/client";
/**
 * Run with pipeline relation
 */
export type RunWithPipeline = Run & {
    pipeline: Pipeline;
};
/**
 * Atomically claim a pending run from the database
 *
 * Uses a Prisma transaction with SELECT FOR UPDATE SKIP LOCKED
 * to prevent race conditions when multiple workers are running.
 *
 * @returns The claimed run with pipeline relation, or null if no pending runs
 */
export declare function claimPendingRun(): Promise<RunWithPipeline | null>;
//# sourceMappingURL=run-claimer.d.ts.map