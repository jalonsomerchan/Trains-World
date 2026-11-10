import { describe, expect, it } from 'vitest';
import { availableStops, distance, findTrack, trackCost } from './game';
import { estimateLineIncome } from './simulation';
import { demandRates } from './passengers';

const cities = {
  a: { id: 'a', latitude: 39.4765, longitude: -6.3722, population: 96068 },
  b: { id: 'b', latitude: 38.9161, longitude: -6.3437, population: 59548 },
};
describe('reglas ferroviarias', () => {
  it('calcula distancias y costes positivos', () => {
    expect(distance(cities.a, cities.b)).toBeGreaterThan(60);
    expect(distance(cities.a, cities.b)).toBeLessThan(65);
    expect(trackCost(cities.a, cities.b)).toBe(41000);
  });
  it('reconoce una vía en ambos sentidos', () => {
    const tracks = [{ a: 'a', b: 'b', level: 1 }];
    expect(findTrack(tracks, 'a', 'b')).toBe(tracks[0]);
    expect(findTrack(tracks, 'b', 'a')).toBe(tracks[0]);
    expect(findTrack(tracks, 'a', 'c')).toBeUndefined();
  });
  it('ofrece solo paradas sin visitar conectadas directamente con la última', () => {
    const tracks = [{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }, { a: 'd', b: 'a' }, { a: 'x', b: 'y' }];
    expect(availableStops(tracks, [])).toEqual(['a', 'b', 'c', 'd', 'x', 'y']);
    expect(availableStops(tracks, ['a'])).toEqual(['b', 'd']);
    expect(availableStops(tracks, ['a', 'b'])).toEqual(['c']);
    expect(availableStops(tracks, ['a', 'b', 'c'])).toEqual([]);
  });
  it('aumenta los ingresos con población y alta velocidad', () => {
    const route = { stops: ['a', 'b'] };
    const ordinary = estimateLineIncome(route, cities, [{ a: 'a', b: 'b', level: 1 }]);
    const fast = estimateLineIncome(route, cities, [{ a: 'a', b: 'b', level: 2 }]);
    expect(ordinary).toBeGreaterThan(0);
    expect(fast).toBeGreaterThan(ordinary);
    const tracks = [{ a: 'a', b: 'b', level: 1 }];
    expect(demandRates(route, { ...cities, b: { ...cities.b, population: 1000000 } }, tracks).a.b).toBeGreaterThan(demandRates(route, cities, tracks).a.b);
  });
});
