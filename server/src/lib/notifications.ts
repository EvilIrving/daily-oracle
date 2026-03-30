import { writable } from 'svelte/store';

export type NotificationType = 'success' | 'error';

export type NotificationItem = {
  id: string;
  type: NotificationType;
  message: string;
  durationMs: number;
  createdAt: number;
};

const SUCCESS_DURATION_MS = 2000;
const ERROR_DURATION_MS = 3000;
const MAX_NOTIFICATIONS = 3;
const DEDUPE_WINDOW_MS = 1500;

export function createNotificationStore() {
  const { subscribe, update, set } = writable<NotificationItem[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let sequence = 0;

  const clearTimer = (id: string) => {
    const timer = timers.get(id);
    if (!timer) return;
    clearTimeout(timer);
    timers.delete(id);
  };

  const dismiss = (id: string) => {
    clearTimer(id);
    update((items) => items.filter((item) => item.id !== id));
  };

  const push = (type: NotificationType, message: string) => {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) return;

    const now = Date.now();
    const durationMs = type === 'success' ? SUCCESS_DURATION_MS : ERROR_DURATION_MS;

    update((items) => {
      const deduped = items.filter((item) => {
        const isDuplicate =
          item.type === type &&
          item.message === normalizedMessage &&
          now - item.createdAt <= DEDUPE_WINDOW_MS;
        if (isDuplicate) {
          clearTimer(item.id);
        }
        return !isDuplicate;
      });

      const item: NotificationItem = {
        id: `ntf-${now}-${sequence++}`,
        type,
        message: normalizedMessage,
        durationMs,
        createdAt: now
      };

      const queued = [...deduped, item];
      while (queued.length > MAX_NOTIFICATIONS) {
        const oldest = queued.shift();
        if (oldest) clearTimer(oldest.id);
      }

      timers.set(
        item.id,
        setTimeout(() => {
          dismiss(item.id);
        }, durationMs)
      );

      return queued;
    });
  };

  const notifySuccess = (message: string) => push('success', message);
  const notifyError = (message: string) => push('error', message);

  const clearAll = () => {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    set([]);
  };

  return {
    subscribe,
    dismiss,
    notifySuccess,
    notifyError,
    clearAll
  };
}

export const notifications = createNotificationStore();
export const notifySuccess = notifications.notifySuccess;
export const notifyError = notifications.notifyError;
