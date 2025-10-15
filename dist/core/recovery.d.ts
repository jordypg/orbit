/**
 * Run Recovery System
 * Detects and resumes interrupted pipeline runs
 */
import type { StepContext } from "./types.js";
/**
 * Represents an interrupted run that needs recovery
 */
export interface InterruptedRun {
    runId: string;
    pipelineId: string;
    pipelineName: string;
    startedAt: Date;
    lastStepUpdate: Date | null;
    completedSteps: string[];
    failedSteps: string[];
    nextStepToExecute: string | null;
}
/**
 * Result of step completion analysis
 */
export interface StepAnalysis {
    completedSteps: Array<{
        name: string;
        result: string | null;
        finishedAt: Date;
    }>;
    failedSteps: Array<{
        name: string;
        error: string | null;
        attemptCount: number;
    }>;
    pendingSteps: Array<{
        name: string;
    }>;
    lastCompletedStep: string | null;
}
/**
 * Detects interrupted runs in the database
 */
export declare function detectInterruptedRuns(): Promise<InterruptedRun[]>;
/**
 * Analyzes the completion state of steps in a run
 */
export declare function analyzeStepCompletion(runId: string): Promise<StepAnalysis>;
/**
 * Reconstructs the StepContext from completed steps in the database
 */
export declare function reconstructStepContext(runId: string, pipelineId: string, metadata?: Record<string, unknown>): Promise<StepContext>;
/**
 * Resumes execution of an interrupted run from the last successful step
 */
export declare function resumeRun(runId: string): Promise<{
    success: boolean;
    error?: string;
    stepsExecuted: number;
}>;
/**
 * Run Recovery Orchestrator
 * Coordinates the detection and recovery of interrupted runs
 */
export declare class RunRecoveryOrchestrator {
    /**
     * Scans for and recovers all interrupted runs
     */
    recoverInterruptedRuns(): Promise<{
        detected: number;
        recovered: number;
        failed: number;
        errors: Array<{
            runId: string;
            error: string;
        }>;
    }>;
}
//# sourceMappingURL=recovery.d.ts.map