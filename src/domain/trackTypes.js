import { distance, trackCost } from './game';
import { lineTrains } from './trains';
import baseTrackTypes from '../data/trackTypes.json';

// Capacity is per direction on double track, and shared on single track.
// Add base types in data/trackTypes.json; each also gets a double-track variant.
export const TRACK_TYPES = baseTrackTypes.flatMap(type => [
  { ...type, bidirectional: false },
  { ...type, id: type.id + '_bidirectional', name: type.name + ' · doble sentido', bidirectional: true, costPerKm: type.costPerKm + 650 },
]);
const TYPES_BY_ID = Object.fromEntries(TRACK_TYPES.map(type => [type.id, type]));

export function trackConstructionSeconds(km, type) {
  const length = Math.max(0, Number(km) || 0);
  const premium = Math.max(0, Number(type?.costPerKm) || 0);
  return Math.round(Math.max(12, length * (.15 + premium / 25000)));
}
export function formatConstructionTime(remainingDays) {
  const total = Math.max(0, Math.ceil((Number(remainingDays) || 0) * 120));
  const hours = Math.floor(total / 3600), minutes = Math.floor((total % 3600) / 60), seconds = total % 60;
  return hours ? [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':') : String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

export function trackType(track) {
  return TYPES_BY_ID[track?.type] || (track?.level === 2 ? TYPES_BY_ID.high_speed : TYPES_BY_ID.basic);
}
export function findTrackType(id) { return TYPES_BY_ID[id]; }

// Switching type costs the positive difference between investment tiers plus
// a modest conversion charge. Different speed/capacity combinations are useful.
export function conversionCost(track, target) {
  const current = trackType(track);
  if (!target || target.id === current.id) return 0;
  const perKm = Math.max(250, target.costPerKm - current.costPerKm);
  return Math.max(5000, Math.ceil(Math.max(.1, track.km || 0) * perKm / 1000) * 1000);
}
export function constructionCost(from, to, type) {
  if (!type) return Infinity;
  const premium = Math.ceil(distance(from, to) * type.costPerKm / 1000) * 1000;
  return trackCost(from, to) + premium;
}
export function trainsOnTrack(track, lines) {
  return lines.flatMap(line => lineTrains(line).map(t => ({ line, t }))).filter(({ line, t }) => {
    if (!t?.moving) return false;
    const a = String(line.stops[t.stopIndex]), b = String(line.stops[t.stopIndex + t.direction]);
    return (a === String(track.a) && b === String(track.b)) || (a === String(track.b) && b === String(track.a));
  }).length;
}

export function trackOccupancy(track, lines) {
  const counts = { forward: 0, backward: 0 };
  for (const line of lines) for (const train of lineTrains(line)) {
    if (!train?.moving) continue;
    const from = String(line.stops[train.stopIndex]), to = String(line.stops[train.stopIndex + train.direction]);
    if (from === String(track.a) && to === String(track.b)) counts.forward++;
    if (from === String(track.b) && to === String(track.a)) counts.backward++;
  }
  return counts;
}
export function trackFits(type, counts) {
  return type.bidirectional
    ? counts.forward <= type.capacity && counts.backward <= type.capacity
    : counts.forward + counts.backward <= type.capacity && !(counts.forward && counts.backward);
}
export function trackCanEnter(type, counts, forward) {
  return trackFits(type, { ...counts, [forward ? 'forward' : 'backward']: counts[forward ? 'forward' : 'backward'] + 1 });
}
