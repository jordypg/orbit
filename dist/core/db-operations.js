import prisma from "./prisma.js";
// ==================== Pipeline Operations ====================
export async function createPipeline(data) {
    return prisma.pipeline.create({
        data,
    });
}
export async function getPipeline(id) {
    return prisma.pipeline.findUnique({
        where: { id },
        include: {
            runs: {
                orderBy: { startedAt: "desc" },
                take: 10,
            },
        },
    });
}
export async function getPipelineByName(name) {
    return prisma.pipeline.findUnique({
        where: { name },
    });
}
export async function listPipelines() {
    return prisma.pipeline.findMany({
        orderBy: { createdAt: "desc" },
    });
}
export async function updatePipeline(id, data) {
    return prisma.pipeline.update({
        where: { id },
        data,
    });
}
export async function deletePipeline(id) {
    return prisma.pipeline.delete({
        where: { id },
    });
}
// ==================== Run Operations ====================
export async function createRun(data) {
    return prisma.run.create({
        data: {
            ...data,
            status: "pending",
        },
    });
}
export async function getRun(id) {
    return prisma.run.findUnique({
        where: { id },
        include: {
            pipeline: true,
            steps: {
                orderBy: { startedAt: "asc" },
            },
        },
    });
}
export async function getRunsByPipeline(pipelineId, limit = 50) {
    return prisma.run.findMany({
        where: { pipelineId },
        orderBy: { startedAt: "desc" },
        take: limit,
        include: {
            steps: true,
        },
    });
}
export async function updateRunStatus(id, status, finishedAt) {
    return prisma.run.update({
        where: { id },
        data: {
            status,
            finishedAt,
        },
    });
}
export async function getActiveRuns() {
    return prisma.run.findMany({
        where: {
            status: {
                in: ["pending", "running"],
            },
        },
        orderBy: { startedAt: "asc" },
    });
}
// ==================== Step Operations ====================
export async function createStep(data) {
    return prisma.step.create({
        data: {
            ...data,
            status: "pending",
        },
    });
}
export async function getStepsByRun(runId) {
    return prisma.step.findMany({
        where: { runId },
        orderBy: { startedAt: "asc" },
    });
}
export async function updateStepStatus(id, data) {
    return prisma.step.update({
        where: { id },
        data,
    });
}
export async function updateStepResult(id, result, error) {
    return prisma.step.update({
        where: { id },
        data: {
            result,
            error,
            finishedAt: new Date(),
        },
    });
}
export async function getRetryableSteps() {
    return prisma.step.findMany({
        where: {
            status: "retrying",
            nextRetryAt: {
                lte: new Date(),
            },
        },
        include: {
            run: {
                include: {
                    pipeline: true,
                },
            },
        },
    });
}
// ==================== Transaction Operations ====================
/**
 * Create a run with initial steps in a transaction
 */
export async function createRunWithSteps(pipelineId, stepNames, triggeredBy) {
    return prisma.$transaction(async (tx) => {
        const run = await tx.run.create({
            data: {
                pipelineId,
                triggeredBy,
                status: "pending",
            },
        });
        const steps = await Promise.all(stepNames.map((name) => tx.step.create({
            data: {
                runId: run.id,
                name,
                status: "pending",
            },
        })));
        return { run, steps };
    });
}
/**
 * Update run and step statuses atomically
 */
export async function updateRunAndStepStatus(runId, stepId, runStatus, stepStatus, stepData) {
    return prisma.$transaction(async (tx) => {
        const step = await tx.step.update({
            where: { id: stepId },
            data: {
                status: stepStatus,
                finishedAt: new Date(),
                ...stepData,
            },
        });
        const run = await tx.run.update({
            where: { id: runId },
            data: {
                status: runStatus,
            },
        });
        return { run, step };
    });
}
/**
 * Mark run as complete and update final status
 */
export async function completeRun(runId, status) {
    return prisma.run.update({
        where: { id: runId },
        data: {
            status,
            finishedAt: new Date(),
        },
    });
}
//# sourceMappingURL=db-operations.js.map