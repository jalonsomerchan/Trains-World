import { describe, expect, it } from 'vitest';
import { advanceQueues, boardPassengers, crowdingLevel, demandRates, networkDemandRates, stationWaitingPassengers, waitingPassengers, trainOccupancy, trainPassengerCount } from './passengers';
import { advanceSimulation } from './simulation';

const cities = {
  a: { id: 'a', name: 'A', latitude: 40, longitude: -4, population: 10000 },
  b: { id: 'b', name: 'B', latitude: 40, longitude: -3, population: 40000 },
  c: { id: 'c', name: 'C', latitude: 40, longitude: -2, population: 90000 },
};
const tracks = [{ a: 'a', b: 'b', km: 100, type: 'basic' }, { a: 'b', b: 'c', km: 100, type: 'basic' }];
const train = { id: 't', stopIndex: 0, direction: 1, progress: 0, moving: false };
const line = { id: 'l', name: 'Línea', stops: ['a', 'b', 'c'], trains: [train] };

describe('demanda de viajeros', () => {
  it('depende de la frecuencia y de las poblaciones de origen y destino', () => {
    const rates = demandRates(line, cities, tracks);
    expect(demandRates({ ...line, trains: [train, { ...train, id: 't2' }] }, cities, tracks).a.b).toBeGreaterThan(rates.a.b);
    expect(demandRates(line, { ...cities, a: { ...cities.a, population: 40000 } }, tracks).a.b).toBeGreaterThan(rates.a.b);
    expect(demandRates(line, { ...cities, b: { ...cities.b, population: 160000 } }, tracks).a.b).toBeGreaterThan(rates.a.b);
    expect(rates.a.c).toBeGreaterThan(0);
  });
  it('reparte la demanda entre líneas que ofrecen el mismo trayecto', () => {
    const competitor = { ...line, id: 'otra', trains: [{ ...train, id: 't2' }] };
    const alone = networkDemandRates([line], cities, tracks)[0];
    const [first, second] = networkDemandRates([line, competitor], cities, tracks);
    expect(first.a.b + second.a.b).toBeCloseTo(alone.a.b);
    expect(first.a.b).toBeCloseTo(second.a.b);
    const faster = { ...competitor, trains: [train, { ...train, id: 't2' }] };
    const [slowerRates, fasterRates] = networkDemandRates([line, faster], cities, tracks);
    expect(fasterRates.a.b).toBeGreaterThan(slowerRates.a.b);
    expect(fasterRates.a.b + slowerRates.a.b).toBeCloseTo(demandRates(faster, cities, tracks).a.b);
  });
  it('mantiene la demanda diaria en niveles moderados en trayectos representativos', () => {
    const pairs = [
      [{ id: 'a', latitude: 39.4765, longitude: -6.3722, population: 96068 }, { id: 'b', latitude: 38.9161, longitude: -6.3437, population: 59548 }, 62, 200, 350],
      [{ id: 'a', latitude: 40, longitude: -4, population: 10000 }, { id: 'b', latitude: 40, longitude: -3, population: 40000 }, 85, 50, 120],
    ];
    for (const [a, b, km, min, max] of pairs) {
      const rate = demandRates({ stops: ['a', 'b'] }, { a, b }, [{ a: 'a', b: 'b', km, type: 'normal' }]).a.b;
      expect(rate).toBeGreaterThan(min);
      expect(rate).toBeLessThan(max);
    }
  });
  it('produce la misma demanda con pasos cortos, incluso al cambiar de día', () => {
    const rates = demandRates(line, cities, tracks), one = {}, many = {};
    advanceQueues(one, rates, 'l', .75, 1.25);
    advanceQueues(many, rates, 'l', .75, 1);
    advanceQueues(many, rates, 'l', 1, 1.25);
    expect(one.a.b).toBeCloseTo(many.a.b, 8);
    expect(one.a.c).toBeCloseTo(many.a.c, 8);
  });
  it('reduce progresivamente una cola cuando no llegan viajeros nuevos', () => {
    const queues = { a: { b: 100 } };
    advanceQueues(queues, { a: { b: 0 } }, 'l', 0, .25);
    expect(queues.a.b).toBeCloseTo(100 / Math.E);
    advanceQueues(queues, { a: { b: 0 } }, 'l', .25, 1);
    expect(queues.a.b).toBeLessThan(2);
  });
  it('mantiene acotada la cola con demanda continua y sin trenes', () => {
    const queues = {};
    advanceQueues(queues, { a: { b: 1000 } }, 'l', 0, 100);
    expect(queues.a.b).toBeGreaterThan(0);
    expect(queues.a.b).toBeLessThan(1000 * 1.15 / 4 + 1);
  });
  it('agrega viajeros por estación y clasifica los niveles de afluencia', () => {
    const lines = [{ ...line, passengerQueues: { a: { b: 15, c: 10 } } }, { ...line, passengerQueues: { a: { b: 75 } } }];
    expect(stationWaitingPassengers(lines, 'a')).toBe(100);
    expect([0, 1, 24, 25, 99, 100].map(n => crowdingLevel(n).id)).toEqual(['none', 'low', 'low', 'medium', 'medium', 'high']);
    expect(stationWaitingPassengers(lines, 'b')).toBe(0);
  });
  it('embarque respeta sentido, capacidad, destinos y conservación de viajeros', () => {
    const queues = { b: { a: 40, c: 250 } }, moving = { stopIndex: 1, direction: 1, passengers: {} };
    expect(boardPassengers(line, moving, queues)).toBe(200);
    expect(moving.passengers).toEqual({ c: 200 });
    expect(queues.b).toEqual({ a: 40, c: 50 });
    expect(waitingPassengers({ ...line, passengerQueues: queues }, 'b')).toBe(90);
  });
  it('cuenta los viajeros que siguen a bordo y limita el embarque a las plazas libres', () => {
    const queues = { b: { a: 50, c: 200 } };
    const moving = { stopIndex: 1, direction: 1, passengers: { c: 170 } };
    expect(trainPassengerCount(moving)).toBe(170);
    expect(trainOccupancy(moving)).toBe(85);
    expect(boardPassengers(line, moving, queues)).toBe(30);
    expect(trainPassengerCount(moving)).toBe(200);
    expect(trainOccupancy(moving)).toBe(100);
    expect(queues.b.c).toBe(170);
    expect(queues.b.a).toBe(50);
    expect(boardPassengers(line, moving, queues)).toBe(0);
  });
  it('mantiene a bordo viajeros hacia paradas posteriores y paga solo por los transportados', () => {
    const originalTrain = { ...train, passengers: {} };
    const game = { paused: false, day: 1, money: 0, tracks, lines: [{ ...line, trains: [originalTrain], passengerQueues: { a: { b: 20, c: 30 } } }] };
    const first = advanceSimulation(game, cities, 12.5);
    expect(first.lines[0].train.passengers).toEqual({ c: 30 });
    expect(originalTrain.passengers).toEqual({});
    expect(first.arrivals[0].amount).toBe(350);
    expect(first.stats.operations.lines.l.passengers).toBe(50);
    expect(first.stats.operations.lines.l.occupancySum).toBe(.25);
    expect(first.stats.operations.lines.l.occupancySamples).toBe(1);
    expect(trainOccupancy(first.lines[0].train)).toBe(15);
    const second = advanceSimulation(first, cities, 17.5);
    expect(second.lines[0].train.passengers.c).toBeUndefined();
    expect(second.stats.operations.lines.l.passengers).toBeGreaterThanOrEqual(80);
    expect(second.stats.total.income).toBeGreaterThan(first.stats.total.income);
  });
  it('conserva ingresos, pasajeros y colas al dividir el mismo avance en ciclos', () => {
    const game = { paused: false, day: 1, money: 0, tracks, lines: [line] };
    const once = advanceSimulation(game, cities, 50);
    let split = game;
    for (let i = 0; i < 100; i++) split = advanceSimulation(split, cities, .5);
    expect(split.money).toBe(once.money);
    expect(split.stats.operations.lines.l.passengers).toBe(once.stats.operations.lines.l.passengers);
    for (const origin of line.stops) for (const [destination, count] of Object.entries(once.lines[0].passengerQueues[origin])) {
      expect(split.lines[0].passengerQueues[origin][destination]).toBeCloseTo(count, 7);
    }
  });
  it('mantiene colas independientes entre líneas y en pausa', () => {
    const game = { paused: false, day: 1, money: 0, tracks, lines: [line, { ...line, id: 'otra', trains: [{ ...train, id: 't2' }] }] };
    const result = advanceSimulation(game, cities, 2);
    expect(result.lines[0].passengerQueues).not.toBe(result.lines[1].passengerQueues);
    expect(result.lines[0].passengerQueues.b.a).toBeGreaterThan(0);
    expect(advanceSimulation({ ...result, paused: true }, cities, 30).lines[0].passengerQueues).toEqual(result.lines[0].passengerQueues);
  });
});
