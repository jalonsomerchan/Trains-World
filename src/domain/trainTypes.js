import trainTypes from '../data/trainTypes.json';

export const TRAIN_TYPES = trainTypes;
const TYPES_BY_ID = Object.fromEntries(TRAIN_TYPES.map(type => [type.id, type]));
export const trainType = line => TYPES_BY_ID[line?.trainType] || TYPES_BY_ID.standard;
export const findTrainType = id => TYPES_BY_ID[id];
