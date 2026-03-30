import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNotificationStore } from './notifications';
import type { NotificationItem } from './notifications';

function readItems(store: ReturnType<typeof createNotificationStore>) {
  let current: NotificationItem[] = [];
  const unsubscribe = store.subscribe((items) => {
    current = items;
  });

  return {
    get: () => current,
    unsubscribe
  };
}

describe('notifications store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('auto-dismisses success in 2 seconds', () => {
    const store = createNotificationStore();
    const state = readItems(store);

    store.notifySuccess('保存成功');
    expect(state.get()).toHaveLength(1);

    vi.advanceTimersByTime(1999);
    expect(state.get()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(state.get()).toHaveLength(0);

    state.unsubscribe();
    store.clearAll();
  });

  it('auto-dismisses error in 3 seconds', () => {
    const store = createNotificationStore();
    const state = readItems(store);

    store.notifyError('请求失败');
    expect(state.get()).toHaveLength(1);

    vi.advanceTimersByTime(2999);
    expect(state.get()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(state.get()).toHaveLength(0);

    state.unsubscribe();
    store.clearAll();
  });

  it('dedupes same notification in a short window and keeps only the latest one', () => {
    const store = createNotificationStore();
    const state = readItems(store);

    store.notifyError('网络异常');
    const first = state.get()[0];
    expect(first).toBeTruthy();

    vi.advanceTimersByTime(200);
    store.notifyError('网络异常');

    expect(state.get()).toHaveLength(1);
    const second = state.get()[0];
    expect(second?.id).not.toBe(first?.id);
    expect(second?.message).toBe('网络异常');

    state.unsubscribe();
    store.clearAll();
  });

  it('keeps at most 3 notifications and evicts oldest first', () => {
    const store = createNotificationStore();
    const state = readItems(store);

    store.notifySuccess('A');
    store.notifySuccess('B');
    store.notifySuccess('C');
    store.notifySuccess('D');

    expect(state.get().map((item) => item.message)).toEqual(['B', 'C', 'D']);

    state.unsubscribe();
    store.clearAll();
  });

  it('dismisses manually', () => {
    const store = createNotificationStore();
    const state = readItems(store);

    store.notifyError('手动关闭测试');
    const first = state.get()[0];
    expect(first).toBeTruthy();

    store.dismiss(first!.id);
    expect(state.get()).toHaveLength(0);

    state.unsubscribe();
    store.clearAll();
  });
});
