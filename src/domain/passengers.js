import { distance, findTrack } from './game';
import { trackType } from './trackTypes';
import { lineTrains } from './trains';
import { trainType } from './trainTypes';

export const TRAIN_PASSENGER_CAPACITY = 200;
const MAX_QUEUE = 50000;
// Average patience is six hours of game time; the hazard is applied continuously.
const ABANDONMENT_PER_DAY = 4;

// Planned headway is an estimate; delays naturally let queues grow for longer.
export function lineHeadwayDays(line, cities, tracks) {
  let hours = 0;
  for (let i = 1; i < line.stops.length; i++) {
    const a = cities[String(line.stops[i - 1])], b = cities[String(line.stops[i])];
    const track = findTrack(tracks, line.stops[i - 1], line.stops[i]);
    if (!a || !b || !track || track.construction) return Infinity;
    hours += 2 * Math.max(.1, Number(track.km) || distance(a, b)) / Math.min(trackType(track).speed, trainType(line).velocidad_maxima);
  }
  return hours / 24 / lineTrains(line).length;
}

function dailyVariation(lineId, from, to, day) {
  let hash = 2166136261;
  for (const char of `${lineId}|${from}|${to}|${day}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return .85 + ((hash >>> 0) / 4294967295) * .3;
}

export function demandRates(line, cities, tracks) {
  const stops = line.stops.map(String), headway = lineHeadwayDays(line, cities, tracks);
  const frequencyFactor = Number.isFinite(headway) ? .35 + .65 / (1 + headway * 2) : 0;
  const rates = {};
  for (const from of stops) {
    if (!cities[from]) continue;
    const population = Math.max(0, Number(cities[from]?.population) || 0);
    const targets = stops.filter(id => id !== from && cities[id]);
    const weighted = targets.map(id => ({ id, weight: Math.sqrt(Math.max(0, Number(cities[id].population) || 0)) / (1 + distance(cities[from], cities[id]) / 250) }));
    const weightTotal = weighted.reduce((sum, target) => sum + target.weight, 0);
    const attraction = weightTotal / (weightTotal + 100);
    rates[from] = Object.fromEntries(weighted.map(target => [target.id, weightTotal ? Math.sqrt(population) * 1.5 * frequencyFactor * attraction * target.weight / weightTotal : 0]));
  }
  return rates;
}

// Lines serving the same origin and destination compete for one pool of
// potential passengers instead of each creating an independent copy.
export function networkDemandRates(lines, cities, tracks) {
  const rates = lines.map(line => demandRates(line, cities, tracks));
  const totals = new Map();
  for (const origins of rates) for (const [from, targets] of Object.entries(origins)) for (const [to, rate] of Object.entries(targets)) {
    const key = JSON.stringify([from, to]);
    const pair = totals.get(key) || { sum: 0, max: 0 };
    pair.sum += rate;
    pair.max = Math.max(pair.max, rate);
    totals.set(key, pair);
  }
  return rates.map(origins => Object.fromEntries(Object.entries(origins).map(([from, targets]) => [from,
    Object.fromEntries(Object.entries(targets).map(([to, rate]) => {
      const pair = totals.get(JSON.stringify([from, to]));
      return [to, pair.sum ? rate * pair.max / pair.sum : 0];
    }))
  ])));
}

export function advanceQueues(queues, rates, lineId, start, end) {
  let at = start;
  while (at < end - 1e-12) {
    const day = Math.floor(at + 1e-10), next = Math.min(end, day + 1);
    for (const [from, targets] of Object.entries(rates)) {
      const origin = queues[from] ||= {};
      for (const [to, rate] of Object.entries(targets)) {
        const elapsed = next - at;
        const leaving = -Math.expm1(-ABANDONMENT_PER_DAY * elapsed);
        const incoming = rate * dailyVariation(lineId, from, to, day);
        origin[to] = Math.min(MAX_QUEUE, Math.max(0, Number(origin[to]) || 0) * (1 - leaving) + incoming * leaving / ABANDONMENT_PER_DAY);
      }
    }
    at = next;
  }
}

export function trainPassengerCount(train) {
  return Object.values(train?.passengers || {}).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
}
export function trainOccupancy(train, capacity = TRAIN_PASSENGER_CAPACITY) {
  return Math.round(100 * trainPassengerCount(train) / capacity);
}

export function boardPassengers(line, train, queues) {
  const stops = line.stops.map(String), origin = stops[train.stopIndex];
  const existing = train.passengers || {};
  const available = Math.max(0, trainType(line).viajeros - trainPassengerCount(train));
  const targets = stops.slice(train.direction > 0 ? train.stopIndex + 1 : 0, train.direction > 0 ? undefined : train.stopIndex);
  const choices = targets.map(id => ({ id, count: Math.floor((queues[origin]?.[id] || 0) + 1e-9) })).filter(item => item.count > 0);
  const total = choices.reduce((sum, item) => sum + item.count, 0), count = Math.min(available, total);
  const allocations = choices.map(item => {
    const share = count * item.count / total;
    return { ...item, board: Math.floor(share), remainder: share - Math.floor(share) };
  });
  let left = count - allocations.reduce((sum, item) => sum + item.board, 0);
  allocations.sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id));
  for (const item of allocations) {
    if (left > 0 && item.board < item.count) { item.board++; left--; }
    queues[origin][item.id] = Math.max(0, queues[origin][item.id] - item.board);
    if (item.board) existing[item.id] = (existing[item.id] || 0) + item.board;
  }
  train.passengers = existing;
  return count;
}

export function waitingPassengers(line, cityId) {
  const stops = new Set(line.stops.map(String));
  if (!stops.has(String(cityId))) return 0;
  return Object.entries(line.passengerQueues?.[String(cityId)] || {}).filter(([id]) => stops.has(id)).reduce((sum, [, count]) => sum + Math.floor((Number(count) || 0) + 1e-9), 0);
}

export function stationWaitingPassengers(lines, cityId) {
  return lines.reduce((total, line) => total + waitingPassengers(line, cityId), 0);
}
export function crowdingLevel(count) {
  if (count <= 0) return { id: 'none', label: 'Sin viajeros' };
  if (count < 25) return { id: 'low', label: 'Poca gente' };
  if (count < 100) return { id: 'medium', label: 'Afluencia media' };
  return { id: 'high', label: 'Mucha gente' };
}
