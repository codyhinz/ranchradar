import { describe, expect, it } from 'vitest';
import { sectionFor } from './tabBar';

describe('sectionFor', () => {
  it('lights up Regulations on the regulation index and season pages', () => {
    expect(sectionFor('/regulations/')).toBe('regulations');
    expect(sectionFor('/regulations')).toBe('regulations');
    expect(sectionFor('/regulations/m-c/')).toBe('regulations');
  });
  it('lights up nothing on the other static pages', () => {
    for (const path of ['/about', '/privacy', '/terms', '/missing-page', '/regulationsx']) expect(sectionFor(path)).toBeNull();
  });
});
