export const emptyTotals = () => ({ income: 0, expenses: 0 });
export const trackStatsKey = (a, b) => [String(a), String(b)].sort().join('|');
export const routeTrackKeys = stops => stops.slice(1).map((id, index) => trackStatsKey(stops[index], id));

// Each entry is counted once in company totals. Within each category, amounts
// shared by several cities or tracks are split evenly, without losing euros.
export function recordStatistics(previous, { kind, amount, lineId, trainId, cityIds = [], trackKeys = [] }) {
  if (!['income', 'expenses'].includes(kind) || !Number.isSafeInteger(amount) || amount < 0) return previous;
  const state = {
    ...previous,
    total: { ...emptyTotals(), ...previous?.total },
    lines: { ...previous?.lines }, trains: { ...previous?.trains }, tracks: { ...previous?.tracks }, cities: { ...previous?.cities },
  };
  state.total[kind] += amount;
  function allocate(group, ids) {
    const unique = [...new Set(ids.filter(id => id != null).map(String))].sort();
    if (!unique.length) return;
    const quotient = Math.floor(amount / unique.length), remainder = amount % unique.length;
    unique.forEach((id, index) => {
      const current = { ...emptyTotals(), ...state[group][id] };
      current[kind] += quotient + (index < remainder ? 1 : 0);
      state[group][id] = current;
    });
  }
  if (lineId != null) allocate('lines', [lineId]);
  if (trainId != null) allocate('trains', [trainId]);
  if (cityIds.length) allocate('cities', cityIds);
  if (trackKeys.length) allocate('tracks', trackKeys);
  return state;
}
export function statsFor(stats, group, id) {
  return { ...emptyTotals(), ...(group === 'total' ? stats?.total : stats?.[group]?.[String(id)]) };
}

// Operational figures describe completed station-to-station segments only.
export function recordJourneyStatistics(previous, { lineId, trainId, trackKey, income, travelDays, waitDays, passengers, capacity }) {
  if (lineId == null || trainId == null || trackKey == null) return previous;
  const operations = { ...previous?.operations };
  for (const [group, id] of [['lines', lineId], ['trains', trainId], ['tracks', trackKey]]) {
    const entries = { ...operations[group] };
    const old = entries[String(id)] || {};
    const trainIds = old.trainIds || [];
    entries[String(id)] = {
      trips: (old.trips || 0) + 1,
      travelDays: (old.travelDays || 0) + travelDays,
      waitDays: (old.waitDays || 0) + waitDays,
      passengers: (old.passengers || 0) + passengers,
      income: (old.income || 0) + income,
      occupancySum: (old.occupancySum || 0) + (capacity > 0 ? passengers / capacity : 0),
      occupancySamples: (old.occupancySamples || 0) + (capacity > 0 ? 1 : 0),
      trainIds: trainIds.includes(String(trainId)) ? trainIds : [...trainIds, String(trainId)],
    };
    operations[group] = entries;
  }
  return { ...previous, operations };
}
export function journeyStatsFor(stats, group, id) {
  return stats?.operations?.[group]?.[String(id)] || { trips: 0, travelDays: 0, waitDays: 0, passengers: 0, income: 0, trainIds: [] };
}
