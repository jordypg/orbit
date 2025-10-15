/**
 * Run Recovery System
 * Detects and resumes interrupted pipeline runs
 */
import prisma from "./prisma.js";
import { registry } from "./registry.js";
import { updateRunStatus } from "./db-operations.js";
/**
 * Threshold for considering a run as interrupted (in minutes)
 * If a run has been in "running" status with no step updates for this duration, it's considered interrupted
 */
const INTERRUPTED_RUN_THRESHOLD_MINUTES = 10;
/**
 * Detects interrupted runs in the database
 */
export async function detectInterruptedRuns() {
    const thresholdDate = new Date(Date.now() - INTERRUPTED_RUN_THRESHOLD_MINUTES * 60 * 1000);
    // Find runs that are still "running" but haven't had activity recently
    const interruptedRuns = await prisma.run.findMany({
        where: {
            status: "running",
            startedAt: {
                lt: thresholdDate,
            },
        },
        include: {
            pipeline: true,
            steps: {
                orderBy: { startedAt: "asc" },
            },
        },
    });
    return interruptedRuns.map((run) => {
        const completedSteps = run.steps
            .filter((s) => s.status === "success")
            .map((s) => s.name);
        const failedSteps = run.steps
            .filter((s) => s.status === "failed")
            .map((s) => s.name);
        const lastStepUpdate = run.steps.length > 0
            ? run.steps.reduce((latest, step) => {
                const stepTime = step.finishedAt || step.startedAt;
                if (!stepTime)
                    return latest;
                if (!latest)
                    return stepTime;
                return stepTime > latest ? stepTime : latest;
            }, null)
            : null;
        // Determine next step to execute
        const allStepNames = run.steps.map((s) => s.name);
        const executedOrFailedSteps = [
            ...completedSteps,
            ...failedSteps,
        ];
        const nextStep = allStepNames.find((name) => !executedOrFailedSteps.includes(name));
        return {
            runId: run.id,
            pipelineId: run.pipelineId,
            pipelineName: run.pipeline.name,
            startedAt: run.startedAt,
            lastStepUpdate,
            completedSteps,
            failedSteps,
            nextStepToExecute: nextStep || null,
        };
    });
}
/**
 * Analyzes the completion state of steps in a run
 */
export async function analyzeStepCompletion(runId) {
    const steps = await prisma.step.findMany({
        where: { runId },
        orderBy: { startedAt: "asc" },
    });
    const completedSteps = steps
        .filter((s) => s.status === "success")
        .map((s) => ({
        name: s.name,
        result: s.result,
        finishedAt: s.finishedAt,
    }));
    const failedSteps = steps
        .filter((s) => s.status === "failed")
        .map((s) => ({
        name: s.name,
        error: s.error,
        attemptCount: s.attemptCount,
    }));
    const pendingSteps = steps
        .filter((s) => s.status === "pending" || s.status === "running" || s.status === "retrying")
        .map((s) => ({
        name: s.name,
    }));
    const lastCompletedStep = completedSteps.length > 0
        ? completedSteps[completedSteps.length - 1].name
        : null;
    return {
        completedSteps,
        failedSteps,
        pendingSteps,
        lastCompletedStep,
    };
}
/**
 * Reconstructs the StepContext from completed steps in the database
 */
export async function reconstructStepContext(runId, pipelineId, metadata) {
    const steps = await prisma.step.findMany({
        where: {
            runId,
            status: "success",
        },
        orderBy: { finishedAt: "asc" },
    });
    const prevResults = {};
    for (const step of steps) {
        prevResults[step.name] = {
            success: true,
            data: step.result ? JSON.parse(step.result) : undefined,
        };
    }
    return {
        runId,
        pipelineId,
        prevResults,
        metadata,
    };
}
/**
 * Resumes execution of an interrupted run from the last successful step
 */
export async function resumeRun(runId) {
    try {
        // Get the run details
        const run = await prisma.run.findUnique({
            where: { id: runId },
            include: {
                pipeline: true,
                steps: {
                    orderBy: { startedAt: "asc" },
                },
            },
        });
        if (!run) {
            return {
                success: false,
                error: `Run ${runId} not found`,
                stepsExecuted: 0,
            };
        }
        // Get the pipeline definition from registry
        let pipelineDef;
        try {
            pipelineDef = registry.getPipeline(run.pipeline.name);
        }
        catch (error) {
            return {
                success: false,
                error: `Pipeline "${run.pipeline.name}" not found in registry`,
                stepsExecuted: 0,
            };
        }
        // Analyze step completion
        const analysis = await analyzeStepCompletion(runId);
        // If there are failed steps, we can't resume automatically
        if (analysis.failedSteps.length > 0) {
            return {
                success: false,
                error: `Run has ${analysis.failedSteps.length} failed step(s), cannot auto-resume`,
                stepsExecuted: 0,
            };
        }
        // Reconstruct context from completed steps
        const context = await reconstructStepContext(runId, run.pipelineId, run.triggeredBy ? { triggeredBy: run.triggeredBy } : undefined);
        // Find steps that need to be executed
        const completedStepNames = new Set(analysis.completedSteps.map((s) => s.name));
        const stepsToExecute = pipelineDef.steps.filter((stepDef) => !completedStepNames.has(stepDef.name));
        if (stepsToExecute.length === 0) {
            // All steps completed, mark run as success
            await prisma.run.update({
                where: { id: runId },
                data: {
                    status: "success",
                    finishedAt: new Date(),
                },
            });
            return {
                success: true,
                stepsExecuted: 0,
            };
        }
        // We need to manually manage the run since it already exists
        await updateRunStatus(runId, "running");
        // Execute each remaining step manually
        for (const stepDef of stepsToExecute) {
            // Build step context with previous results
            const stepContext = {
                runId,
                pipelineId: run.pipelineId,
                prevResults: context.prevResults,
                metadata: context.metadata,
            };
            // Execute the step handler
            const result = await stepDef.handler(stepContext);
            // Update context with new result
            context.prevResults[stepDef.name] = result;
            // If step failed, throw error to trigger catch block
            if (!result.success) {
                throw new Error(result.error || `Step "${stepDef.name}" failed`);
            }
        }
        // Mark run as successful
        await prisma.run.update({
            where: { id: runId },
            data: {
                status: "success",
                finishedAt: new Date(),
            },
        });
        return {
            success: true,
            stepsExecuted: stepsToExecute.length,
        };
    }
    catch (error) {
        // Mark run as failed
        await prisma.run.update({
            where: { id: runId },
            data: {
                status: "failed",
                finishedAt: new Date(),
            },
        });
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            stepsExecuted: 0,
        };
    }
}
/**
 * Run Recovery Orchestrator
 * Coordinates the detection and recovery of interrupted runs
 */
export class RunRecoveryOrchestrator {
    /**
     * Scans for and recovers all interrupted runs
     */
    async recoverInterruptedRuns() {
        const interruptedRuns = await detectInterruptedRuns();
        const results = {
            detected: interruptedRuns.length,
            recovered: 0,
            failed: 0,
            errors: [],
        };
        for (const run of interruptedRuns) {
            console.log(`Attempting to recover run ${run.runId} (${run.pipelineName})...`);
            const result = await resumeRun(run.runId);
            if (result.success) {
                console.log(`✓ Recovered run ${run.runId}, executed ${result.stepsExecuted} step(s)`);
                results.recovered++;
            }
            else {
                console.log(`✗ Failed to recover run ${run.runId}: ${result.error}`);
                results.failed++;
                results.errors.push({
                    runId: run.runId,
                    error: result.error || "Unknown error",
                });
            }
        }
        return results;
    }
}
//# sourceMappingURL=recovery.js.map