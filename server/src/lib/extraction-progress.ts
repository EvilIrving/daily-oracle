export type ExtractionProgressSnapshot = {
  runId: string;
  processedChunks: number;
  failedChunks: number;
  activeWorkers: number;
  totalChunks: number;
};

export type ExtractionProgressState = {
  processedChunks: number;
  failedChunks: number;
  activeWorkers: number;
  totalChunks: number;
  progressPercent: number;
  chunkLabel: string;
  summaryLabel: string;
  statusText: string;
  actionLabel: string;
  actionTone: 'primary' | 'secondary';
  isRunning: boolean;
  isStopped: boolean;
  isFrozen: boolean;
};

type DeriveExtractionProgressInput = {
  runId: string;
  status: string;
  processedChunks: number;
  failedChunks: number;
  activeWorkers: number;
  totalChunks: number;
  candidatesCount: number;
  stopRequestPending: boolean;
  lastError?: string | null;
  frozenProgress?: ExtractionProgressSnapshot | null;
};

function normalizeStatus(status: string) {
  return String(status || 'IDLE').trim().toUpperCase();
}

export function deriveExtractionProgress(input: DeriveExtractionProgressInput): ExtractionProgressState {
  const normalizedStatus = normalizeStatus(input.status);
  const frozen =
    input.frozenProgress && input.frozenProgress.runId === input.runId ? input.frozenProgress : null;
  const processedChunks = frozen ? Math.min(input.processedChunks, frozen.processedChunks) : input.processedChunks;
  const failedChunks = frozen ? Math.min(input.failedChunks, frozen.failedChunks) : input.failedChunks;
  const activeWorkers = frozen ? frozen.activeWorkers : input.activeWorkers;
  const totalChunks = frozen?.totalChunks ?? input.totalChunks;
  const isRunning = normalizedStatus === 'RUNNING' || normalizedStatus === 'QUEUED';
  const isStopped = normalizedStatus === 'STOPPED';
  const isPartial = normalizedStatus === 'PARTIAL';
  const isDone = normalizedStatus === 'DONE';
  const isError = normalizedStatus === 'ERROR';
  const progressPercent =
    totalChunks > 0 ? Math.min(100, Math.round((processedChunks / totalChunks) * 100)) : isDone ? 100 : 0;
  const chunkLabel = totalChunks > 0 ? `${processedChunks}/${totalChunks}` : '--/--';
  const summaryLabel = totalChunks > 0 ? `第 ${processedChunks}/${totalChunks} 个 chunk` : '尚未切片';
  const statusText = !input.runId
    ? '当前书目还没有提取批次'
    : isRunning
      ? input.stopRequestPending
        ? `已请求停止，当前 ${summaryLabel} 收尾中…`
        : `正在提取：${summaryLabel}，失败 ${failedChunks} 段`
      : isStopped
        ? input.lastError || '提取已停止。'
        : isDone
          ? input.candidatesCount > 0
            ? `提取完成，生成 ${input.candidatesCount} 条候选`
            : '提取完成，但未生成候选。'
          : isPartial
            ? `部分完成：${summaryLabel}，失败 ${failedChunks} 段`
            : isError
              ? input.lastError || '提取失败。'
              : input.lastError || '已加载提取批次';
  const actionLabel = isRunning ? (input.stopRequestPending ? '停止中…' : '停止提取') : '开始提取';

  return {
    processedChunks,
    failedChunks,
    activeWorkers,
    totalChunks,
    progressPercent,
    chunkLabel,
    summaryLabel,
    statusText,
    actionLabel,
    actionTone: isRunning ? 'secondary' : 'primary',
    isRunning,
    isStopped,
    isFrozen: Boolean(frozen)
  };
}
