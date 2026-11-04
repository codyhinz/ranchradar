import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyUpdate } from './swUpdate';

class FakeWorker extends EventTarget {
  state: ServiceWorkerState = 'installed';
  messages: unknown[] = [];
  postMessage(message: unknown) { this.messages.push(message); }
  become(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

const asRegistration = (waiting: FakeWorker | null) =>
  ({ waiting: waiting as unknown as ServiceWorker | null });

describe('applyUpdate', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('reloads straight away when nothing is waiting (another tab already activated it)', async () => {
    const reload = vi.fn();
    await applyUpdate(asRegistration(null), { reload });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads with no registration at all', async () => {
    const reload = vi.fn();
    await applyUpdate(undefined, { reload });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('asks the waiting worker to skip waiting and reloads once it activates', async () => {
    const worker = new FakeWorker();
    const reload = vi.fn();
    const done = applyUpdate(asRegistration(worker), { reload });
    expect(worker.messages).toEqual([{ type: 'SKIP_WAITING' }]);
    expect(reload).not.toHaveBeenCalled();
    worker.become('activating');
    expect(reload).not.toHaveBeenCalled();
    worker.become('activated');
    await done;
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads when a newer build makes the waiting one redundant', async () => {
    const worker = new FakeWorker();
    const reload = vi.fn();
    const done = applyUpdate(asRegistration(worker), { reload });
    worker.become('redundant');
    await done;
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads on a takeover in this tab, only once', async () => {
    const worker = new FakeWorker();
    const container = new EventTarget();
    const reload = vi.fn();
    const done = applyUpdate(asRegistration(worker), { reload, container });
    container.dispatchEvent(new Event('controllerchange'));
    worker.become('activated');
    vi.runAllTimers();
    await done;
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads anyway after the timeout if the worker never moves', async () => {
    const worker = new FakeWorker();
    const reload = vi.fn();
    const done = applyUpdate(asRegistration(worker), { reload, timeoutMs: 1000 });
    vi.advanceTimersByTime(999);
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await done;
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
