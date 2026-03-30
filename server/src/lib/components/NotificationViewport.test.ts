import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import NotificationViewport from './NotificationViewport.svelte';
import { notifications } from '$lib/notifications';

describe('NotificationViewport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    notifications.clearAll();
  });

  afterEach(() => {
    notifications.clearAll();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders success and error notification cards', () => {
    notifications.notifySuccess('保存成功');
    notifications.notifyError('请求失败');

    const { body } = render(NotificationViewport);
    expect(body).toContain('notification-success');
    expect(body).toContain('notification-error');
    expect(body).toContain('操作成功');
    expect(body).toContain('操作失败');
    expect(body).toContain('保存成功');
    expect(body).toContain('请求失败');
  });

  it('keeps stacked order from old to new', () => {
    notifications.notifySuccess('第一条');
    notifications.notifySuccess('第二条');
    notifications.notifySuccess('第三条');

    const { body } = render(NotificationViewport);
    expect(body.indexOf('第一条')).toBeLessThan(body.indexOf('第二条'));
    expect(body.indexOf('第二条')).toBeLessThan(body.indexOf('第三条'));
  });
});
