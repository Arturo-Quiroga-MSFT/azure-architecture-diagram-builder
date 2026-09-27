// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Non-blocking replacement for window.alert(). Callable from components and
// plain modules alike; <NotificationHost /> renders whatever is published here.

export type NotificationKind = 'success' | 'info' | 'warning' | 'error';

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  message: string;
}

type Listener = (notifications: AppNotification[]) => void;

const AUTO_DISMISS_MS: Record<NotificationKind, number | null> = {
  success: 6000,
  info: 6000,
  warning: 9000,
  // Errors stay until the user dismisses them so they are never missed.
  error: null,
};
const MAX_VISIBLE = 4;

let nextId = 1;
let current: AppNotification[] = [];
const listeners = new Set<Listener>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function publish() {
  for (const listener of listeners) listener(current);
}

export function dismissNotification(id: number): void {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  current = current.filter((item) => item.id !== id);
  publish();
}

/** Show a message without blocking the page. Returns its id. */
export function notify(message: string, kind: NotificationKind = 'info'): number {
  const id = nextId++;
  current = [...current, { id, kind, message }].slice(-MAX_VISIBLE);
  const delay = AUTO_DISMISS_MS[kind];
  if (delay !== null) timers.set(id, setTimeout(() => dismissNotification(id), delay));
  publish();
  return id;
}

export function subscribeNotifications(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => { listeners.delete(listener); };
}
