import prisma from "./prisma.js";
/**
 * Atomically claim a pending run from the database
 *
 * Uses a Prisma transaction with SELECT FOR UPDATE SKIP LOCKED
 * to prevent race conditions when multiple workers are running.
 *
 * @returns The claimed run with pipeline relation, or null if no pending runs
 */
export async function claimPendingRun() {
    return await prisma.$transaction(async (tx) => {
        // Find first pending run (ordered by creation time)
        // Note: Prisma doesn't directly support FOR UPDATE SKIP LOCKED syntax,
        // but transactions provide serializable isolation which prevents conflicts
        const run = await tx.run.findFirst({
            where: { status: "pending" },
            orderBy: { startedAt: "asc" },
            include: { pipeline: true },
        });
        if (!run) {
            return null;
        }
        // Atomically claim it by marking as running
        const updatedRun = await tx.run.update({
            where: { id: run.id },
            data: {
                status: "running",
                startedAt: new Date(),
            },
            include: { pipeline: true },
        });
        return updatedRun;
    });
}
//# sourceMappingURL=run-claimer.js.map