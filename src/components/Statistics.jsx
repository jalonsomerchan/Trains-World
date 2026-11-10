import { formatMoney, formatNumber } from '../domain/game';
import { journeyStatsFor, statsFor } from '../domain/statistics';

function duration(days) {
  const minutes = Math.round(days * 24 * 60);
  if (minutes < 60) return minutes + ' min';
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours + ' h' + (rest ? ' ' + rest + ' min' : '');
}

export default function Statistics({ stats, group, id, compact = false, day = 1 }) {
  const values = statsFor(stats, group, id);
  const operational = ['lines', 'tracks', 'trains'].includes(group) && !compact;
  const trips = journeyStatsFor(stats, group, id);
  const count = trips.trainIds.length;
  return <div className="statistics">
    <div><span>Ingresos</span><strong className="statistics-income">{formatMoney(values.income)}</strong></div>
    <div><span>Gastos</span><strong>{formatMoney(values.expenses)}</strong></div>
    <div><span>Balance</span><strong>{formatMoney(values.income - values.expenses)}</strong></div>
    {group !== 'cities' && <><div><span>Ingreso medio diario</span><strong>{formatMoney(values.income / Math.max(1, day - 1))} / día</strong></div><div><span>Gasto medio diario</span><strong>{formatMoney(values.expenses / Math.max(1, day - 1))} / día</strong></div></>}
    {operational && <>
      <div><span>Trayectos completados</span><strong>{formatNumber(trips.trips)}</strong></div>
      <div><span>Tiempo medio de viaje</span><strong>{trips.trips ? duration(trips.travelDays / trips.trips) : '—'}</strong></div>
      <div><span>Espera media por trayecto</span><strong>{trips.trips ? duration(trips.waitDays / trips.trips) : '—'}</strong></div>
      <div><span>Espera total</span><strong>{trips.trips ? duration(trips.waitDays) : '—'}</strong></div>
      <div><span>Trenes distintos</span><strong>{formatNumber(count)}</strong></div>
      <div><span>Ingreso medio por tren</span><strong>{count ? formatMoney(trips.income / count) : '—'}</strong></div>
      <div><span>Ingreso medio por trayecto</span><strong>{trips.trips ? formatMoney(trips.income / trips.trips) : '—'}</strong></div>
      <div><span>Gasto medio por trayecto</span><strong>{trips.trips ? formatMoney(values.expenses / trips.trips) : '—'}</strong></div>
      <div><span>Ocupación media por tramo</span><strong>{trips.occupancySamples ? Math.round(100 * trips.occupancySum / trips.occupancySamples) + ' %' : '—'}</strong></div>
      <div><span>Viajeros transportados por tramo</span><strong>{formatNumber(trips.passengers)}</strong></div>
    </>}
    <p>{operational ? 'Tiempos de juego por tramo completado. La espera corresponde a la estación de salida. Los viajeros se cuentan por cada tramo recorrido; las cifras medias usan los trayectos registrados.' : 'Registrados desde que se activaron las estadísticas. Los costes de construcción se reparten entre ciudades y vías; el mantenimiento se registra en trenes, líneas y vías.'}</p>
  </div>;
}
