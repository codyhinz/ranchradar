import { adsTxt, checkAdSettings, isAdClient, isAdSlot } from './adsense';

describe('AdSense settings', () => {
  it('accepts real-looking ids only', () => {
    expect(isAdClient('ca-pub-1234567890123456')).toBe(true);
    expect(isAdClient('pub-1234567890123456')).toBe(false);
    expect(isAdClient('ca-pub-12"><script>')).toBe(false);
    expect(isAdSlot('1234567890')).toBe(true);
    expect(isAdSlot('abc')).toBe(false);
  });
  it('fails the build on a typo instead of quietly showing nothing', () => {
    expect(() => checkAdSettings('ca-pub-123', undefined)).toThrow();
    expect(() => checkAdSettings(undefined, '1234567890')).toThrow();
    expect(checkAdSettings('', '')).toEqual({});
  });
  it('writes ads.txt with the publisher id', () => {
    expect(adsTxt('ca-pub-1234567890123456')).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
  });
});
