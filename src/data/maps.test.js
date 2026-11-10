import { describe, expect, it } from 'vitest';
import { getMap, maps } from './maps';

describe('catálogo de mapas', () => {
  it('carga ciudades y posición inicial de la península ibérica', () => {
    const map = getMap('iberican');
    expect(map.name).toBe('Península Ibérica');
    expect([map.longitude, map.latitude, map.zoom]).toEqual([-3.725, 40.4637, 5]);
    expect(map.cities).toHaveLength(200);
    expect(map.cities[0]).toMatchObject({ id: '1', name: 'Madrid', population: 3506900 });
  });
  it('contiene identificadores únicos y coordenadas válidas por mapa', () => {
    for (const map of maps) {
      expect(new Set(map.cities.map(city => city.id)).size).toBe(map.cities.length);
      for (const city of map.cities) {
        expect(Number.isFinite(city.latitude) && Number.isFinite(city.longitude)).toBe(true);
      }
    }
  });
});
