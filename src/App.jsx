import { useEffect, useRef, useState } from 'react';
import GameMap from './components/GameMap';
import TrackSelectionHint from './components/TrackSelectionHint';
import Confirmation from './components/Confirmation';
import { BottomNav, TopControls } from './components/Controls';
import GameSheet from './components/Sheet';
import { distance, findTrack, formatMoney, trackReady } from './domain/game';
import { recordStatistics, routeTrackKeys, trackStatsKey } from './domain/statistics';
import { useGame } from './hooks/useGame';
import { constructionCost, conversionCost, findTrackType, trackType, trackFits, trackOccupancy, trackConstructionSeconds, formatConstructionTime } from './domain/trackTypes';
import StartMenu from './components/StartMenu';
import { loadGame } from './services/storage';
import { maps, getMap } from './data/maps';
import { initialTrain, lineTrains, resizeLineTrains, TRAIN_RENEWAL_COST } from './domain/trains';
import { MAX_STATION_CAPACITY, lineTrainLimit, stationCapacity, stationUsage } from './domain/stations';

export default function App() {
  const [session, setSession] = useState(null);
  const saved = loadGame(null);
  if (!session) return <StartMenu maps={maps} saved={saved} onContinue={() => setSession({ saved })} onNewGame={mapId => setSession({ mapId })} />;
  return <Game session={session} />;
}

function Game({ session }) {
  const { game, setGame, cities, income, expenses } = useGame(session);
  const map = getMap(game.mapId);
  const [screen, setScreen] = useState(null);
  const [selected, setSelected] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [draft, setDraft] = useState([]);
  const [editingLine, setEditingLine] = useState(null);
  const [editingTrack, setEditingTrack] = useState(null);
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [trainListBack, setTrainListBack] = useState('more');
  const [confirmation, setConfirmation] = useState(null);
  const [statsTarget, setStatsTarget] = useState(null);
  const [lineFilterCity, setLineFilterCity] = useState(null);
  const [buildType, setBuildType] = useState('basic');
  const [zoomRequest, setZoomRequest] = useState(null);
  const cityStatus = 'Ciudades · ' + map.name;
  const [mapStatus, setMapStatus] = useState('loading');
  const [notice, setNotice] = useState('');
  const lastArrival = useRef(null);
  const knownBreakdowns = useRef(new Set());
  const notify = text => { setNotice(text); };
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer); }, [notice]);

  useEffect(() => {
    const events = game.arrivals || [];
    if (lastArrival.current === null) {
      lastArrival.current = game.arrivalSequence || 0;
      return;
    }
    lastArrival.current = Math.max(lastArrival.current, ...events.map(event => event.id));
  }, [game.arrivals, game.arrivalSequence]);

  useEffect(() => {
    const current = new Set();
    for (const line of game.lines) for (const [index, train] of lineTrains(line).entries()) {
      const key = String(train.id || line.id + ':' + index);
      if (train.breakdownRemaining > 0) {
        current.add(key);
        if (!knownBreakdowns.current.has(key)) notify('Avería en ' + line.name + '. El tren está detenido.');
      }
    }
    knownBreakdowns.current = current;
  }, [game.lines]);

  function selectCity(city) {
    if (!city) return;
    const id = String(city.id);
    if (screen === 'newLine') {
      const last = draft.at(-1);
      if (draft.includes(id)) return notify('Esta ciudad ya está en el recorrido.');
      if (last && !trackReady(findTrack(game.tracks, last, id))) return notify('Necesitas una vía terminada entre estas ciudades.');
      setDraft([...draft, id]);
      return;
    }
    if (screen === 'chooseDestination') {
      if (id === String(selected)) return notify('Elige una ciudad diferente.');
      if (findTrack(game.tracks, selected, id)) return notify('Ya existe una vía entre estas ciudades.');
      setOrigin(String(selected));
      setBuildType('basic');
      setSelected(id);
      setScreen('confirmTrack');
      return;
    }
    setSelected(id);
    setScreen('cityMenu');
  }

  function dragTrack(from, to) {
    if (String(from.id) === String(to.id)) return;
    if (findTrack(game.tracks, from.id, to.id)) return notify('Ya existe una vía entre estas ciudades.');
    setOrigin(String(from.id));
    setSelected(String(to.id));
    setBuildType('basic');
    setScreen('confirmTrack');
  }

  function chooseAnotherDestination() {
    setSelected(origin);
    setOrigin(null);
    setScreen('chooseDestination');
  }

  function buildTrack() {
    const a = cities[String(origin)], b = cities[String(selected)];
    if (!a || !b || findTrack(game.tracks, a.id, b.id)) return;
    const type = findTrackType(buildType);
    if (!type) return;
    const cost = constructionCost(a, b, type);
    if (game.money < cost) return;
    setGame(previous => {
      if (previous.money < cost || findTrack(previous.tracks, a.id, b.id)) return previous;
      return { ...previous, money: previous.money - cost, stats: recordStatistics(previous.stats, { kind: 'expenses', amount: cost, cityIds: [a.id, b.id], trackKeys: [trackStatsKey(a.id, b.id)] }), tracks: [...previous.tracks, { a: String(a.id), b: String(b.id), km: distance(a,b), type: type.id, construction: { remainingDays: trackConstructionSeconds(distance(a, b), type) / 120, totalDays: trackConstructionSeconds(distance(a, b), type) / 120, action: 'build' } }], cities: { ...previous.cities, [a.id]: a, [b.id]: b } };
    });
    setScreen(null); setOrigin(null); notify('Obras iniciadas. La vía estará disponible al terminar.');
  }
  function openTrack(index) {
    if (!game.tracks[index]) return;
    setEditingTrack(index);
    setScreen('trackTypes');
  }

  function selectTrackType(index, typeId) {
    const track = game.tracks[index], target = findTrackType(typeId);
    if (!track || !target || track.construction || trackType(track).id === target.id) return;
    if (!trackFits(target, trackOccupancy(track, game.lines))) {
      notify('Espera a que se libere la vía antes de cambiar su capacidad o sentido.');
      return;
    }
    const price = conversionCost(track, target);
    if (game.money < price) return;
    setGame(previous => {
      const current = previous.tracks[index];
      if (!current || current.construction || trackType(current).id === target.id || !trackFits(target, trackOccupancy(current, previous.lines))) return previous;
      const cost = conversionCost(current, target);
      if (previous.money < cost) return previous;
      return { ...previous, money: previous.money - cost, stats: recordStatistics(previous.stats, { kind: 'expenses', amount: cost, cityIds: [current.a, current.b], trackKeys: [trackStatsKey(current.a, current.b)] }), tracks: previous.tracks.map((item, i) => i === index ? { ...item, construction: { remainingDays: trackConstructionSeconds(item.km, target) / 120, totalDays: trackConstructionSeconds(item.km, target) / 120, action: 'upgrade', targetType: target.id } } : item) };
    });
    setScreen('tracks');
    setEditingTrack(null);
    notify('Mejora iniciada: ' + target.name + '.');
  }
  function startLineEdit(index) {
    const line = game.lines[index];
    if (!line) return;
    setEditingLine(index);
    setDraft(line.stops.map(String));
    setScreen('newLine');
  }

  function startNewLine() {
    setEditingLine(null);
    setDraft([]);
    setScreen('newLine');
  }

  function changeStationCapacity(cityId, capacity) {
    const usage = stationUsage(game.lines, cityId);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_STATION_CAPACITY || capacity < usage.total) return;
    const affected = game.lines.filter(line => line.stops.some(id => String(id) === String(cityId)) && lineTrains(line).length > capacity);
    const apply = () => setGame(previous => {
      if (capacity < stationUsage(previous.lines, cityId).total) return previous;
      const updated = { ...previous, stations: { ...previous.stations, [cityId]: { ...previous.stations?.[cityId], capacity } } };
      return { ...updated, lines: previous.lines.map(line => {
        const limit = lineTrainLimit(updated, line.stops);
        return lineTrains(line).length > limit ? resizeLineTrains(line, limit) : line;
      }) };
    });
    if (affected.length) requestConfirmation('Reducir capacidad', 'Se retirarán los trenes que superen el nuevo límite de las líneas afectadas, incluso si están en viaje.', apply);
    else apply();
  }

  function saveLine(name, selectedTrainType) {
    if (draft.length < 2) return;
    if (draft.slice(1).some((id, i) => !trackReady(findTrack(game.tracks, draft[i], id)))) return notify('Todas las paradas deben tener vías terminadas.');
    const editing = editingLine !== null;
    if (!editing && game.money < 25000) return;
    const existing = editing ? game.lines[editingLine] : null;
    if (editing && !existing) return;
    const stopsChanged = editing && JSON.stringify(existing.stops.map(String)) !== JSON.stringify(draft.map(String));
    const count = editing ? (stopsChanged ? Math.min(lineTrains(existing).length, lineTrainLimit(game, draft)) : 0) : 1;
    const otherLines = stopsChanged ? game.lines.filter(item => item.id !== existing.id) : game.lines;
    if (count && stationUsage(otherLines, draft[0]).total + count > stationCapacity(game, draft[0])) return notify('No hay plazas suficientes en la estación de origen.');
    const lineId = existing?.id || (globalThis.crypto?.randomUUID?.() ?? 'line-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    setGame(previous => {
      const current = editing ? previous.lines.find(item => item.id === lineId) : null;
      if ((editing && !current) || (!editing && previous.money < 25000) || draft.slice(1).some((id, i) => !trackReady(findTrack(previous.tracks, draft[i], id)))) return previous;
      const stopsChanged = editing && JSON.stringify(current.stops.map(String)) !== JSON.stringify(draft.map(String));
      const needed = editing ? (stopsChanged ? Math.min(lineTrains(current).length, lineTrainLimit(previous, draft)) : 0) : 1;
      const otherLines = stopsChanged ? previous.lines.filter(item => item.id !== lineId) : previous.lines;
      if (needed && stationUsage(otherLines, draft[0]).total + needed > stationCapacity(previous, draft[0])) return previous;
      const line = { ...(current || {}), id: lineId, name: name.trim() || current?.name || 'Línea ' + (previous.lines.length + 1), stops: [...draft], trainType: selectedTrainType || current?.trainType || 'standard', ...(!editing ? { trains: [initialTrain(previous.day)] } : {}), ...(stopsChanged ? { trains: lineTrains(current).slice(0, needed).map(train => ({ ...initialTrain(train.acquiredDay ?? previous.day), id: train.id })), train: null } : {}) };
      return {
        ...previous,
        money: previous.money - (editing ? 0 : 25000),
        stats: editing ? previous.stats : recordStatistics(previous.stats, { kind: 'expenses', amount: 25000, lineId, cityIds: draft, trackKeys: routeTrackKeys(draft) }),
        lines: editing ? previous.lines.map(item => item.id === lineId ? line : item) : [...previous.lines, line],
        cities: { ...previous.cities, ...Object.fromEntries(draft.map(id => [id, cities[id]])) },
      };
    });
    setDraft([]);
    setEditingLine(null);
    setScreen('lines');
    notify(editing ? 'Línea actualizada.' : 'Línea en marcha.');
  }

  function requestConfirmation(title, message, action) {
    setConfirmation({ title, message, action });
  }
  function confirmBuild() {
    const a = cities[String(origin)], b = cities[String(selected)], type = findTrackType(buildType);
    if (!a || !b || !type) return;
    requestConfirmation('Construir vía', a.name + ' → ' + b.name + ' · ' + type.name + ' · ' + formatMoney(constructionCost(a, b, type)) + ' · Tiempo estimado: ' + formatConstructionTime(trackConstructionSeconds(distance(a, b), type) / 120), buildTrack);
  }
  function confirmUpgrade(index, typeId) {
    const track = game.tracks[index], type = findTrackType(typeId);
    if (!track || !type) return;
    requestConfirmation('Mejorar vía', 'Cambiar a ' + type.name + ' por ' + formatMoney(conversionCost(track, type)) + ' · Tiempo estimado: ' + formatConstructionTime(trackConstructionSeconds(track.km, type) / 120) + '.', () => selectTrackType(index, typeId));
  }
  function confirmLine(name, selectedTrainType) {
    const editing = editingLine !== null;
    const current = editing ? game.lines[editingLine] : null;
    const limit = lineTrainLimit(game, draft);
    const reduction = current && lineTrains(current).length > limit ? ` Se reducirá la línea a ${limit} ${limit === 1 ? 'tren' : 'trenes'} por la capacidad de sus estaciones.` : '';
    requestConfirmation(editing ? 'Guardar cambios' : 'Poner línea en marcha', editing ? 'Se actualizará el recorrido de la línea.' + reduction : 'Se pondrá en marcha la línea por ' + formatMoney(25000) + '.', () => saveLine(name, selectedTrainType));
  }
  function confirmRemoveLine(index) {
    const line = game.lines[index];
    if (!line) return;
    requestConfirmation('Retirar línea', 'Se retirará ' + line.name + ' y dejará de generar ingresos.', () => setGame(previous => ({ ...previous, lines: previous.lines.filter(item => item.id !== line.id) })));
  }
  function changeSimulationSpeed(speed) {
    setGame(previous => ({ ...previous, speed, paused: speed === 0 }));
  }
  function openStats(group, id, title, back) {
    setStatsTarget({ group, id: String(id), title, back });
    setScreen('statistics');
  }
  function openCityLines(cityId) { setLineFilterCity(String(cityId)); setScreen('lines'); }
  function openAllLines() { setLineFilterCity(null); setScreen('lines'); }
  function changeTrainCount(index, count) {
    const line = game.lines[index];
    if (!line || count === lineTrains(line).length || count < 1 || count > lineTrainLimit(game, line.stops)) return;
    if (count > lineTrains(line).length && stationUsage(game.lines, line.stops[0]).total + count - lineTrains(line).length > stationCapacity(game, line.stops[0])) return notify('No hay plazas suficientes en la estación de origen.');
    requestConfirmation('Cambiar número de trenes', `La línea ${line.name} tendrá ${count} ${count === 1 ? 'tren' : 'trenes'}.` + (count < lineTrains(line).length ? ' Se retirará el último tren, aunque esté en viaje.' : ' Los nuevos trenes comenzarán en la primera estación.'), () => setGame(previous => { const current = previous.lines.find(item => item.id === line.id); if (!current || count > lineTrainLimit(previous, current.stops) || (count > lineTrains(current).length && stationUsage(previous.lines, current.stops[0]).total + count - lineTrains(current).length > stationCapacity(previous, current.stops[0]))) return previous; return { ...previous, lines: previous.lines.map(item => item.id === line.id ? resizeLineTrains(item, count, previous.day) : item) }; }));
  }
  function openTrain(index, trainIndex) {
    if (screen || confirmation || !game.lines[index]) return;
    setSelectedTrain({ lineIndex: index, trainIndex });
    setScreen('trainInfo');
  }
  function openTrainList(back) {
    setTrainListBack(back);
    setScreen('trains');
  }
  function viewTrain(lineIndex, trainIndex) {
    setSelectedTrain({ lineIndex, trainIndex });
    setScreen('trainInfo');
  }
  function toggleTrainPause(trainId) {
    setGame(previous => ({ ...previous, lines: previous.lines.map(line => {
      const trains = lineTrains(line).map(train => train.id === trainId ? { ...train, paused: !train.paused } : train);
      return { ...line, trains, train: trains[0] };
    }) }));
  }
  function confirmRenewTrain() {
    const line = game.lines[selectedTrain?.lineIndex];
    const train = line && lineTrains(line)[selectedTrain.trainIndex];
    if (!train) return;
    if (game.money < TRAIN_RENEWAL_COST) return notify('No tienes dinero suficiente para renovar este tren.');
    requestConfirmation('Renovar tren', `Se sustituirá por un tren nuevo por ${formatMoney(TRAIN_RENEWAL_COST)}. Su edad y estadísticas operativas empezarán de nuevo.`, () => setGame(previous => {
      const currentLine = previous.lines.find(item => item.id === line.id);
      if (!currentLine || previous.money < TRAIN_RENEWAL_COST) return previous;
      let replacement;
      const trains = lineTrains(currentLine).map(item => {
        if (item.id !== train.id) return item;
        replacement = initialTrain(previous.day);
        return replacement;
      });
      if (!replacement) return previous;
      const stats = recordStatistics(previous.stats, { kind: 'expenses', amount: TRAIN_RENEWAL_COST, lineId: currentLine.id, trainId: replacement.id, trackKeys: routeTrackKeys(currentLine.stops) });
      return { ...previous, money: previous.money - TRAIN_RENEWAL_COST, stats, lines: previous.lines.map(item => item.id === currentLine.id ? { ...item, trains, train: trains[0] } : item) };
    }));
  }

  return <main className="game">
    <div className="game-content">
    <GameMap cities={cities} tracks={game.tracks} lines={game.lines} arrivals={game.arrivals || []} onCityClick={selectCity} onCityDrag={dragTrack} cityDragEnabled={!screen || screen === 'chooseDestination'} onTrainClick={openTrain} onTrackClick={openTrack} trackSelectionEnabled={!screen} mapConfig={map} zoomRequest={zoomRequest} onMapStatus={setMapStatus} selectedOrigin={screen === 'chooseDestination' ? selected : null} previewTrack={screen === 'confirmTrack' ? { a: origin, b: selected, color: findTrackType(buildType)?.color } : null} />
    <TopControls game={game} income={income} expenses={expenses} onSpeedChange={changeSimulationSpeed} onZoom={direction => setZoomRequest({ direction, at: Date.now() })} />
    {!screen && <BottomNav onOpen={target => target === 'lines' ? openAllLines() : setScreen(target)} />}
    {screen === 'chooseDestination' && cities[String(selected)] && <TrackSelectionHint city={cities[String(selected)]} onCancel={() => setScreen(null)} />}
    <GameSheet key={screen === 'newLine' ? 'line-editor' : 'sheet'} screen={screen} setScreen={setScreen} selected={selected} origin={origin} draft={draft} setDraft={setDraft} game={game} cities={cities} income={income} lineFilterCity={lineFilterCity} onManageCityLines={openCityLines} onManageAllLines={openAllLines} onOpenTrainList={openTrainList} trainListBack={trainListBack} onViewTrain={viewTrain} onClose={() => setScreen(null)} onBuild={confirmBuild} buildType={buildType} onBuildTypeChange={setBuildType} editingTrack={editingTrack} onChooseTrack={openTrack} onUpgrade={confirmUpgrade} onSaveLine={confirmLine} editingLine={editingLine === null ? null : game.lines[editingLine]} onEditLine={startLineEdit} onNewLine={startNewLine} onRemoveLine={confirmRemoveLine} onChangeTrainCount={changeTrainCount} onChangeStationCapacity={changeStationCapacity} selectedTrain={selectedTrain} onToggleTrainPause={toggleTrainPause} onRenewTrain={confirmRenewTrain} statsTarget={statsTarget} onOpenStats={openStats} confirmationOpen={!!confirmation} onSelectCity={selectCity} onChangeDestination={chooseAnotherDestination} status={cityStatus} />
    {mapStatus === 'error' && <div className="map-error" role="status">No se ha podido cargar el mapa. Comprueba tu conexión.</div>}
    {notice && <div className="notice" role="status">{notice}</div>}
    <span className="data-status" title={cityStatus}>{cityStatus}</span>
    </div>
    {confirmation && <Confirmation title={confirmation.title} message={confirmation.message} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation.action; setConfirmation(null); action(); }} />}
  </main>;
}
