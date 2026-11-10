import { distance, findTrack } from './game';
import { trackCanEnter, trackType } from './trackTypes';
import { stationCapacity } from './stations';
import { recordJourneyStatistics, recordStatistics, trackStatsKey } from './statistics';
import { initialTrain, lineTrains, trainMaintenance, trainSpeed } from './trains';
import { trainType } from './trainTypes';
import { advanceQueues, boardPassengers, networkDemandRates, lineHeadwayDays, trainPassengerCount } from './passengers';
export { initialTrain } from './trains';

export const SECONDS_PER_DAY = 120;
const HOURS_PER_DAY = 24;
const EPSILON = 1e-9;

// Fare is paid on arrival for the passengers actually carried on the segment.
export function arrivalIncome(passengers, km, speed, waitDays = 0) {
  const length = Math.max(0, Number(km) || 0);
  const travelHours = length / Math.max(.1, speed);
  const waitingHours = Math.max(0, Number(waitDays) || 0) * HOURS_PER_DAY;
  return travelHours > 0 ? Math.round(Math.max(0, passengers) * length * .07 * travelHours / (travelHours + waitingHours)) : 0;
}
export function estimateLineIncome(line, cities, tracks, networkLines = [line], networkRates) {
  if (!line?.stops || line.stops.length < 2) return 0;
  const index = networkLines.indexOf(line);
  const rates = index >= 0 && networkRates ? networkRates[index] : networkDemandRates(index >= 0 ? networkLines : [...networkLines, line], cities, tracks)[index >= 0 ? index : networkLines.length];
  const stops = line.stops.map(String);
  const headway = lineHeadwayDays(line, cities, tracks);
  if (!Number.isFinite(headway) || !headway) return 0;
  let revenue = 0;
  for (let i = 0; i < stops.length; i++) {
    for (const direction of [-1, 1]) {
      const targets = stops.map((id, index) => ({ id, index })).filter(target => (target.index - i) * direction > 0);
      const rate = targets.reduce((sum, target) => sum + (rates[stops[i]]?.[target.id] || 0), 0);
      const factor = rate ? Math.min(1, trainType(line).viajeros / headway / rate) : 0;
      for (const target of targets) {
        let km = 0;
        for (let j = Math.min(i, target.index); j < Math.max(i, target.index); j++) {
          const track = findTrack(tracks, stops[j], stops[j + 1]);
          if (!track || track.construction || !cities[stops[j]] || !cities[stops[j + 1]]) return 0;
          km += Math.max(.1, Number(track.km) || distance(cities[stops[j]], cities[stops[j + 1]]));
        }
        revenue += (rates[stops[i]]?.[target.id] || 0) * factor * km * .07;
      }
    }
  }
  return Math.round(revenue);
}
function trackKey(a, b) {
  return [String(a), String(b)].sort().join('|');
}
function validTrain(line) {
  const train = line.train;
  if (!train || !Number.isInteger(train.stopIndex) || train.stopIndex < 0 || train.stopIndex >= line.stops.length ||
      ![1, -1].includes(train.direction) || !Number.isFinite(train.progress) || train.progress < 0 || train.progress >= 1 ||
      (train.moving && (train.stopIndex + train.direction < 0 || train.stopIndex + train.direction >= line.stops.length))) return initialTrain();
  return { ...initialTrain(), ...train, passengers: { ...train.passengers } };
}
function nextStop(train, count) {
  if (train.stopIndex === 0) train.direction = 1;
  else if (train.stopIndex === count - 1) train.direction = -1;
  return train.stopIndex + train.direction;
}

// Event-driven advancement prevents two trains from entering a capacity-one
// segment even when a tick contains departures and arrivals in both directions.
export function advanceSimulation(game, cities, elapsedSeconds) {
  if (game.paused || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return game;
  const tracks = game.tracks.map(track => track.construction ? { ...track, construction: { ...track.construction } } : track);
  // Run the same capacity and arrival logic for every train, including legacy saves.
  const lines = game.lines.flatMap((line, lineIndex) => lineTrains(line).map((train, trainIndex) => ({
    ...line, lineIndex, trainIndex, train: validTrain({ ...line, train }),
  })));
  const networkRates = networkDemandRates(game.lines, cities, tracks);
  const passengerLines = game.lines.map((line, index) => {
    const stops = new Set(line.stops.map(String));
    const queues = Object.fromEntries(Object.entries(line.passengerQueues || {}).filter(([from]) => stops.has(from)).map(([from, targets]) => [from, Object.fromEntries(Object.entries(targets).filter(([to]) => stops.has(to) && to !== from))]));
    return { queues, rates: networkRates[index] };
  });
  let time = Number.isFinite(game.simTime) ? game.simTime : Math.max(0, (game.day || 1) - 1);
  // Normalize invalid or over-occupied track states before advancing.
  const currentOccupancy = new Map();
  for (const line of lines) {
    const train = line.train;
    if (!train.moving) continue;
    const a = line.stops[train.stopIndex], b = line.stops[train.stopIndex + train.direction];
    const track = findTrack(tracks, a, b);
    const key = trackKey(a, b), counts = currentOccupancy.get(key) || { forward: 0, backward: 0 };
    const forward = track && String(a) === String(track.a);
    if (!track || track.construction || !trackCanEnter(trackType(track), counts, forward)) {
      train.moving = false; train.progress = 0; train.waitingSince = time;
    } else {
      counts[forward ? 'forward' : 'backward']++;
      currentOccupancy.set(key, counts);
    }
  }
  let remaining = elapsedSeconds / SECONDS_PER_DAY;
  let money = game.money, sequence = game.arrivalSequence || 0, stats = game.stats;
  const arrivals = [];
  let iterations = 0;
  while (remaining > EPSILON && iterations++ < 10000) {
    const occupancy = new Map();
    const reserved = new Map();
    for (const line of lines) {
      const t = line.train;
      const cityId = String(line.stops[t.stopIndex + (t.moving ? t.direction : 0)]);
      reserved.set(cityId, (reserved.get(cityId) || 0) + 1);
      if (t.moving) {
        const a = line.stops[t.stopIndex], b = line.stops[t.stopIndex + t.direction];
        const track = findTrack(tracks, a, b), key = trackKey(a, b);
        if (!track) continue;
        const counts = occupancy.get(key) || { forward: 0, backward: 0 };
        counts[String(a) === String(track.a) ? 'forward' : 'backward']++;
        occupancy.set(key, counts);
      }
    }
    const waiting = lines.map((line, index) => ({ line, index })).filter(({ line }) => !line.train.moving && !line.train.paused && line.stops.length >= 2)
      .sort((a, b) => (a.line.train.waitingSince ?? 0) - (b.line.train.waitingSince ?? 0) || a.index - b.index);
    for (const { line } of waiting) {
      const t = line.train, next = nextStop(t, line.stops.length);
      const track = findTrack(tracks, line.stops[t.stopIndex], line.stops[next]);
      const from = cities[String(line.stops[t.stopIndex])], to = cities[String(line.stops[next])];
      if (!track || !from || !to) continue;
      const key = trackKey(from.id, to.id), counts = occupancy.get(key) || { forward: 0, backward: 0 };
      const forward = String(from.id) === String(track.a);
      if (!track.construction && trackCanEnter(trackType(track), counts, forward) && (reserved.get(String(to.id)) || 0) < stationCapacity(game, to.id)) {
        boardPassengers(line, t, passengerLines[line.lineIndex].queues);
        t.moving = true;
        t.tripStatsReady = true;
        t.travelDays = 0;
        counts[forward ? 'forward' : 'backward']++;
        occupancy.set(key, counts);
        reserved.set(String(from.id), (reserved.get(String(from.id)) || 0) - 1);
        reserved.set(String(to.id), (reserved.get(String(to.id)) || 0) + 1);
      }
    }
    let step = remaining;
    for (const line of lines) {
      const t = line.train;
      if (!t.moving) continue;
      const from = cities[String(line.stops[t.stopIndex])], to = cities[String(line.stops[t.stopIndex + t.direction])];
      const track = findTrack(tracks, line.stops[t.stopIndex], line.stops[t.stopIndex + t.direction]);
      if (!track || !from || !to) { t.moving = false; t.progress = 0; continue; }
      const km = Math.max(.1, Number(track.km) || distance(from, to));
      if (t.paused) continue;
      step = Math.min(step, (1 - t.progress) * km / (Math.min(trackType(track).speed, trainSpeed(line, t, game.day)) * HOURS_PER_DAY));
    }
    if (step < EPSILON) step = Math.min(remaining, EPSILON);
    for (const line of lines) {
      if (!line.train.moving && !line.train.paused && line.stops.length >= 2) line.train.waitDays = Math.max(0, Number(line.train.waitDays) || 0) + step;
    }
    passengerLines.forEach((entry, index) => advanceQueues(entry.queues, entry.rates, game.lines[index].id || index, time, time + step));
    time += step;
    remaining -= step;
    for (const track of tracks) {
      if (!track.construction) continue;
      track.construction.remainingDays -= step;
      if (track.construction.remainingDays <= EPSILON) {
        if (track.construction.targetType) track.type = track.construction.targetType;
        delete track.construction;
      }
    }
    for (const line of lines) {
      const t = line.train;
      const expenseProgress = Math.max(0, Number(t.expenseRemainder) || 0) + step * trainMaintenance(line, t, game.day);
      const expense = Math.floor(expenseProgress + EPSILON);
      t.expenseRemainder = expenseProgress - expense;
      if (expense > 0) {
        const routeKeys = line.stops.slice(1).map((id, index) => trackStatsKey(line.stops[index], id));
        stats = recordStatistics(stats, { kind: 'expenses', amount: expense, lineId: line.id, trainId: t.id, trackKeys: routeKeys });
        money -= expense;
      }
      if (!t.moving) continue;
      if (t.paused) continue;
      const from = cities[String(line.stops[t.stopIndex])], to = cities[String(line.stops[t.stopIndex + t.direction])];
      const track = findTrack(tracks, line.stops[t.stopIndex], line.stops[t.stopIndex + t.direction]);
      if (!track || !from || !to) continue;
      if (t.tripStatsReady) t.travelDays = (Number(t.travelDays) || 0) + step;
      const speed = Math.min(trackType(track).speed, trainSpeed(line, t, game.day));
      t.progress += step * speed * HOURS_PER_DAY / Math.max(.1, Number(track.km) || distance(from, to));
      if (t.progress >= 1 - EPSILON) {
        const km = Math.max(.1, Number(track.km) || distance(from, to));
        const passengers = trainPassengerCount(t);
        const amount = arrivalIncome(passengers, km, speed, t.waitDays);
        const waitDays = Math.max(0, Number(t.waitDays) || 0);
        if (t.tripStatsReady) {
        stats = recordJourneyStatistics(stats, { lineId: line.id, trainId: t.id, trackKey: trackStatsKey(from.id, to.id), income: amount, travelDays: t.travelDays, waitDays, passengers, capacity: trainType(line).viajeros });
        }
        if (t.passengers) delete t.passengers[String(to.id)];
        t.tripStatsReady = false;
        t.travelDays = 0;
        t.waitDays = 0;
        t.stopIndex += t.direction;
        t.progress = 0;
        t.moving = false;
        t.waitingSince = time;
        money += amount;
        stats = recordStatistics(stats, { kind: 'income', amount, lineId: line.id, trainId: t.id, cityIds: [to.id], trackKeys: [trackStatsKey(from.id, to.id)] });
        arrivals.push({ id: ++sequence, cityId: String(to.id), cityName: to.name, lineName: line.name, amount });
      }
    }
  }
  const updatedLines = game.lines.map((line, lineIndex) => {
    const trains = lines.filter(item => item.lineIndex === lineIndex).map(item => item.train);
    return { ...line, trains, train: trains[0], passengerQueues: passengerLines[lineIndex].queues };
  });
  return { ...game, tracks, lines: updatedLines, money, stats, simTime: time, day: 1 + Math.floor(time + EPSILON), arrivalSequence: sequence, arrivals };
}
