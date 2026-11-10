import { describe, expect, it } from 'vitest';
import { avoidMarkerCollisions, cityDiameter, minimumPopulation, visibleCities } from './mapDisplay';

describe('visualización del mapa', () => {
  it('reduce el umbral de población al acercar el mapa', () => {
    expect(minimumPopulation(4)).toBeGreaterThan(minimumPopulation(8));
    expect(minimumPopulation(8)).toBeGreaterThan(minimumPopulation(12));
  });
  it('mantiene visibles las ciudades conectadas aunque sean pequeñas', () => {
    const cities = { a: { id: 'a', population: 50 }, b: { id: 'b', population: 50 }, c: { id: 'c', population: 2000000 } };
    expect(visibleCities(cities, [{ a: 'a', b: 'c' }], 3, () => true).map(c => c.id)).toEqual(['a', 'c']);
    expect(visibleCities(cities, [{ a: 'a', b: 'c' }], 3, c => c.id !== 'a').map(c => c.id)).toEqual(['c']);
  });
  it('oculta solapamientos sin esconder ciudades con vías', () => {
    const cities = [{ id: 'large', name: 'Grande', population: 1000000 }, { id: 'small', name: 'Pequeña', population: 1000 }, { id: 'track', name: 'Vía', population: 500 }];
    const visible = avoidMarkerCollisions(cities, [{ a: 'track', b: 'large' }], () => ({ x: 100, y: 100 }));
    expect(visible.map(city => city.id)).toEqual(['large', 'track']);
  });
  it('asigna más área a ciudades con mayor población sin perder un tamaño utilizable', () => {
    expect(cityDiameter(500)).toBeGreaterThanOrEqual(12);
    expect(cityDiameter(100000)).toBeGreaterThan(cityDiameter(10000));
    expect(cityDiameter(3300000)).toBeGreaterThan(cityDiameter(100000));
  });
});
