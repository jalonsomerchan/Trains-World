import { useEffect, useMemo, useRef, useState } from 'react';
import { initialGame } from '../domain/game';
import { advanceSimulation, estimateLineIncome } from '../domain/simulation';
import { saveGame } from '../services/storage';
import { getMap } from '../data/maps';
import { lineTrainLimit } from '../domain/stations';
import { initialTrain, lineTrains, resizeLineTrains } from '../domain/trains';
import { networkDemandRates } from '../domain/passengers';
import { trainType } from '../domain/trainTypes';

export function useGame(session) {
  const [game, setGame] = useState(() => {
    const saved = { ...initialGame, ...(session.saved || {}), mapId: session.mapId || session.saved?.mapId || 'iberican' };
    const speed = Number.isFinite(saved.speed) ? saved.speed : saved.paused ? 0 : 1;
    return { ...saved, speed, paused: speed === 0, lines: saved.lines.map((line, index) => {
      const trains = lineTrains(line).map(train => ({ ...train, id: train.id || initialTrain(saved.day).id, acquiredDay: Number.isFinite(train.acquiredDay) ? train.acquiredDay : saved.day || 1 }));
      const withId = { ...line, id: line.id || 'legacy-' + index, trains, train: trains[0] };
      const limit = lineTrainLimit(saved, line.stops);
      return lineTrains(withId).length > limit ? resizeLineTrains(withId, limit, saved.day || 1) : withId;
    }) };
  });
  const cities = useMemo(() => {
    const savedCities = Object.values(game.cities || {});
    const names = new Set(savedCities.map(city => city.name.toLocaleLowerCase()));
    const mapCities = getMap(game.mapId).cities.filter(city => !names.has(city.name.toLocaleLowerCase()));
    return { ...Object.fromEntries(mapCities.map(city => [city.id, city])), ...game.cities };
  }, [game.mapId, game.cities]);
  const networkRates = useMemo(() => networkDemandRates(game.lines, cities, game.tracks), [game.lines, cities, game.tracks]);
  const income = game.lines.reduce((sum, line) => sum + estimateLineIncome(line, cities, game.tracks, game.lines, networkRates), 0);
  const expenses = game.lines.reduce((sum, line) => sum + lineTrains(line).length * trainType(line).coste_al_dia, 0);
  useEffect(() => {
    // Simulation updates frequently; debounce persistence while paused and
    // checkpoint periodically while moving, plus on page exit.
    if (!game.paused) return undefined;
    saveGame(game);
  }, [game, game.paused]);
  const latestGame = useRef(game);
  latestGame.current = game;
  useEffect(() => {
    const save = () => saveGame(latestGame.current);
    const timer = setInterval(save, 2000);
    window.addEventListener('pagehide', save);
    return () => { clearInterval(timer); window.removeEventListener('pagehide', save); save(); };
  }, []);
  useEffect(() => {
    if (game.paused) return undefined;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const seconds = Math.min(.5, (now - last) / 1000);
      last = now;
      setGame(previous => advanceSimulation(previous, cities, seconds * (previous.speed || 1)));
    }, 200);
    return () => clearInterval(timer);
  }, [game.paused, cities]);
  return { game, setGame, cities, income, expenses };
}
