#!/usr/bin/env node
/**
 * Orbit CLI
 * Command-line interface for pipeline execution
 */
import { Command } from "commander";
import chalk from "chalk";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readdirSync } from "fs";
import { PipelineExecutor, registry, RunRecoveryOrchestrator, detectInterruptedRuns, resumeRun, } from "./core/index.js";
// Load environment variables
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Logger with colored output
 */
class Logger {
    static info(message) {
        console.log(chalk.blue("ℹ"), message);
    }
    static success(message) {
        console.log(chalk.green("✓"), message);
    }
    static error(message) {
        console.log(chalk.red("✗"), message);
    }
    static warn(message) {
        console.log(chalk.yellow("⚠"), message);
    }
    static step(message) {
        console.log(chalk.cyan("→"), message);
    }
    static header(message) {
        console.log("\n" + chalk.bold.underline(message) + "\n");
    }
    static divider() {
        console.log(chalk.gray("─".repeat(60)));
    }
}
/**
 * Pipeline Loader
 * Discovers and loads pipelines from src/pipelines/ directory
 */
class PipelineLoader {
    pipelinesDir;
    constructor(pipelinesDir) {
        this.pipelinesDir =
            pipelinesDir || join(__dirname, "pipelines");
    }
    /**
     * Discovers all pipeline files in the pipelines directory
     */
    async discoverPipelines() {
        try {
            const files = readdirSync(this.pipelinesDir);
            return files.filter((file) => (file.endsWith(".js") || file.endsWith(".ts")) &&
                !file.endsWith(".d.ts"));
        }
        catch (error) {
            if (error.code === "ENOENT") {
                return [];
            }
            throw error;
        }
    }
    /**
     * Loads a specific pipeline file
     */
    async loadPipeline(filename) {
        try {
            const filepath = join(this.pipelinesDir, filename);
            const module = await import(filepath);
            // Look for default export or named 'pipeline' export
            const pipeline = module.default || module.pipeline;
            if (!pipeline) {
                Logger.warn(`File ${filename} does not export a pipeline (use default export or named 'pipeline' export)`);
                return null;
            }
            // Validate it's a pipeline definition
            if (!pipeline.name ||
                !pipeline.steps ||
                !Array.isArray(pipeline.steps)) {
                Logger.warn(`File ${filename} does not export a valid pipeline`);
                return null;
            }
            return pipeline;
        }
        catch (error) {
            Logger.error(`Failed to load pipeline ${filename}: ${error.message}`);
            return null;
        }
    }
    /**
     * Loads all pipelines and registers them
     */
    async loadAllPipelines() {
        const files = await this.discoverPipelines();
        if (files.length === 0) {
            Logger.warn(`No pipeline files found in ${this.pipelinesDir}`);
            return 0;
        }
        let loadedCount = 0;
        for (const file of files) {
            const pipeline = await this.loadPipeline(file);
            if (pipeline) {
                try {
                    registry.registerPipeline(pipeline);
                    Logger.step(`Loaded pipeline: ${chalk.bold(pipeline.name)}`);
                    loadedCount++;
                }
                catch (error) {
                    Logger.error(`Failed to register pipeline ${pipeline.name}: ${error.message}`);
                }
            }
        }
        return loadedCount;
    }
}
/**
 * Validates environment configuration
 */
function validateEnvironment() {
    if (!process.env.DATABASE_URL) {
        Logger.error("DATABASE_URL environment variable is not set");
        Logger.info("Please set DATABASE_URL in your .env file");
        process.exit(1);
    }
}
/**
 * Formats execution duration
 */
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
}
/**
 * Executes a pipeline and displays progress
 */
async function executePipeline(name) {
    Logger.header(`Running Pipeline: ${name}`);
    // Check if pipeline exists
    if (!registry.hasPipeline(name)) {
        Logger.error(`Pipeline "${name}" not found`);
        Logger.info("\nAvailable pipelines:");
        const pipelines = registry.listPipelines();
        if (pipelines.length === 0) {
            Logger.warn("  No pipelines registered");
        }
        else {
            pipelines.forEach((p) => {
                console.log(`  - ${chalk.bold(p.name)}`);
                if (p.description) {
                    console.log(`    ${chalk.gray(p.description)}`);
                }
            });
        }
        process.exit(1);
    }
    // Get pipeline
    const pipeline = registry.getPipeline(name);
    Logger.info(`Description: ${pipeline.description || "N/A"}`);
    Logger.info(`Steps: ${pipeline.steps.length}`);
    Logger.divider();
    // Create executor
    const executor = new PipelineExecutor(pipeline);
    // Execute
    Logger.info("Starting execution...\n");
    try {
        const result = await executor.execute({
            triggeredBy: "cli",
            metadata: {
                startedAt: new Date().toISOString(),
            },
        });
        Logger.divider();
        if (result.success) {
            Logger.success(`Pipeline completed successfully in ${formatDuration(result.duration)}`);
            Logger.info(`Run ID: ${chalk.gray(result.runId)}`);
            // Show step results
            console.log("\n" + chalk.bold("Step Results:"));
            Object.entries(result.stepResults).forEach(([stepName, stepResult]) => {
                if (stepResult.success) {
                    console.log(`  ${chalk.green("✓")} ${stepName} ${chalk.gray("(success)")}`);
                }
                else {
                    console.log(`  ${chalk.red("✗")} ${stepName} ${chalk.gray("(failed)")}`);
                }
            });
        }
        else {
            Logger.error(`Pipeline failed after ${formatDuration(result.duration)}`);
            Logger.error(`Error: ${result.error}`);
            Logger.info(`Run ID: ${chalk.gray(result.runId)}`);
            process.exit(1);
        }
    }
    catch (error) {
        Logger.divider();
        Logger.error(`Unexpected error: ${error.message}`);
        if (error.stack) {
            console.log(chalk.gray(error.stack));
        }
        process.exit(1);
    }
}
/**
 * Lists all available pipelines
 */
function listPipelines() {
    Logger.header("Available Pipelines");
    const pipelines = registry.listPipelines();
    if (pipelines.length === 0) {
        Logger.warn("No pipelines registered");
        Logger.info("\nCreate pipeline files in src/pipelines/ directory");
        return;
    }
    pipelines.forEach((pipeline) => {
        console.log(chalk.bold.cyan(`\n${pipeline.name}`));
        if (pipeline.description) {
            console.log(`  ${pipeline.description}`);
        }
        console.log(`  ${chalk.gray(`${pipeline.steps.length} steps`)}`);
        if (pipeline.schedule) {
            console.log(`  ${chalk.gray(`Schedule: ${pipeline.schedule}`)}`);
        }
    });
    console.log();
}
/**
 * Checks for interrupted runs without resuming them
 */
async function checkInterruptedRuns() {
    Logger.header("Checking for Interrupted Runs");
    try {
        const interruptedRuns = await detectInterruptedRuns();
        if (interruptedRuns.length === 0) {
            Logger.success("No interrupted runs found");
            return;
        }
        Logger.warn(`Found ${interruptedRuns.length} interrupted run(s):\n`);
        for (const run of interruptedRuns) {
            console.log(chalk.bold(`Run ID: ${run.runId}`));
            console.log(`  Pipeline: ${chalk.cyan(run.pipelineName)}`);
            console.log(`  Started: ${run.startedAt.toISOString()}`);
            console.log(`  Last activity: ${run.lastStepUpdate ? run.lastStepUpdate.toISOString() : "N/A"}`);
            console.log(`  Completed steps: ${chalk.green(run.completedSteps.length)}`);
            console.log(`  Failed steps: ${chalk.red(run.failedSteps.length)}`);
            console.log(`  Next step: ${run.nextStepToExecute ? chalk.yellow(run.nextStepToExecute) : "N/A"}`);
            console.log();
        }
        Logger.info(`\nTo resume a specific run, use: ${chalk.bold("orbit resume <runId>")}`);
        Logger.info(`To auto-resume all runs, use: ${chalk.bold("orbit recover --auto-resume")}`);
    }
    catch (error) {
        Logger.error(`Failed to check interrupted runs: ${error.message}`);
        process.exit(1);
    }
}
/**
 * Resumes a specific interrupted run
 */
async function resumeSpecificRun(runId) {
    Logger.header(`Resuming Run: ${runId}`);
    try {
        const result = await resumeRun(runId);
        Logger.divider();
        if (result.success) {
            Logger.success(`Run ${runId} resumed successfully`);
            Logger.info(`Steps executed: ${result.stepsExecuted}`);
        }
        else {
            Logger.error(`Failed to resume run ${runId}`);
            Logger.error(`Error: ${result.error}`);
            process.exit(1);
        }
    }
    catch (error) {
        Logger.error(`Unexpected error: ${error.message}`);
        if (error.stack) {
            console.log(chalk.gray(error.stack));
        }
        process.exit(1);
    }
}
/**
 * Detects and optionally recovers all interrupted runs
 */
async function recoverInterruptedRuns(autoResume) {
    Logger.header("Run Recovery");
    try {
        if (!autoResume) {
            // Just check for interrupted runs
            await checkInterruptedRuns();
            return;
        }
        Logger.info("Scanning for interrupted runs...\n");
        const orchestrator = new RunRecoveryOrchestrator();
        const result = await orchestrator.recoverInterruptedRuns();
        Logger.divider();
        Logger.info(`\nRecovery Summary:`);
        console.log(`  Detected: ${chalk.yellow(result.detected)}`);
        console.log(`  Recovered: ${chalk.green(result.recovered)}`);
        console.log(`  Failed: ${chalk.red(result.failed)}`);
        if (result.errors.length > 0) {
            console.log(`\n${chalk.bold("Errors:")}`);
            result.errors.forEach(({ runId, error }) => {
                console.log(`  ${chalk.red("✗")} ${runId}: ${error}`);
            });
        }
        if (result.detected === 0) {
            Logger.success("\nNo interrupted runs found");
        }
        else if (result.recovered === result.detected) {
            Logger.success("\nAll interrupted runs recovered successfully");
        }
        else if (result.recovered > 0) {
            Logger.warn("\nSome runs recovered, but some failed");
            process.exit(1);
        }
        else {
            Logger.error("\nFailed to recover any runs");
            process.exit(1);
        }
    }
    catch (error) {
        Logger.error(`Recovery failed: ${error.message}`);
        if (error.stack) {
            console.log(chalk.gray(error.stack));
        }
        process.exit(1);
    }
}
/**
 * Main CLI setup
 */
async function main() {
    // Validate environment
    validateEnvironment();
    // Create program
    const program = new Command();
    program
        .name("orbit")
        .description("Resilient job execution pipeline with retry logic")
        .version("1.0.0")
        .option("--auto-recover", "Automatically recover interrupted runs on startup");
    // Load pipelines
    const loader = new PipelineLoader();
    const loadedCount = await loader.loadAllPipelines();
    if (loadedCount > 0) {
        Logger.success(`Loaded ${loadedCount} pipeline(s)\n`);
    }
    // Auto-recovery on startup if enabled
    if (process.argv.includes("--auto-recover")) {
        Logger.info("Auto-recovery enabled, checking for interrupted runs...\n");
        try {
            const orchestrator = new RunRecoveryOrchestrator();
            const result = await orchestrator.recoverInterruptedRuns();
            if (result.detected > 0) {
                Logger.info(`Recovered ${result.recovered}/${result.detected} interrupted run(s)\n`);
            }
        }
        catch (error) {
            Logger.warn(`Auto-recovery failed: ${error.message}\n`);
        }
    }
    // Run command
    program
        .command("run <name>")
        .description("Execute a pipeline by name")
        .action(async (name) => {
        await executePipeline(name);
    });
    // List command
    program
        .command("list")
        .description("List all available pipelines")
        .action(() => {
        listPipelines();
    });
    // Recovery commands
    program
        .command("recover")
        .description("Detect and recover all interrupted runs")
        .option("--auto-resume", "Automatically resume all interrupted runs")
        .action(async (options) => {
        await recoverInterruptedRuns(options.autoResume);
    });
    program
        .command("resume <runId>")
        .description("Resume a specific interrupted run by ID")
        .action(async (runId) => {
        await resumeSpecificRun(runId);
    });
    program
        .command("check-interrupted")
        .description("Check for interrupted runs without resuming them")
        .action(async () => {
        await checkInterruptedRuns();
    });
    // Parse arguments
    program.parse(process.argv);
    // Show help if no command provided
    if (!process.argv.slice(2).length) {
        program.outputHelp();
    }
}
// Run CLI
main().catch((error) => {
    Logger.error(`Fatal error: ${error.message}`);
    if (error.stack) {
        console.log(chalk.gray(error.stack));
    }
    process.exit(1);
});
//# sourceMappingURL=cli.js.map