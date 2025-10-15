import prisma from "./prisma.js";
export { prisma };
export declare function connectDatabase(): Promise<void>;
export declare function disconnectDatabase(): Promise<void>;
export declare function checkDatabaseHealth(): Promise<boolean>;
export declare function setupGracefulShutdown(): void;
export default prisma;
//# sourceMappingURL=storage.d.ts.map