const STOP_MESSAGE = '提取已停止。';

type RunControl = {
  cancelled: boolean;
  controllers: Set<AbortController>;
};

const controls = new Map<string, RunControl>();

function getOrCreate(runId: string): RunControl {
  const existing = controls.get(runId);
  if (existing) return existing;

  const next: RunControl = {
    cancelled: false,
    controllers: new Set()
  };
  controls.set(runId, next);
  return next;
}

export function registerRun(runId: string) {
  getOrCreate(runId);
}

export function registerRequestController(runId: string, controller: AbortController) {
  getOrCreate(runId).controllers.add(controller);
}

export function unregisterRequestController(runId: string, controller: AbortController) {
  controls.get(runId)?.controllers.delete(controller);
}

export function requestRunStop(runId: string) {
  const control = getOrCreate(runId);
  control.cancelled = true;
  for (const controller of control.controllers) {
    controller.abort(STOP_MESSAGE);
  }
}

export function isRunStopRequested(runId: string) {
  return controls.get(runId)?.cancelled ?? false;
}

export function clearRunControl(runId: string) {
  controls.delete(runId);
}

export function getRunStopMessage() {
  return STOP_MESSAGE;
}
