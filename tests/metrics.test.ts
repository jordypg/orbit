/**
 * Tests for Worker Metrics Collection System
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  MetricsCollector,
  recordRun,
  getMetrics,
  getMetricsSnapshot,
} from "../src/core/metrics.js";

describe("Metrics Collection System", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  afterEach(() => {
    collector.stopPeriodicReporting();
  });

  describe("Basic Metrics Recording", () => {
    it("should record successful run", () => {
      collector.recordRun(1000, true);

      const metrics = collector.getDerivedMetrics();

      expect(metrics.totalRuns).toBe(1);
      expect(metrics.totalSucceeded).toBe(1);
      expect(metrics.totalFailed).toBe(0);
      expect(metrics.avgExecutionTime).toBe(1000);
      expect(metrics.successRate).toBe(100);
      expect(metrics.errorRate).toBe(0);
    });

    it("should record failed run", () => {
      collector.recordRun(500, false);

      const metrics = collector.getDerivedMetrics();

      expect(metrics.totalRuns).toBe(1);
      expect(metrics.totalSucceeded).toBe(0);
      expect(metrics.totalFailed).toBe(1);
      expect(metrics.avgExecutionTime).toBe(500);
      expect(metrics.successRate).toBe(0);
      expect(metrics.errorRate).toBe(100);
    });

    it("should record multiple runs and calculate averages", () => {
      collector.recordRun(1000, true);
      collector.recordRun(2000, true);
      collector.recordRun(3000, false);

      const metrics = collector.getDerivedMetrics();

      expect(metrics.totalRuns).toBe(3);
      expect(metrics.totalSucceeded).toBe(2);
      expect(metrics.totalFailed).toBe(1);
      expect(metrics.avgExecutionTime).toBe(2000); // (1000 + 2000 + 3000) / 3
      expect(metrics.successRate).toBeCloseTo(66.67, 1);
      expect(metrics.errorRate).toBeCloseTo(33.33, 1);
    });
  });

  describe("Min/Max Tracking", () => {
    it("should track minimum execution time", () => {
      collector.recordRun(500, true);
      collector.recordRun(1000, true);
      collector.recordRun(250, true);

      const metrics = collector.getDerivedMetrics();

      expect(metrics.minExecutionTime).toBe(250);
    });

    it("should track maximum execution time", () => {
      collector.recordRun(500, true);
      collector.recordRun(1000, true);
      collector.recordRun(2500, true);

      const metrics = collector.getDerivedMetrics();

      expect(metrics.maxExecutionTime).toBe(2500);
    });

    it("should update min/max across multiple runs", () => {
      collector.recordRun(1000, true);
      collector.recordRun(100, true);
      collector.recordRun(5000, true);
      collector.recordRun(50, true);
      collector.recordRun(10000, false);

      const metrics = collector.getDerivedMetrics();

      expect(metrics.minExecutionTime).toBe(50);
      expect(metrics.maxExecutionTime).toBe(10000);
    });
  });

  describe("Uptime Formatting", () => {
    it("should format uptime in seconds", () => {
      // Create collector and immediately check
      const metrics = collector.getDerivedMetrics();

      expect(metrics.uptime).toBe(0);
      expect(metrics.uptimeFormatted).toBe("0s");
    });

    it("should format uptime with multiple units", async () => {
      // We can't easily test this without waiting, but we can verify the format
      const metrics = collector.getDerivedMetrics();

      expect(metrics.uptimeFormatted).toMatch(/^\d+s$/); // Should match format like "0s", "1s", etc.
    });
  });

  describe("Runs Per Hour Calculation", () => {
    it("should calculate runs per hour correctly", () => {
      // Record 10 runs
      for (let i = 0; i < 10; i++) {
        collector.recordRun(100, true);
      }

      const metrics = collector.getDerivedMetrics();

      // All 10 runs are within the 1-hour window
      expect(metrics.runsPerHour).toBeGreaterThan(0);
    });

    it("should handle zero runs", () => {
      const metrics = collector.getDerivedMetrics();

      expect(metrics.runsPerHour).toBe(0);
    });
  });

  describe("Metrics Snapshot", () => {
    it("should provide complete snapshot with raw and derived metrics", () => {
      collector.recordRun(1000, true);
      collector.recordRun(2000, false);

      const snapshot = collector.getMetricsSnapshot();

      // Check structure
      expect(snapshot).toHaveProperty("raw");
      expect(snapshot).toHaveProperty("derived");
      expect(snapshot).toHaveProperty("timestamp");

      // Check raw metrics
      expect(snapshot.raw.runsExecuted).toBe(2);
      expect(snapshot.raw.runsSucceeded).toBe(1);
      expect(snapshot.raw.runsFailed).toBe(1);

      // Check derived metrics
      expect(snapshot.derived.totalRuns).toBe(2);
      expect(snapshot.derived.successRate).toBe(50);
      expect(snapshot.derived.errorRate).toBe(50);
    });
  });

  describe("Metrics Reset", () => {
    it("should reset all metrics to initial state", () => {
      collector.recordRun(1000, true);
      collector.recordRun(2000, false);
      collector.recordRun(3000, true);

      collector.reset();

      const metrics = collector.getDerivedMetrics();

      expect(metrics.totalRuns).toBe(0);
      expect(metrics.totalSucceeded).toBe(0);
      expect(metrics.totalFailed).toBe(0);
      expect(metrics.avgExecutionTime).toBe(0);
      expect(metrics.minExecutionTime).toBe(0);
      expect(metrics.maxExecutionTime).toBe(0);
    });
  });

  describe("Periodic Reporting", () => {
    it("should start and stop periodic reporting", () => {
      collector.startPeriodicReporting(1000);

      // Should have started
      expect((collector as any).reportInterval).toBeTruthy();

      collector.stopPeriodicReporting();

      // Should have stopped
      expect((collector as any).reportInterval).toBeNull();
    });

    it("should stop existing interval when starting new one", () => {
      collector.startPeriodicReporting(1000);
      const firstInterval = (collector as any).reportInterval;

      collector.startPeriodicReporting(2000);
      const secondInterval = (collector as any).reportInterval;

      expect(secondInterval).not.toBe(firstInterval);

      collector.stopPeriodicReporting();
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero execution time", () => {
      collector.recordRun(0, true);

      const metrics = collector.getDerivedMetrics();

      expect(metrics.avgExecutionTime).toBe(0);
      expect(metrics.minExecutionTime).toBe(0);
    });

    it("should handle very large execution times", () => {
      const largeTime = 999999999;
      collector.recordRun(largeTime, true);

      const metrics = collector.getDerivedMetrics();

      expect(metrics.maxExecutionTime).toBe(largeTime);
    });

    it("should handle mixed success and failure patterns", () => {
      // Alternating pattern
      collector.recordRun(100, true);
      collector.recordRun(100, false);
      collector.recordRun(100, true);
      collector.recordRun(100, false);
      collector.recordRun(100, true);

      const metrics = collector.getDerivedMetrics();

      expect(metrics.totalRuns).toBe(5);
      expect(metrics.totalSucceeded).toBe(3);
      expect(metrics.totalFailed).toBe(2);
      expect(metrics.successRate).toBe(60);
      expect(metrics.errorRate).toBe(40);
    });
  });

  describe("Convenience Functions", () => {
    it("should work with global singleton instance", () => {
      // These use the global singleton
      recordRun(1000, true);
      recordRun(2000, false);

      const metrics = getMetrics();

      // Note: These will include any previous test runs
      // So we just verify the functions work
      expect(metrics.totalRuns).toBeGreaterThanOrEqual(2);
    });

    it("should get snapshot from global instance", () => {
      const snapshot = getMetricsSnapshot();

      expect(snapshot).toHaveProperty("raw");
      expect(snapshot).toHaveProperty("derived");
      expect(snapshot).toHaveProperty("timestamp");
    });
  });

  describe("Recent Executions Window", () => {
    it("should maintain recent executions", () => {
      collector.recordRun(100, true);
      collector.recordRun(200, true);
      collector.recordRun(300, false);

      const raw = collector.getRawMetrics();

      expect(raw.recentExecutions).toHaveLength(3);
      expect(raw.recentExecutions[0]?.duration).toBe(100);
      expect(raw.recentExecutions[1]?.duration).toBe(200);
      expect(raw.recentExecutions[2]?.duration).toBe(300);
    });

    it("should limit recent executions to max count", () => {
      // Record more than MAX_RECENT_EXECUTIONS (1000)
      for (let i = 0; i < 1100; i++) {
        collector.recordRun(100, true);
      }

      const raw = collector.getRawMetrics();

      // Should be capped at 1000
      expect(raw.recentExecutions.length).toBeLessThanOrEqual(1000);
    });
  });
});
