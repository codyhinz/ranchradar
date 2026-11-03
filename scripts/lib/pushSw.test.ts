import { readFileSync } from 'node:fs';

/** Runs public/push-sw.js against a fake service worker scope. */
function loadWorker(windows: Array<{ url: string; focus: () => Promise<void> }> = []) {
  const listeners: Record<string, (event: any) => void> = {};
  const shown: Array<{ title: string; options: any }> = [];
  const opened: string[] = [];
  const self = {
    location: { origin: 'https://ranchradar.dev' },
    addEventListener: (type: string, fn: (event: any) => void) => { listeners[type] = fn; },
    registration: { showNotification: async (title: string, options: any) => { shown.push({ title, options }); } },
    clients: { matchAll: async () => windows, openWindow: async (url: string) => { opened.push(url); } },
  };
  new Function('self', readFileSync('public/push-sw.js', 'utf8'))(self);
  const fire = async (type: string, event: any) => {
    let pending: Promise<unknown> = Promise.resolve();
    listeners[type]!({ ...event, waitUntil: (p: Promise<unknown>) => { pending = p; } });
    await pending;
  };
  return { fire, shown, opened };
}

describe('push service worker', () => {
  it('shows the notification from the payload', async () => {
    const sw = loadWorker();
    await sw.fire('push', { data: { json: () => ({ title: 'Ranch refreshed', body: 'Go check', tag: 'ranch-refresh', url: '/' }) } });
    expect(sw.shown[0]!.title).toBe('Ranch refreshed');
    expect(sw.shown[0]!.options).toMatchObject({ body: 'Go check', tag: 'ranch-refresh', data: { url: '/' } });
  });
  it('still shows something for an unreadable payload', async () => {
    const sw = loadWorker();
    await sw.fire('push', { data: { json: () => { throw new Error('bad'); } } });
    expect(sw.shown[0]!.title).toBe('RanchRadar');
  });
  it('focuses an open window, or opens the app, and never another site', async () => {
    let focused = 0;
    const withWindow = loadWorker([{ url: 'https://ranchradar.dev/#roster', focus: async () => { focused++; } }]);
    await withWindow.fire('notificationclick', { notification: { close() {}, data: { url: '/' } } });
    expect(focused).toBe(1);
    const closed = loadWorker();
    await closed.fire('notificationclick', { notification: { close() {}, data: { url: 'https://evil.example/' } } });
    expect(closed.opened).toEqual(['https://ranchradar.dev/']);
  });
});
