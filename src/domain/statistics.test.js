import { describe, expect, it } from 'vitest';
import { recordStatistics, routeTrackKeys, statsFor, trackStatsKey } from './statistics';

describe('estadísticas financieras', () => {
  it('reparte gastos compartidos y conserva el total exacto', () => {
    const stats = recordStatistics(undefined, { kind: 'expenses', amount: 25001, lineId: 'line-1', cityIds: ['a', 'b', 'c'], trackKeys: routeTrackKeys(['a', 'b', 'c']) });
    expect(statsFor(stats, 'total').expenses).toBe(25001);
    expect(statsFor(stats, 'lines', 'line-1').expenses).toBe(25001);
    expect(Object.values(stats.cities).reduce((sum, value) => sum + value.expenses, 0)).toBe(25001);
    expect(Object.values(stats.tracks).reduce((sum, value) => sum + value.expenses, 0)).toBe(25001);
  });
  it('asigna ingresos de llegada a la línea, vía y ciudad de destino', () => {
    const key = trackStatsKey('a', 'b');
    let stats = recordStatistics(undefined, { kind: 'expenses', amount: 1000, cityIds: ['a', 'b'], trackKeys: [key] });
    stats = recordStatistics(stats, { kind: 'income', amount: 300, lineId: 'l', cityIds: ['b'], trackKeys: [trackStatsKey('b', 'a')] });
    expect(statsFor(stats, 'total')).toEqual({ income: 300, expenses: 1000 });
    expect(statsFor(stats, 'tracks', key)).toEqual({ income: 300, expenses: 1000 });
    expect(statsFor(stats, 'cities', 'b')).toEqual({ income: 300, expenses: 500 });
    expect(statsFor(stats, 'lines', 'l')).toEqual({ income: 300, expenses: 0 });
    expect(statsFor(undefined, 'cities', 'missing')).toEqual({ income: 0, expenses: 0 });
  });
});
