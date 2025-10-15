import prisma from "./prisma.js";
// Re-export the Prisma client singleton
export { prisma };
// Connection lifecycle management
export async function connectDatabase() {
    try {
        await prisma.$connect();
        console.log("✓ Database connected successfully");
    }
    catch (error) {
        console.error("✗ Database connection failed:", error);
        throw error;
    }
}
export async function disconnectDatabase() {
    try {
        await prisma.$disconnect();
        console.log("✓ Database disconnected");
    }
    catch (error) {
        console.error("✗ Database disconnection failed:", error);
        throw error;
    }
}
// Health check for database connection
export async function checkDatabaseHealth() {
    try {
        await prisma.$queryRaw `SELECT 1`;
        return true;
    }
    catch (error) {
        console.error("Database health check failed:", error);
        return false;
    }
}
// Graceful shutdown handler
export function setupGracefulShutdown() {
    const shutdown = async (signal) => {
        console.log(`\n${signal} received. Shutting down gracefully...`);
        await disconnectDatabase();
        process.exit(0);
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}
export default prisma;
//# sourceMappingURL=storage.js.map