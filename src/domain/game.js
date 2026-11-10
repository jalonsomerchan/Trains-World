export const initialGame = { money: 500000, day: 1, tracks: [], lines: [], cities: {}, paused: true };
export const formatMoney = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
export const compactMoney = value => value >= 1000000 ? (value / 1000000).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' M' : value >= 1000 ? Math.floor(value / 1000) + ' K' : String(value);
export const formatNumber = value => new Intl.NumberFormat('es-ES').format(Math.round(value));
export function distance(a, b) {
  const radians = Math.PI / 180;
  const lat = (b.latitude - a.latitude) * radians;
  const lon = (b.longitude - a.longitude) * radians;
  const x = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(lon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, x)));
}
export const trackCost = (a, b) => Math.max(12000, Math.round(distance(a, b) * 650 / 1000) * 1000);
export const findTrack = (tracks, a, b) => tracks.find(t => (String(t.a) === String(a) && String(t.b) === String(b)) || (String(t.a) === String(b) && String(t.b) === String(a)));
export const trackReady = track => !!track && !track.construction;
export function availableStops(tracks, stops) {
  const visited = new Set(stops.map(String));
  const last = stops.length ? String(stops[stops.length - 1]) : null;
  const candidates = new Set();
  for (const track of tracks) {
    if (track.construction) continue;
    const a = String(track.a), b = String(track.b);
    if (last === null) { candidates.add(a); candidates.add(b); }
    else if (a === last) candidates.add(b);
    else if (b === last) candidates.add(a);
  }
  return [...candidates].filter(id => !visited.has(id));
}
