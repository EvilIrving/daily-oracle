import { describe, expect, it } from 'vitest';
import { deriveExtractionProgress } from './extraction-progress';

describe('deriveExtractionProgress', () => {
  it('freezes progress when a stopped snapshot exists', () => {
    const progress = deriveExtractionProgress({
      runId: 'run-1',
      status: 'running',
      processedChunks: 8,
      failedChunks: 1,
      activeWorkers: 2,
      totalChunks: 20,
      candidatesCount: 0,
      stopRequestPending: true,
      frozenProgress: {
        runId: 'run-1',
        processedChunks: 5,
        failedChunks: 1,
        activeWorkers: 2,
        totalChunks: 20
      }
    });

    expect(progress.processedChunks).toBe(5);
    expect(progress.progressPercent).toBe(25);
    expect(progress.statusText).toContain('已请求停止');
    expect(progress.actionLabel).toBe('停止中…');
    expect(progress.isFrozen).toBe(true);
  });

  it('shows a single start action when idle', () => {
    const progress = deriveExtractionProgress({
      runId: '',
      status: 'idle',
      processedChunks: 0,
      failedChunks: 0,
      activeWorkers: 0,
      totalChunks: 0,
      candidatesCount: 0,
      stopRequestPending: false
    });

    expect(progress.actionLabel).toBe('开始提取');
    expect(progress.actionTone).toBe('primary');
    expect(progress.statusText).toBe('当前书目还没有提取批次');
  });
});
