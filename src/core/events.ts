import { EventEmitter } from "events";

export interface RunStatusEvent {
  type: "run_status_changed" | "step_status_changed";
  runId: string;
  pipelineId: string;
  status: string;
  timestamp: Date;
  stepId?: string;
  stepName?: string;
}

class RunEventEmitter extends EventEmitter {
  emitRunStatusChange(event: RunStatusEvent) {
    console.log('[RunEvents] Emitting event:', {
      type: event.type,
      runId: event.runId,
      pipelineId: event.pipelineId,
      status: event.status,
      listeners: this.listenerCount("runStatusChange"),
    });
    this.emit("runStatusChange", event);
  }
}

// Singleton instance shared across the application
export const runEvents = new RunEventEmitter();
