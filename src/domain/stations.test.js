import { describe, expect, it } from 'vitest';
import { lineTrainLimit, stationCapacity, stationUsage } from './stations';
import { initialTrain, resizeLineTrains } from './trains';

describe('capacidad de estaciones y líneas', () => {
  it('usa dos plazas por defecto y respeta las capacidades configuradas', () => {
    const game = { stations: { a: { capacity: 5 }, b: { capacity: 3 } } };
    expect(stationCapacity(game, 'c')).toBe(2);
    expect(lineTrainLimit(game, ['a', 'b'])).toBe(3);
    expect(lineTrainLimit(game, ['a', 'b', 'c'])).toBe(2);
    expect(lineTrainLimit({ stations: { a: { capacity: 20 } } }, ['a'])).toBe(20);
  });
  it('separa trenes presentes y plazas reservadas en la estación', () => {
    const line = { stops: ['a', 'b'], trains: [initialTrain(), { ...initialTrain(), moving: true }] };
    expect(stationUsage([line], 'a')).toEqual({ present: 1, incoming: 0, total: 1 });
    expect(stationUsage([line], 'b')).toEqual({ present: 0, incoming: 1, total: 1 });
  });
  it('conserva identidades al reducir y no las reutiliza al añadir trenes', () => {
    const line = resizeLineTrains({ stops: ['a', 'b'] }, 2);
    const ids = line.trains.map(train => train.id);
    expect(new Set(ids).size).toBe(2);
    const reduced = resizeLineTrains(line, 1);
    const expanded = resizeLineTrains(reduced, 2);
    expect(expanded.trains[0].id).toBe(ids[0]);
    expect(expanded.trains[1].id).not.toBe(ids[1]);
  });
  it('permite ajustar una flota por encima del antiguo límite de diez', () => {
    const line = resizeLineTrains({ stops: ['a', 'b'] }, 15);
    expect(line.trains).toHaveLength(15);
    expect(resizeLineTrains(line, 2).trains).toHaveLength(2);
  });
});
