export const MAX_TRAINS_PER_LINE = 50;
import { trainType } from './trainTypes';

const newTrainId = () => globalThis.crypto?.randomUUID?.() ?? 'train-' + Date.now() + '-' + Math.random().toString(36).slice(2);
export const initialTrain = (acquiredDay = 1) => ({ id: newTrainId(), acquiredDay, stopIndex: 0, direction: 1, progress: 0, moving: false, waitingSince: 0, waitDays: 0 });
export const TRAIN_RENEWAL_COST = 25000;
export function trainAge(train, day = 1) {
  return Math.max(0, Math.floor(Number(day) || 1) - Math.floor(Number(train?.acquiredDay) || 1));
}
// Trains lose 0.5% of their maximum speed per game day, down to half speed.
export function trainSpeed(line, train, day = 1) {
  const ageFactor = Math.max(.5, 1 - trainAge(train, day) * .005);
  return trainType(line).velocidad_maxima * ageFactor;
}
// Daily maintenance rises by 0.5% of the base cost per game day of age.
export function trainMaintenance(line, train, day = 1) {
  return trainType(line).coste_al_dia * (1 + trainAge(train, day) * .005);
}
export function lineTrains(line) {
  return Array.isArray(line.trains) && line.trains.length ? line.trains : [line.train || initialTrain()];
}
export function resizeLineTrains(line, count, acquiredDay = 1) {
  const size = Math.max(1, Math.min(MAX_TRAINS_PER_LINE, Math.floor(count)));
  const trains = lineTrains(line).slice(0, size);
  while (trains.length < size) trains.push(initialTrain(acquiredDay));
  return { ...line, trains, train: trains[0] };
}
