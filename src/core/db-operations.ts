import prisma from "./prisma.js";

// ==================== Pipeline Operations ====================

export async function createPipeline(data: {
  name: string;
  description?: string;
  schedule?: string;
}) {
  return prisma.pipeline.create({
    data,
  });
}

export async function getPipeline(id: string) {
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

export async function getPipelineByName(name: string) {
  return prisma.pipeline.findUnique({
    where: { name },
  });
}

export async function listPipelines() {
  return prisma.pipeline.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function updatePipeline(
  id: string,
  data: {
    name?: string;
    description?: string;
    schedule?: string;
  }
) {
  return prisma.pipeline.update({
    where: { id },
    data,
  });
}

export async function deletePipeline(id: string) {
  return prisma.pipeline.delete({
    where: { id },
  });
}

// ==================== Run Operations ====================

export async function createRun(data: {
  pipelineId: string;
  triggeredBy?: string;
}) {
  return prisma.run.create({
    data: {
      ...data,
      status: "pending",
    },
  });
}

export async function getRun(id: string) {
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

export async function getRunsByPipeline(pipelineId: string, limit = 50) {
  return prisma.run.findMany({
    where: { pipelineId },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      steps: true,
    },
  });
}

export async function updateRunStatus(
  id: string,
  status: string,
  finishedAt?: Date
) {
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

export async function createStep(data: {
  runId: string;
  name: string;
}) {
  return prisma.step.create({
    data: {
      ...data,
      status: "pending",
    },
  });
}

export async function getStepsByRun(runId: string) {
  return prisma.step.findMany({
    where: { runId },
    orderBy: { startedAt: "asc" },
  });
}

export async function updateStepStatus(
  id: string,
  data: {
    status: string;
    startedAt?: Date;
    finishedAt?: Date;
    attemptCount?: number;
    nextRetryAt?: Date;
  }
) {
  return prisma.step.update({
    where: { id },
    data,
  });
}

export async function updateStepResult(
  id: string,
  result: string,
  error?: string
) {
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
export async function createRunWithSteps(
  pipelineId: string,
  stepNames: string[],
  triggeredBy?: string
) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.run.create({
      data: {
        pipelineId,
        triggeredBy,
        status: "pending",
      },
    });

    const steps = await Promise.all(
      stepNames.map((name) =>
        tx.step.create({
          data: {
            runId: run.id,
            name,
            status: "pending",
          },
        })
      )
    );

    return { run, steps };
  });
}

/**
 * Update run and step statuses atomically
 */
export async function updateRunAndStepStatus(
  runId: string,
  stepId: string,
  runStatus: string,
  stepStatus: string,
  stepData?: {
    error?: string;
    result?: string;
    attemptCount?: number;
  }
) {
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
export async function completeRun(runId: string, status: "success" | "failed") {
  return prisma.run.update({
    where: { id: runId },
    data: {
      status,
      finishedAt: new Date(),
    },
  });
}
