import { expiresAfter, newDraft, splitTimeLeft } from './EntryFields';

describe('trial time left', () => {
  const now = new Date('2026-10-24T12:00:00Z');

  it('splits time left into days and hours, rounding up like the game', () => {
    expect(splitTimeLeft('2026-10-27T17:20:00Z', now)).toEqual({ days: 3, hours: 6 });
    expect(splitTimeLeft('2026-10-24T11:00:00Z', now)).toEqual({ days: 0, hours: 0 });
    expect(splitTimeLeft(null, now)).toEqual({ days: 7, hours: 0 });
  });

  it('turns days and hours back into an expiry time', () => {
    expect(expiresAfter(2, 5, now)).toBe('2026-10-26T17:00:00.000Z');
    expect(expiresAfter(0, 0, now)).toBe(now.toISOString());
  });

  it('starts a new trial at the full seven days, untouched', () => {
    expect(newDraft('trial')).toMatchObject({ trialDays: 7, trialHours: 0, trialTouched: false });
  });
});
