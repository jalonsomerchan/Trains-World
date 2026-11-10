import { describe, expect, it } from 'vitest';
import { advanceSimulation, arrivalIncome, estimateLineIncome } from './simulation';
import { trainPosition } from './trainPosition';
import { journeyStatsFor, statsFor } from './statistics';

const cities = {
  a: { id: 'a', name: 'A', latitude: 40, longitude: -4, population: 10000 },
  b: { id: 'b', name: 'B', latitude: 40, longitude: -3, population: 40000 },
  c: { id: 'c', name: 'C', latitude: 41, longitude: -3, population: 90000 },
};
const base = { money: 1000, day: 1, paused: false, tracks: [{ a: 'a', b: 'b', km: 100, level: 1 }], lines: [{ id: 'line-1', name: 'Uno', stops: ['a', 'b'] }] };

describe('simulación de trenes', () => {
  it('avanza en el tramo y paga al llegar, nunca antes', () => {
    const halfway = advanceSimulation(base, cities, 6.25);
    expect(halfway.money).toBe(1000);
    expect(halfway.lines[0].train.progress).toBeCloseTo(.5);
    const arrived = advanceSimulation(halfway, cities, 6.25);
    expect(arrived.money).toBe(1000 + arrived.arrivals[0].amount);
    expect(arrived.arrivals[0].cityId).toBe('b');
    expect(arrived.stats.lines['line-1'].income).toBe(arrived.arrivals[0].amount);
    expect(arrived.stats.tracks['a|b'].income).toBe(arrived.arrivals[0].amount);
    expect(arrived.stats.cities.b.income).toBe(arrived.arrivals[0].amount);
    expect(arrived.lines[0].train.stopIndex).toBe(1);
    const returned = advanceSimulation(arrived, cities, 12.5);
    expect(returned.money).toBe(arrived.money + returned.arrivals[0].amount);
    expect(returned.lines[0].train.stopIndex).toBe(0);
  });
  it('limita la vía básica a un tren aunque circulen en sentidos opuestos', () => {
    const game = { ...base, lines: [base.lines[0], { name: 'Dos', stops: ['b', 'a'] }] };
    const running = advanceSimulation(game, cities, 6.25);
    expect(running.lines.filter(line => line.train.moving)).toHaveLength(1);
    expect(running.lines[1].train.progress).toBe(0);
    const afterArrival = advanceSimulation(running, cities, 6.75);
    expect(afterArrival.lines[1].train.moving).toBe(true);
    expect(afterArrival.lines[0].train.moving).toBe(false);
  });
  it('permite cruces en vía rápida de alta ocupación de doble sentido' , () => {
    const game = { ...base, tracks: [{ ...base.tracks[0], type: 'fast_high_capacity_bidirectional' }], lines: [base.lines[0], { name: 'Dos', stops: ['b', 'a'] }] };
    const running = advanceSimulation(game, cities, 25 / 12);
    expect(running.lines.filter(line => line.train.moving)).toHaveLength(2);
    expect(running.lines[0].train.progress).toBeCloseTo(.5);
    const arrived = advanceSimulation(running, cities, 25 / 12);
    expect(arrived.arrivals).toHaveLength(2);
    expect(arrived.money).toBe(1000 + arrived.arrivals.reduce((sum, event) => sum + event.amount, 0));
  });
  it('no permite cruces en una vía sencilla de alta ocupación', () => {
    const game = { ...base, tracks: [{ ...base.tracks[0], type: 'high_capacity' }], lines: [base.lines[0], { name: 'Dos', stops: ['b', 'a'] }] };
    const result = advanceSimulation(game, cities, 1);
    expect(result.lines.filter(line => line.train.moving)).toHaveLength(1);
  });
  it('reserva plazas en destino y permite salir cuando queda una libre', () => {
    const waiting = { stopIndex: 0, direction: 1, progress: 0, moving: false };
    const game = { ...base, stations: { b: { capacity: 1 } }, tracks: [{ ...base.tracks[0], type: 'high_capacity_bidirectional' }], lines: [{ ...base.lines[0], trains: [waiting, { ...waiting }] }] };
    const result = advanceSimulation(game, cities, 1);
    expect(result.lines[0].trains.filter(train => train.moving)).toHaveLength(1);
    expect(result.lines[0].trains.filter(train => !train.moving)).toHaveLength(1);
    const raised = advanceSimulation({ ...result, stations: { b: { capacity: 2 } } }, cities, 1);
    expect(raised.lines[0].trains.filter(train => train.moving)).toHaveLength(2);
  });
  it('no inicia un viaje hacia una estación llena', () => {
    const game = { ...base, stations: { b: { capacity: 1 } }, lines: [base.lines[0], { name: 'Parado', stops: ['b'] }] };
    const result = advanceSimulation(game, cities, 1);
    expect(result.lines[0].train.moving).toBe(false);
  });
  it('ajusta las vías antiguas de alta velocidad a capacidad de un tren', () => {
    const moving = { stopIndex: 0, direction: 1, progress: .3, moving: true };
    const game = { ...base, tracks: [{ ...base.tracks[0], level: 2 }], lines: [{ ...base.lines[0], train: moving }, { name: 'Dos', stops: ['b', 'a'], train: moving }] };
    const result = advanceSimulation(game, cities, .2);
    expect(result.lines.filter(line => line.train.moving)).toHaveLength(1);
    expect(result.lines[1].train.progress).toBe(0);
  });
  it('no mueve ni abona nada en pausa y conserva trenes de partidas antiguas', () => {
    expect(advanceSimulation({ ...base, paused: true }, cities, 20).money).toBe(1000);
    const migrated = advanceSimulation(base, cities, 1);
    expect(migrated.lines[0].train.moving).toBe(true);
    expect(Number.isFinite(estimateLineIncome(base.lines[0], cities, base.tracks))).toBe(true);
  });
  it('simula varios trenes de una línea, respeta la capacidad y suma sus ingresos', () => {
    const train = { stopIndex: 0, direction: 1, progress: 0, moving: false, waitingSince: 0 };
    const line = { ...base.lines[0], trains: [train, { ...train }] };
    const shared = { ...base, lines: [line] };
    const queued = advanceSimulation(shared, cities, 6.25);
    expect(queued.lines[0].trains.filter(item => item.moving)).toHaveLength(1);
    expect(queued.lines[0].trains[1].progress).toBe(0);
    const dual = { ...shared, tracks: [{ ...base.tracks[0], type: 'high_capacity' }] };
    const arrived = advanceSimulation(dual, cities, 10);
    expect(arrived.arrivals).toHaveLength(2);
    expect(arrived.stats.lines['line-1'].income).toBe(arrived.arrivals.reduce((sum, event) => sum + event.amount, 0));
    expect(estimateLineIncome(line, cities, dual.tracks)).toBeGreaterThan(estimateLineIncome(base.lines[0], cities, dual.tracks));
  });
  it('ajusta el ingreso a viajeros, distancia y esperas', () => {
    const normal = arrivalIncome(100, 100, 40);
    expect(arrivalIncome(100, 200, 40)).toBe(2 * normal);
    expect(arrivalIncome(200, 100, 40)).toBe(2 * normal);
    expect(arrivalIncome(100, 100, 40, 2.5 / 24)).toBe(Math.round(normal / 2));
    expect(arrivalIncome(0, 100, 40)).toBe(0);
  });
  it('acumula esperas entre ciclos y penaliza solo el siguiente trayecto', () => {
    const game = { ...base, tracks: [{ ...base.tracks[0], type: 'basic_bidirectional' }], stations: { b: { capacity: 1 } }, lines: [base.lines[0], { name: 'Bloqueo', stops: ['b'] }] };
    const blocked = advanceSimulation(game, cities, 12.5);
    expect(blocked.lines[0].train.waitDays).toBeCloseTo(2.5 / 24);
    const resumed = advanceSimulation({ ...blocked, lines: [blocked.lines[0]] }, cities, 12.5);
    expect(resumed.arrivals[0].amount).toBe(arrivalIncome(resumed.stats.operations.lines['line-1'].passengers, 100, 40, 2.5 / 24));
    expect(resumed.lines[0].train.waitDays).toBe(0);
    const returned = advanceSimulation(resumed, cities, 12.5);
    expect(returned.arrivals[0].amount).toBeGreaterThan(0);
  });
  it('conserva la espera entre actualizaciones y no cuenta el tiempo en pausa', () => {
    const game = { ...base, stations: { b: { capacity: 1 } }, lines: [base.lines[0], { name: 'Bloqueo', stops: ['b'] }] };
    const once = advanceSimulation(game, cities, 10);
    const split = advanceSimulation(advanceSimulation(game, cities, 4), cities, 6);
    expect(split.lines[0].train.waitDays).toBeCloseTo(once.lines[0].train.waitDays);
    const paused = { ...split, paused: true };
    expect(advanceSimulation(paused, cities, 100).lines[0].train.waitDays).toBe(split.lines[0].train.waitDays);
  });
  it('registra una llegada en línea, tren y vía con sus tiempos y viajeros', () => {
    const game = { ...base, stations: { b: { capacity: 1 } }, lines: [base.lines[0], { name: 'Bloqueo', stops: ['b'] }] };
    const blocked = advanceSimulation(game, cities, 12.5);
    const completed = advanceSimulation({ ...blocked, lines: [blocked.lines[0]] }, cities, 12.5);
    const train = completed.lines[0].train;
    const lineStats = journeyStatsFor(completed.stats, 'lines', 'line-1');
    const trainStats = journeyStatsFor(completed.stats, 'trains', train.id);
    const trackStats = journeyStatsFor(completed.stats, 'tracks', 'a|b');
    expect(lineStats).toEqual(trainStats);
    expect(trackStats).toEqual(trainStats);
    expect(trainStats.trips).toBe(1);
    expect(trainStats.travelDays).toBeCloseTo(2.5 / 24);
    expect(trainStats.waitDays).toBeCloseTo(2.5 / 24);
    expect(trainStats.passengers).toBeGreaterThan(0);
    expect(trainStats.income).toBe(completed.arrivals[0].amount);
    expect(statsFor(completed.stats, 'trains', train.id).income).toBe(completed.arrivals[0].amount);
    const returned = advanceSimulation(completed, cities, 12.5);
    expect(journeyStatsFor(returned.stats, 'trains', train.id).trips).toBe(2);
    expect(journeyStatsFor(returned.stats, 'trains', train.id).trainIds).toEqual([train.id]);
  });
  it('no inventa tiempos para un viaje que ya estaba en marcha al activar las estadísticas', () => {
    const train = { id: 'old', stopIndex: 0, direction: 1, progress: .5, moving: true, passengers: { b: 10 } };
    const result = advanceSimulation({ ...base, lines: [{ ...base.lines[0], train }] }, cities, 6.25);
    expect(result.arrivals).toHaveLength(1);
    expect(journeyStatsFor(result.stats, 'trains', 'old').trips).toBe(0);
    expect(statsFor(result.stats, 'trains', 'old').income).toBeGreaterThan(0);
  });
  it('aplica km/h de juego con 120 segundos reales por día', () => {
    for (const [type, speed] of [['basic', 40], ['normal', 80], ['high_speed', 260], ['ultra_fast', 350]]) {
      const game = { ...base, tracks: [{ ...base.tracks[0], type }] };
      const realSeconds = 100 / speed / 24 * 120;
      expect(advanceSimulation(game, cities, realSeconds / 2).lines[0].train.progress).toBeCloseTo(.5);
      expect(advanceSimulation(game, cities, realSeconds).arrivals).toHaveLength(1);
    }
  });
  it('sitúa el tren sobre la misma vía curva y en sus extremos', () => {
    expect(trainPosition(cities.a, cities.b, 0)).toEqual([cities.a.longitude, cities.a.latitude]);
    expect(trainPosition(cities.a, cities.b, 1)[0]).toBeCloseTo(cities.b.longitude);
    expect(trainPosition(cities.a, cities.b, .5)).not.toEqual([-3.5, 40]);
  });
});
