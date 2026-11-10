import { lineTrains, MAX_TRAINS_PER_LINE } from './trains';

export const DEFAULT_STATION_CAPACITY = 2;
export const MAX_STATION_CAPACITY = 50;
export function stationCapacity(game, cityId) {
  return game.stations?.[String(cityId)]?.capacity ?? DEFAULT_STATION_CAPACITY;
}
export function lineTrainLimit(game, stops) {
  return stops.reduce((limit, cityId) => Math.min(limit, stationCapacity(game, cityId)), MAX_TRAINS_PER_LINE);
}
// Every moving train reserves a space at its destination until it arrives.
export function stationUsage(lines, cityId) {
  let present = 0, incoming = 0;
  for (const line of lines) for (const train of lineTrains(line)) {
    const index = train.stopIndex ?? 0;
    if (train.moving) {
      if (String(line.stops[index + train.direction]) === String(cityId)) incoming++;
    } else if (String(line.stops[index]) === String(cityId)) present++;
  }
  return { present, incoming, total: present + incoming };
}
