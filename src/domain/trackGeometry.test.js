import { describe, expect, it } from 'vitest';
import { trackGeometry } from './trackGeometry';

const madrid = { longitude: -3.7026, latitude: 40.4165 };
const alcala = { longitude: -3.3641, latitude: 40.4821 };

describe('trazado visual de las vías', () => {
  it('conserva los extremos y el trazado al invertir el sentido', () => {
    const forward = trackGeometry(madrid, alcala);
    const backward = trackGeometry(alcala, madrid);
    expect(forward.type).toBe('LineString');
    expect(forward.coordinates[0]).toEqual([madrid.longitude, madrid.latitude]);
    expect(forward.coordinates.at(-1)).toEqual([alcala.longitude, alcala.latitude]);
    expect(forward.coordinates.length).toBeGreaterThan(10);
    expect(backward.coordinates).toEqual([...forward.coordinates].reverse());
    const middle = forward.coordinates[Math.floor(forward.coordinates.length / 2)];
    expect(Math.abs(middle[1] - (madrid.latitude + alcala.latitude) / 2)).toBeLessThan(.001);
    expect(middle[0]).toBeGreaterThan(madrid.longitude);
    expect(middle[0]).toBeLessThan(alcala.longitude);
  });
  it('no dibuja un tramo a través de todo el mapa al cruzar el antimeridiano', () => {
    const geometry = trackGeometry({ longitude: 179, latitude: 35 }, { longitude: -179, latitude: 36 });
    expect(geometry.type).toBe('MultiLineString');
    for (const line of geometry.coordinates) {
      for (let i = 1; i < line.length; i++) expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThan(180);
    }
  });
  it('sigue el recorrido más corto en trayectos largos sin depender del sentido', () => {
    const west = { longitude: -80, latitude: 40 };
    const east = { longitude: 0, latitude: 40 };
    const forward = trackGeometry(west, east).coordinates;
    expect(forward[Math.floor(forward.length / 2)][1]).toBeGreaterThan(40);
    expect(trackGeometry(east, west).coordinates).toEqual([...forward].reverse());
  });
  it('invierte también los tramos que cruzan el antimeridiano', () => {
    const a = { longitude: 179, latitude: 35 }, b = { longitude: -179, latitude: 36 };
    const forward = trackGeometry(a, b).coordinates;
    expect(trackGeometry(b, a).coordinates).toEqual([...forward].reverse().map(segment => [...segment].reverse()));
  });
  it('tolera estaciones con coordenadas idénticas', () => {
    expect(trackGeometry(madrid, madrid).coordinates).toEqual([[-3.7026, 40.4165], [-3.7026, 40.4165]]);
  });
});
