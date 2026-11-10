import { useEffect, useState } from 'react';
import { availableStops, distance, formatMoney, formatNumber } from '../domain/game';
import { estimateLineIncome } from '../domain/simulation';
import { TRACK_TYPES, constructionCost, conversionCost, findTrackType, trackType, trainsOnTrack, trackFits, trackOccupancy, formatConstructionTime, trackConstructionSeconds } from '../domain/trackTypes';
import { findTrack } from '../domain/game';
import { journeyStatsFor, statsFor, trackStatsKey } from '../domain/statistics';
import Statistics from './Statistics';
import { lineTrains, trainAge, trainSpeed, TRAIN_RENEWAL_COST } from '../domain/trains';
import { TRAIN_TYPES, trainType } from '../domain/trainTypes';
import { trainPassengerCount, trainOccupancy, waitingPassengers, stationWaitingPassengers, crowdingLevel, networkDemandRates } from '../domain/passengers';
import { MAX_STATION_CAPACITY, lineTrainLimit, stationCapacity, stationUsage } from '../domain/stations';

function Sheet({ children, onClose, title, suspended }) {
  useEffect(() => {
    const handleKey = event => { if (event.key === 'Escape' && !suspended) onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, suspended]);
  return <><div className="sheet-backdrop" onClick={onClose} aria-hidden="true" /><div className="sheet-wrap"><section className="sheet" role="dialog" aria-modal="true" aria-label={title}><div className="sheet-grabber" aria-hidden="true" />{children}</section><button className="sheet-cancel" onClick={onClose}>Cancelar</button></div></>;
}
function Action({ children, onClick, disabled }) {
  return <button className="sheet-action" onClick={onClick} disabled={disabled}>{children}</button>;
}
function averageDuration(days, trips) {
  if (!trips) return '—';
  const minutes = Math.round(days / trips * 24 * 60);
  if (minutes < 60) return minutes + ' min';
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours + ' h' + (rest ? ' ' + rest + ' min' : '');
}
function TrainRow({ label, children, emphasis = false }) {
  return <tr className={emphasis ? 'train-table-emphasis' : ''}><th scope="row">{label}</th><td>{children}</td></tr>;
}
export default function GameSheet({ screen, setScreen, selected, origin, draft, setDraft, game, cities, income, lineFilterCity, onManageCityLines, onManageAllLines, onClose, onBuild, buildType, onBuildTypeChange, onUpgrade, editingTrack, onChooseTrack, onSaveLine, editingLine, onEditLine, onNewLine, onRemoveLine, onChangeTrainCount, onChangeStationCapacity, onSelectCity, onChangeDestination, selectedTrain, onToggleTrainPause, onRenewTrain, statsTarget, onOpenStats, confirmationOpen, status }) {
  const [name, setName] = useState(() => editingLine?.name || '');
  const [trainTypeId, setTrainTypeId] = useState(() => editingLine?.trainType || 'standard');
  useEffect(() => { if (screen === 'newLine') { setName(editingLine?.name || ''); setTrainTypeId(editingLine?.trainType || 'standard'); } }, [screen, editingLine?.id]);
  const [filter, setFilter] = useState('');
  if (!screen || screen === 'chooseDestination') return null;
  const city = selected && cities[String(selected)];
  const from = origin && cities[String(origin)];
  const cityList = Object.values(cities).filter(c => c.population > 0 && c.name.toLowerCase().includes(filter.toLowerCase())).sort((a,b) => b.population-a.population).slice(0, 100);
  const linked = availableStops(game.tracks, draft).filter(id => cities[id]);
  const networkRates = screen === 'lines' ? networkDemandRates(game.lines, cities, game.tracks) : null;
  const displayedLines = game.lines.map((line, index) => ({ line, index })).filter(({ line }) => !lineFilterCity || line.stops.some(id => String(id) === String(lineFilterCity)));
  const filteredCityName = lineFilterCity ? cities[String(lineFilterCity)]?.name : null;
  return <Sheet title="Gestión de la red" onClose={onClose} suspended={confirmationOpen}>
    {screen === 'cityMenu' && city && <><div className="sheet-heading">{city.name}</div><Action onClick={() => setScreen('cityDetail')}>Ver ciudad</Action><Action onClick={() => setScreen('station')}>Ver estación</Action><Action onClick={() => onOpenStats('cities', city.id, 'Estadísticas de ' + city.name, 'cityMenu')}>Estadísticas</Action><Action onClick={() => setScreen('chooseDestination')}>Construir vía</Action><Action onClick={() => onManageCityLines(city.id)}>Gestionar líneas</Action></>}
    {screen === 'cityDetail' && city && <><div className="sheet-heading">{city.name}</div><div className="sheet-info">{formatNumber(city.population)} habitantes<br />{city.country_code} · Cuanto mayor sea su población, mayor será el potencial de ingresos.</div><Action onClick={() => setScreen('chooseDestination')}>Construir vía</Action><Action onClick={() => setScreen('cityMenu')}>Volver</Action></>}
    {screen === 'station' && city && (() => {
      const usage = stationUsage(game.lines, city.id), capacity = stationCapacity(game, city.id);
      const count = stationWaitingPassengers(game.lines, city.id), level = crowdingLevel(count);
      return <><div className="sheet-heading">Estación de {city.name}</div><div className="sheet-info">{game.tracks.filter(t => String(t.a) === String(city.id) || String(t.b) === String(city.id)).length} vías conectadas<br />{usage.present} en estación · {usage.incoming} con plaza reservada</div>
        <div className="train-count station-capacity"><span>Capacidad de la estación</span><div><button aria-label="Reducir capacidad de la estación" disabled={capacity <= 1 || capacity <= usage.total} onClick={() => onChangeStationCapacity(city.id, capacity - 1)}>−</button><strong aria-live="polite">{capacity}</strong><button aria-label="Aumentar capacidad de la estación" disabled={capacity >= MAX_STATION_CAPACITY} onClick={() => onChangeStationCapacity(city.id, capacity + 1)}>＋</button></div></div>
        <div className="station-passengers"><strong>Viajeros esperando: {formatNumber(count)} · {level.label}</strong><p>Por línea</p>{game.lines.filter(line => line.stops.some(id => String(id) === String(city.id))).map((line, index) => <div key={line.id || index}><span>{line.name}</span><strong>{formatNumber(waitingPassengers(line, city.id))}</strong></div>)}{!game.lines.some(line => line.stops.some(id => String(id) === String(city.id))) && <p>No hay líneas en esta estación.</p>}</div>
        <div className="sheet-info">Los viajeros que esperan demasiado abandonan la estación. Los trenes esperan si su destino no tiene plazas libres.</div><Action onClick={() => setScreen('tracks')}>Ver y mejorar vías</Action><Action onClick={() => setScreen('cityMenu')}>Volver</Action></>;
    })()}
    {screen === 'cities' && <><div className="sheet-heading">Ciudades cercanas</div><div className="sheet-info">Mueve el mapa para descubrir otras regiones.</div><input className="sheet-input" placeholder="Buscar en las ciudades cargadas" value={filter} onChange={event => setFilter(event.target.value)} /><div className="sheet-list">{cityList.map(c => <button className="list-row" key={c.id} onClick={() => onSelectCity(c)}><span>{c.name}</span><small>{formatNumber(c.population)} hab.</small></button>)}</div></>}
    {screen === 'confirmTrack' && from && city && (() => {
      const type = findTrackType(buildType) || TRACK_TYPES[0];
      const cost = constructionCost(from, city, type);
      return <><div className="sheet-heading">Construir vía</div>
        <div className="sheet-info">{from.name} → {city.name}<br />{formatNumber(distance(from, city))} km</div>
        <label className="track-build-label" htmlFor="build-track-type">Tipo de vía</label>
        <select className="sheet-input track-build-select" id="build-track-type" value={type.id} onChange={event => onBuildTypeChange(event.target.value)}>
          {TRACK_TYPES.map(option => <option key={option.id} value={option.id}>{option.name} · {option.speed} km/h · {option.capacity} {option.capacity === 1 ? 'tren' : 'trenes'}{option.bidirectional ? ' por sentido' : ' en el mismo sentido'} · {formatMoney(constructionCost(from, city, option))} · {formatConstructionTime(trackConstructionSeconds(distance(from, city), option) / 120)}</option>)}
        </select>
        <div className="track-build-details"><span className="track-type-dot" style={{ backgroundColor: type.color }} />{type.name} · {type.speed} km/h · {type.capacity} {type.capacity === 1 ? 'tren' : 'trenes'}{type.bidirectional ? ' por sentido' : ' en el mismo sentido'}<strong>{formatMoney(cost)}</strong></div>
        <Action onClick={onBuild} disabled={game.money < cost}>Construir vía</Action><Action onClick={onChangeDestination}>Elegir otro destino</Action></>;
    })()}
    {screen === 'tracks' && <><div className="sheet-heading">Mis vías</div><div className="sheet-list">{game.tracks.length ? game.tracks.map((t,i) => <div className="item" key={i}><strong>{cities[String(t.a)]?.name} ↔ {cities[String(t.b)]?.name}</strong><small><span className="track-type-dot" style={{ backgroundColor: trackType(t).color }} />{trackType(t).name} · {formatNumber(t.km)} km · {trackType(t).speed} km/h{t.construction ? ' · ' + (t.construction.targetType ? 'Mejora a ' + (findTrackType(t.construction.targetType)?.name || '') : 'En construcción') + ' · ' + formatConstructionTime(t.construction.remainingDays) : ''} · {trackType(t).capacity} {trackType(t).capacity === 1 ? 'tren' : 'trenes'} {trackType(t).bidirectional ? 'por sentido' : 'en el mismo sentido'}</small><button onClick={() => onChooseTrack(i)} disabled={!!t.construction}>{t.construction ? 'Obras en curso' : 'Cambiar tipo de vía'}</button></div>) : <div className="sheet-info">Todavía no hay vías. Selecciona una ciudad en el mapa para construir la primera.</div>}</div><Action onClick={() => onManageCityLines(city.id)}>Gestionar líneas</Action></>}
    {screen === 'trackTypes' && game.tracks[editingTrack] && (() => {
      const track = game.tracks[editingTrack], current = trackType(track);
      const occupied = trainsOnTrack(track, game.lines);
      return <><div className="sheet-heading">Cambiar tipo de vía</div><div className="sheet-info">{cities[String(track.a)]?.name} ↔ {cities[String(track.b)]?.name}<br />Actual: {current.name} · {occupied} {occupied === 1 ? 'tren en el tramo' : 'trenes en el tramo'}{track.construction && <><br />{track.construction.action === 'upgrade' ? 'Mejora' : 'Construcción'} en curso · {formatConstructionTime(track.construction.remainingDays)}</>}</div><div className="sheet-list">{TRACK_TYPES.map(type => {
        const active = type.id === current.id, price = conversionCost(track, type);
        const capacityBlocked = !trackFits(type, trackOccupancy(track, game.lines));
        return <div className="track-option" key={type.id}><div className="track-option-title"><span className="track-type-dot" style={{ backgroundColor: type.color }} /><strong>{type.name}</strong></div><small>{type.speed} km/h · {type.capacity} {type.capacity === 1 ? 'tren' : 'trenes'} {type.bidirectional ? 'por sentido' : 'en el mismo sentido'}</small><button onClick={() => onUpgrade(editingTrack, type.id)} disabled={active || !!track.construction || capacityBlocked || game.money < price}>{active ? 'Tipo actual' : track.construction ? 'Obra en curso' : capacityBlocked ? 'Espera a que se libere la vía' : 'Mejorar · ' + formatMoney(price)}</button></div>;
      })}</div><Action onClick={() => onOpenStats('tracks', trackStatsKey(track.a, track.b), 'Estadísticas de la vía', 'trackTypes')}>Ver estadísticas</Action><Action onClick={() => setScreen('tracks')}>Volver a mis vías</Action></>;
    })()}
    {screen === 'lines' && <><div className="sheet-heading">{filteredCityName ? 'Líneas de ' + filteredCityName : 'Gestionar líneas'}</div><div className="sheet-list">{displayedLines.length ? displayedLines.map(({ line, index: i }) => {
      const trains = lineTrains(line), trainLimit = lineTrainLimit(game, line.stops);
      return <details className="item line-accordion" name="trainworld-lines" key={line.id || i}><summary className="line-summary"><strong>{line.name}</strong><small>{line.stops.map(id => cities[String(id)]?.name).join(' → ')} · {formatMoney(estimateLineIncome(line,cities,game.tracks,game.lines,networkRates))} / día</small></summary><div className="line-accordion-content"><small>Ingresos estimados sin esperas ni congestión: {formatMoney(estimateLineIncome(line,cities,game.tracks,game.lines,networkRates))} / día</small>
        <div className="train-count"><span>Trenes en la línea · máximo {trainLimit}</span><div><button aria-label={'Reducir trenes de ' + line.name} disabled={trains.length <= 1} onClick={() => onChangeTrainCount(i, trains.length - 1)}>−</button><strong aria-live="polite">{trains.length}</strong><button aria-label={'Añadir tren a ' + line.name} disabled={trains.length >= trainLimit} onClick={() => onChangeTrainCount(i, trains.length + 1)}>＋</button></div></div>
        <small>{trainType(line).name} · {formatMoney(trainType(line).coste_al_dia * trains.length)} de gastos / día</small><Statistics stats={game.stats} group="lines" id={line.id} compact day={game.day} />
        <div className="item-actions"><button onClick={() => onEditLine(i)}>Modificar línea</button><button onClick={() => onOpenStats('lines', line.id, 'Estadísticas de ' + line.name, 'lines')}>Ver estadísticas</button><button onClick={() => onRemoveLine(i)}>Retirar línea</button></div></div></details>;
    }) : <div className="sheet-info">{filteredCityName ? 'Esta ciudad no tiene líneas.' : 'Aún no tienes líneas. Construye una vía para empezar.'}</div>}</div><Action onClick={onNewLine}>Crear línea</Action></>}
    {screen === 'newLine' && <><div className="sheet-heading">{editingLine ? 'Modificar línea' : 'Crear línea'}</div><input className="sheet-input" placeholder="Nombre de la línea" maxLength="40" value={name} onChange={event => setName(event.target.value)} /><label className="track-build-label" htmlFor="line-train-type">Tipo de tren</label><select className="sheet-input track-build-select" id="line-train-type" value={trainTypeId} onChange={event => setTrainTypeId(event.target.value)}>{TRAIN_TYPES.map(type => <option key={type.id} value={type.id}>{type.name} · {type.viajeros} plazas · hasta {type.velocidad_maxima} km/h · {formatMoney(type.coste_al_dia)} / día</option>)}</select><div className="sheet-info">{draft.length ? draft.map(id => cities[String(id)]?.name).join(' → ') : 'Elige las paradas en orden. Deben estar conectadas por vías.'}{draft.length > 0 && <><br />Máximo de trenes: {lineTrainLimit(game, draft)}</>}</div><div className="sheet-list">{linked.length === 0 && <div className="sheet-info">{draft.length ? 'No hay más ciudades disponibles con vía terminada.' : game.tracks.some(track => track.construction) ? 'Espera a que terminen las obras para elegir la primera parada.' : 'Construye una vía para elegir la primera parada.'}</div>}{linked.map(id => <button className="list-row" key={id} onClick={() => onSelectCity(cities[id])}><span>{cities[id]?.name}</span><span>＋</span></button>)}</div><Action onClick={() => onSaveLine(name, trainTypeId)} disabled={draft.length < 2 || (!editingLine && game.money < 25000)}>{editingLine ? 'Guardar cambios' : 'Poner en marcha · ' + formatMoney(25000)}</Action><Action onClick={() => setDraft(draft.slice(0,-1))} disabled={!draft.length}>Deshacer última parada</Action></>}
    {screen === 'more' && <><div className="sheet-heading">Tu compañía</div><div className="sheet-info">Día {formatNumber(game.day)} · {formatMoney(game.money)}<br />Ingresos estimados: {formatMoney(income)} / día<br />Gastos de trenes: {formatMoney(game.lines.reduce((sum, line) => sum + lineTrains(line).length * trainType(line).coste_al_dia, 0))} / día<br />{status}</div><Action onClick={() => setScreen('tracks')}>Mis vías</Action><Action onClick={onManageAllLines}>Mis líneas</Action><Action onClick={() => onOpenStats('total', 'total', 'Estadísticas de la compañía', 'more')}>Estadísticas</Action><Action onClick={() => setScreen('help')}>Cómo jugar</Action></>}
    {screen === 'statistics' && statsTarget && <><div className="sheet-heading">{statsTarget.title}</div><Statistics stats={game.stats} group={statsTarget.group} id={statsTarget.id} day={game.day} /><Action onClick={() => setScreen(statsTarget.back)}>Volver</Action></>}
    {screen === 'trainInfo' && game.lines[selectedTrain?.lineIndex] && (() => {
      const line = game.lines[selectedTrain.lineIndex], train = lineTrains(line)[selectedTrain.trainIndex], spec = trainType(line);
      if (!train) return null;
      const index = train?.stopIndex ?? 0;
      const from = cities[String(line.stops[index])];
      const to = train?.moving ? cities[String(line.stops[index + train.direction])] : null;
      const track = to && findTrack(game.tracks, from?.id, to.id);
      const statusText = train.paused ? 'Tren pausado' : game.paused ? 'Simulación en pausa' : train.moving ? 'En viaje' : 'En estación o esperando vía';
      const stats = statsFor(game.stats, 'trains', train.id), operations = journeyStatsFor(game.stats, 'trains', train.id);
      const age = trainAge(train, game.day), days = Math.max(1, age + 1), balance = stats.income - stats.expenses;
      const speed = Math.min(track ? trackType(track).speed : Infinity, trainSpeed(line, train, game.day));
      return <><div className="sheet-heading">Tren {selectedTrain.trainIndex + 1} · {line.name}</div><div className="sheet-info train-info">
        <table className="train-info-table"><tbody>
          <TrainRow label="Estado">{statusText}</TrainRow>
          <TrainRow label="Trayecto">{from?.name || '—'}{to ? ' → ' + to.name : ''}</TrainRow>
          <TrainRow label="Tipo">{spec.name}</TrainRow>
          <TrainRow label="Edad">{formatNumber(age)} {age === 1 ? 'día' : 'días'}</TrainRow>
          <TrainRow label="Velocidad máxima actual">{formatNumber(speed)} km/h{track ? ' · ' + trackType(track).name : ''}</TrainRow>
          <TrainRow label="Mantenimiento">{formatMoney(spec.coste_al_dia)} / día</TrainRow>
          <TrainRow label="Viajeros a bordo">{formatNumber(trainPassengerCount(train))} / {formatNumber(spec.viajeros)} · {trainOccupancy(train, spec.viajeros)} %</TrainRow>
          <TrainRow label="Ingresos acumulados">{formatMoney(stats.income)}</TrainRow>
          <TrainRow label="Gastos acumulados">{formatMoney(stats.expenses)}</TrainRow>
          <TrainRow label="Beneficio acumulado" emphasis>{formatMoney(balance)} · {balance > 0 ? 'Rentable' : balance < 0 ? 'Aún no rentable' : 'Sin beneficio aún'}</TrainRow>
          <TrainRow label="Ingreso medio diario">{formatMoney(stats.income / days)} / día</TrainRow>
          <TrainRow label="Gasto medio diario">{formatMoney(stats.expenses / days)} / día</TrainRow>
          <TrainRow label="Beneficio medio diario" emphasis>{formatMoney(balance / days)} / día</TrainRow>
          <TrainRow label="Tiempo medio de viaje">{averageDuration(operations.travelDays, operations.trips)}</TrainRow>
          <TrainRow label="Espera media por trayecto">{averageDuration(operations.waitDays, operations.trips)}</TrainRow>
          <TrainRow label="Ocupación media por tramo">{operations.occupancySamples ? Math.round(100 * operations.occupancySum / operations.occupancySamples) + ' %' : '—'}</TrainRow>
        </tbody></table>
      </div><Action onClick={() => onToggleTrainPause(train.id)}>{train.paused ? 'Reanudar este tren' : 'Pausar este tren'}</Action><Action onClick={onRenewTrain} disabled={game.money < TRAIN_RENEWAL_COST}>Renovar tren · {formatMoney(TRAIN_RENEWAL_COST)}</Action><Action onClick={() => onOpenStats('trains', train.id, 'Estadísticas del tren ' + (selectedTrain.trainIndex + 1), 'trainInfo')}>Estadísticas del tren</Action><Action onClick={() => onOpenStats('lines', line.id, 'Estadísticas de ' + line.name, 'trainInfo')}>Estadísticas de la línea</Action><Action onClick={() => onEditLine(selectedTrain.lineIndex)}>Modificar línea</Action></>;
    })()}
    {screen === 'help' && <><div className="sheet-heading">Cómo jugar</div><div className="sheet-info">1. Toca una ciudad y construye una vía hacia otra.<br /><br />2. Crea una línea con ciudades conectadas por vías.<br /><br />3. Reanuda el tiempo: los viajeros esperan por línea y destino; al salir, el tren recoge viajeros en su sentido hasta completar sus plazas. Los ingresos dependen de los viajeros transportados, los kilómetros y la espera del tren. Dos minutos reales equivalen a un día de juego; la velocidad de la vía se expresa en km/h de juego. Cada tipo de vía tiene una velocidad y una capacidad distintas. Las vías sencillas no permiten cruces; las de doble sentido sí. Configura la capacidad desde cada estación. Pulsa una vía del mapa o entra en Estaciones para cambiar su tipo.<br /><br />Los trenes pierden un 0,5 % de su velocidad máxima por cada día de juego, hasta un límite del 50 %. Puedes renovarlos por 25.000 € para recuperar su velocidad y empezar una nueva vida útil.</div><Action onClick={() => setScreen('more')}>Volver</Action></>}
  </Sheet>;
}
