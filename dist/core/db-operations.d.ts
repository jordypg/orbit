export declare function createPipeline(data: {
    name: string;
    description?: string;
    schedule?: string;
}): Promise<{
    name: string;
    id: string;
    description: string | null;
    schedule: string | null;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function getPipeline(id: string): Promise<({
    runs: {
        id: string;
        pipelineId: string;
        startedAt: Date;
        finishedAt: Date | null;
        status: string;
        triggeredBy: string | null;
    }[];
} & {
    name: string;
    id: string;
    description: string | null;
    schedule: string | null;
    createdAt: Date;
    updatedAt: Date;
}) | null>;
export declare function getPipelineByName(name: string): Promise<{
    name: string;
    id: string;
    description: string | null;
    schedule: string | null;
    createdAt: Date;
    updatedAt: Date;
} | null>;
export declare function listPipelines(): Promise<{
    name: string;
    id: string;
    description: string | null;
    schedule: string | null;
    createdAt: Date;
    updatedAt: Date;
}[]>;
export declare function updatePipeline(id: string, data: {
    name?: string;
    description?: string;
    schedule?: string;
}): Promise<{
    name: string;
    id: string;
    description: string | null;
    schedule: string | null;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function deletePipeline(id: string): Promise<{
    name: string;
    id: string;
    description: string | null;
    schedule: string | null;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function createRun(data: {
    pipelineId: string;
    triggeredBy?: string;
}): Promise<{
    id: string;
    pipelineId: string;
    startedAt: Date;
    finishedAt: Date | null;
    status: string;
    triggeredBy: string | null;
}>;
export declare function getRun(id: string): Promise<({
    pipeline: {
        name: string;
        id: string;
        description: string | null;
        schedule: string | null;
        createdAt: Date;
        updatedAt: Date;
    };
    steps: {
        error: string | null;
        name: string;
        result: string | null;
        id: string;
        startedAt: Date | null;
        finishedAt: Date | null;
        status: string;
        runId: string;
        attemptCount: number;
        nextRetryAt: Date | null;
    }[];
} & {
    id: string;
    pipelineId: string;
    startedAt: Date;
    finishedAt: Date | null;
    status: string;
    triggeredBy: string | null;
}) | null>;
export declare function getRunsByPipeline(pipelineId: string, limit?: number): Promise<({
    steps: {
        error: string | null;
        name: string;
        result: string | null;
        id: string;
        startedAt: Date | null;
        finishedAt: Date | null;
        status: string;
        runId: string;
        attemptCount: number;
        nextRetryAt: Date | null;
    }[];
} & {
    id: string;
    pipelineId: string;
    startedAt: Date;
    finishedAt: Date | null;
    status: string;
    triggeredBy: string | null;
})[]>;
export declare function updateRunStatus(id: string, status: string, finishedAt?: Date): Promise<{
    id: string;
    pipelineId: string;
    startedAt: Date;
    finishedAt: Date | null;
    status: string;
    triggeredBy: string | null;
}>;
export declare function getActiveRuns(): Promise<{
    id: string;
    pipelineId: string;
    startedAt: Date;
    finishedAt: Date | null;
    status: string;
    triggeredBy: string | null;
}[]>;
export declare function createStep(data: {
    runId: string;
    name: string;
}): Promise<{
    error: string | null;
    name: string;
    result: string | null;
    id: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    status: string;
    runId: string;
    attemptCount: number;
    nextRetryAt: Date | null;
}>;
export declare function getStepsByRun(runId: string): Promise<{
    error: string | null;
    name: string;
    result: string | null;
    id: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    status: string;
    runId: string;
    attemptCount: number;
    nextRetryAt: Date | null;
}[]>;
export declare function updateStepStatus(id: string, data: {
    status: string;
    startedAt?: Date;
    finishedAt?: Date;
    attemptCount?: number;
    nextRetryAt?: Date;
}): Promise<{
    error: string | null;
    name: string;
    result: string | null;
    id: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    status: string;
    runId: string;
    attemptCount: number;
    nextRetryAt: Date | null;
}>;
export declare function updateStepResult(id: string, result: string, error?: string): Promise<{
    error: string | null;
    name: string;
    result: string | null;
    id: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    status: string;
    runId: string;
    attemptCount: number;
    nextRetryAt: Date | null;
}>;
export declare function getRetryableSteps(): Promise<({
    run: {
        pipeline: {
            name: string;
            id: string;
            description: string | null;
            schedule: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: string;
        pipelineId: string;
        startedAt: Date;
        finishedAt: Date | null;
        status: string;
        triggeredBy: string | null;
    };
} & {
    error: string | null;
    name: string;
    result: string | null;
    id: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    status: string;
    runId: string;
    attemptCount: number;
    nextRetryAt: Date | null;
})[]>;
/**
 * Create a run with initial steps in a transaction
 */
export declare function createRunWithSteps(pipelineId: string, stepNames: string[], triggeredBy?: string): Promise<{
    run: {
        id: string;
        pipelineId: string;
        startedAt: Date;
        finishedAt: Date | null;
        status: string;
        triggeredBy: string | null;
    };
    steps: {
        error: string | null;
        name: string;
        result: string | null;
        id: string;
        startedAt: Date | null;
        finishedAt: Date | null;
        status: string;
        runId: string;
        attemptCount: number;
        nextRetryAt: Date | null;
    }[];
}>;
/**
 * Update run and step statuses atomically
 */
export declare function updateRunAndStepStatus(runId: string, stepId: string, runStatus: string, stepStatus: string, stepData?: {
    error?: string;
    result?: string;
    attemptCount?: number;
}): Promise<{
    run: {
        id: string;
        pipelineId: string;
        startedAt: Date;
        finishedAt: Date | null;
        status: string;
        triggeredBy: string | null;
    };
    step: {
        error: string | null;
        name: string;
        result: string | null;
        id: string;
        startedAt: Date | null;
        finishedAt: Date | null;
        status: string;
        runId: string;
        attemptCount: number;
        nextRetryAt: Date | null;
    };
}>;
/**
 * Mark run as complete and update final status
 */
export declare function completeRun(runId: string, status: "success" | "failed"): Promise<{
    id: string;
    pipelineId: string;
    startedAt: Date;
    finishedAt: Date | null;
    status: string;
    triggeredBy: string | null;
}>;
//# sourceMappingURL=db-operations.d.ts.map