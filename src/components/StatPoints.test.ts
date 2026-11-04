import { setUiLocale } from '../i18n';
import { spreadSummary } from './StatPoints';

describe('spread summary', () => {
  afterEach(() => setUiLocale('en'));
  const spread = { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 };

  it('lists the stats with points, in stat order', () => {
    expect(spreadSummary(spread)).toBe('2 HP / 32 Atk / 32 Spe');
    expect(spreadSummary(null)).toBe('');
  });

  it('follows each language’s order and stat names', () => {
    setUiLocale('ja');
    expect(spreadSummary(spread)).toBe('HP2 / 攻撃32 / 素早32');
    setUiLocale('fr');
    expect(spreadSummary(spread)).toBe('2 PV / 32 Atq / 32 Vit');
  });
});
