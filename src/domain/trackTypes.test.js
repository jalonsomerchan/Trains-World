import { describe, expect, it } from 'vitest';
import { TRACK_TYPES, constructionCost, conversionCost, findTrackType, trackType, trainsOnTrack, trackFits, trackCanEnter } from './trackTypes';

describe('catálogo de vías', () => {
  it('incluye los siete tipos solicitados con velocidades y capacidades exactas', () => {
    for (const [id, speed, capacity] of [
      ['basic', 40, 1], ['normal', 80, 1], ['high_capacity', 50, 2],
      ['fast', 120, 1], ['very_fast', 180, 1], ['high_speed', 260, 1],
      ['fast_high_capacity', 120, 2],
    ]) expect(findTrackType(id)).toMatchObject({ speed, capacity });
    expect(new Set(TRACK_TYPES.map(type => type.id)).size).toBe(TRACK_TYPES.length);
    for (const type of TRACK_TYPES.filter(type => !type.bidirectional)) {
      expect(findTrackType(type.id + '_bidirectional')).toMatchObject({ bidirectional: true, speed: type.speed, capacity: type.capacity, color: type.color });
    }
  });
  it('construye desde el precio básico y suma el coste del tipo elegido', () => {
    const a = { latitude: 39.4765, longitude: -6.3722 };
    const b = { latitude: 38.9161, longitude: -6.3437 };
    expect(constructionCost(a, b, findTrackType('basic'))).toBe(41000);
    expect(constructionCost(a, b, findTrackType('normal'))).toBeGreaterThan(41000);
    expect(constructionCost(a, b, findTrackType('high_speed'))).toBeGreaterThan(constructionCost(a, b, findTrackType('normal')));
  });
  it('conserva el significado de vías de partidas anteriores', () => {
    expect(trackType({ level: 1 }).id).toBe('basic');
    expect(trackType({ level: 2 }).id).toBe('high_speed');
    expect(trackType({ type: 'normal', level: 2 }).id).toBe('normal');
  });
  it('comprueba la capacidad y el sentido al entrar o cambiar una vía', () => {
    const single = findTrackType('high_capacity');
    const dual = findTrackType('high_capacity_bidirectional');
    expect(trackCanEnter(single, { forward: 1, backward: 0 }, true)).toBe(true);
    expect(trackCanEnter(single, { forward: 1, backward: 0 }, false)).toBe(false);
    expect(trackCanEnter(dual, { forward: 2, backward: 0 }, false)).toBe(true);
    expect(trackCanEnter(dual, { forward: 2, backward: 0 }, true)).toBe(false);
    expect(trackFits(single, { forward: 1, backward: 1 })).toBe(false);
  });
  it('calcula el coste y detecta trenes en ambos sentidos', () => {
    const track = { a: 'a', b: 'b', km: 30, type: 'basic' };
    expect(conversionCost(track, findTrackType('normal'))).toBe(12000);
    expect(conversionCost(track, findTrackType('basic'))).toBe(0);
    const lines = [{ stops: ['a', 'b'], train: { stopIndex: 0, direction: 1, moving: true } }, { stops: ['b', 'a'], train: { stopIndex: 0, direction: 1, moving: true } }, { stops: ['a', 'b'], train: { moving: false } }];
    expect(trainsOnTrack(track, lines)).toBe(2);
    expect(trainsOnTrack(track, [{ stops: ['a', 'b'], trains: [lines[0].train, lines[0].train] }])).toBe(2);
  });
});
