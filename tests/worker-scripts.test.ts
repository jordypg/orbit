/**
 * Integration tests for worker NPM scripts
 * Tests that worker scripts can be started and work correctly
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { spawn, ChildProcess } from "child_process";
import prisma from "../src/core/prisma.js";
import { definePipeline, registry } from "../src/core/index.js";

const TEST_PIPELINE_NAME = "script-test-pipeline";

describe("Worker NPM Scripts", () => {
  let workerProcess: ChildProcess | null = null;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.run.deleteMany({
      where: {
        pipeline: {
          name: TEST_PIPELINE_NAME,
        },
      },
    });
    await prisma.pipeline.deleteMany({
      where: {
        name: TEST_PIPELINE_NAME,
      },
    });

    // Create test pipeline in database
    await prisma.pipeline.create({
      data: {
        name: TEST_PIPELINE_NAME,
        description: "Test pipeline for script integration tests",
      },
    });
  });

  afterAll(async () => {
    // Kill worker if still running
    if (workerProcess) {
      workerProcess.kill("SIGTERM");
      workerProcess = null;
    }

    // Clean up test data
    await prisma.run.deleteMany({
      where: {
        pipeline: {
          name: TEST_PIPELINE_NAME,
        },
      },
    });
    await prisma.pipeline.deleteMany({
      where: {
        name: TEST_PIPELINE_NAME,
      },
    });
  });

  describe("Production Worker Script", () => {
    it("should start worker process successfully", (done) => {
      workerProcess = spawn("npm", ["run", "worker"], {
        stdio: "pipe",
        shell: true,
      });

      let output = "";
      let completed = false;

      workerProcess.stdout?.on("data", (data) => {
        output += data.toString();

        // Check for successful startup message
        if (output.includes("Worker initialized successfully") && !completed) {
          completed = true;
          expect(output).toContain("Worker process starting");
          expect(output).toContain("Loading pipelines");
          expect(output).toContain("Worker initialized successfully");

          // Kill the worker
          workerProcess?.kill("SIGTERM");
          workerProcess = null;

          // Wait a bit for process to clean up
          setTimeout(() => done(), 100);
        }
      });

      workerProcess.stderr?.on("data", (data) => {
        console.error("Worker stderr:", data.toString());
      });

      workerProcess.on("error", (error) => {
        if (!completed) {
          completed = true;
          done(error);
        }
      });

      // Safety timeout
      const timeout = setTimeout(() => {
        if (workerProcess && !completed) {
          completed = true;
          workerProcess.kill("SIGTERM");
          workerProcess = null;
          done(new Error("Worker startup timeout"));
        }
      }, 10000);

      workerProcess.on("exit", () => {
        clearTimeout(timeout);
      });
    }, 15000);
  });

  describe("Development Worker Script", () => {
    it("should start worker in dev mode with tsx", (done) => {
      const devProcess = spawn("npm", ["run", "worker:dev"], {
        stdio: "pipe",
        shell: true,
      });

      let output = "";
      let completed = false;

      devProcess.stdout?.on("data", (data) => {
        output += data.toString();

        // Check for successful startup message
        if (output.includes("Worker initialized successfully") && !completed) {
          completed = true;
          expect(output).toContain("tsx watch");
          expect(output).toContain("Worker process starting");
          expect(output).toContain("Worker initialized successfully");

          devProcess.kill("SIGTERM");

          // Wait a bit for process to clean up
          setTimeout(() => done(), 100);
        }
      });

      devProcess.stderr?.on("data", (data) => {
        // tsx may output to stderr, that's okay
        console.log("Dev worker stderr:", data.toString());
      });

      devProcess.on("error", (error) => {
        if (!completed) {
          completed = true;
          done(error);
        }
      });

      // Safety timeout
      const timeout = setTimeout(() => {
        if (!completed) {
          completed = true;
          devProcess.kill("SIGTERM");
          done(new Error("Dev worker startup timeout"));
        }
      }, 15000);

      devProcess.on("exit", () => {
        clearTimeout(timeout);
      });
    }, 20000);
  });

  describe("Worker Script Environment", () => {
    it("should respect POLL_INTERVAL environment variable", (done) => {
      const customInterval = 3000;
      const envWorker = spawn("npm", ["run", "worker"], {
        stdio: "pipe",
        shell: true,
        env: {
          ...process.env,
          POLL_INTERVAL: customInterval.toString(),
        },
      });

      let output = "";
      let completed = false;

      envWorker.stdout?.on("data", (data) => {
        output += data.toString();

        if (output.includes("Worker initialized successfully") && !completed) {
          completed = true;
          expect(output).toContain(`"pollInterval":${customInterval}`);
          envWorker.kill("SIGTERM");

          // Wait a bit for process to clean up
          setTimeout(() => done(), 100);
        }
      });

      envWorker.on("error", (error) => {
        if (!completed) {
          completed = true;
          done(error);
        }
      });

      // Safety timeout
      const timeout = setTimeout(() => {
        if (!completed) {
          completed = true;
          envWorker.kill("SIGTERM");
          done(new Error("Env test timeout"));
        }
      }, 10000);

      envWorker.on("exit", () => {
        clearTimeout(timeout);
      });
    }, 15000);
  });
});
