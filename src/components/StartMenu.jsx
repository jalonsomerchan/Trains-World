import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Compass, Info, Play, TrainFront } from 'lucide-react';

export default function StartMenu({ maps, saved, onContinue, onNewGame }) {
  const [page, setPage] = useState('menu');
  const [selected, setSelected] = useState(maps[0]?.id);
  const start = () => {
    if (saved && !window.confirm('Ya existe una partida guardada. ¿Quieres sustituirla por una partida nueva?')) return;
    onNewGame(selected);
  };
  return <main className="start-screen">
    <div className="start-decoration" aria-hidden="true"><span /><span /><span /></div>
    <section className="start-panel">
      <div className="start-brand"><span className="start-logo"><TrainFront size={27} /></span><span>TRAINWORLD <small>FERROCARRIL · ESTRATEGIA</small></span></div>
      {page !== 'menu' && <button className="start-back" onClick={() => setPage('menu')}><ArrowLeft size={17} /> Menú principal</button>}
      {page === 'menu' && <>
        <div className="start-intro"><span className="start-eyebrow">TU RED, TU HISTORIA</span><h1>Conecta ciudades.<br /><em>Mueve el mundo.</em></h1><p>Construye vías, crea líneas y haz crecer tu propia red ferroviaria.</p></div>
        <nav className="start-actions" aria-label="Menú principal">
          <button className="start-primary" onClick={() => setPage('maps')}><span><Play size={19} fill="currentColor" /> Nuevo juego</span><ArrowRight size={19} /></button>
          <button onClick={onContinue} disabled={!saved}><span><TrainFront size={19} /> Continuar</span><span className="start-hint">{saved ? 'Partida guardada' : 'Sin partida guardada'}</span></button>
          <button onClick={() => setPage('help')}><span><BookOpen size={19} /> Cómo jugar</span><ArrowRight size={18} /></button>
          <button onClick={() => setPage('about')}><span><Info size={19} /> About</span><ArrowRight size={18} /></button>
        </nav>
      </>}
      {page === 'maps' && <div className="start-page"><span className="start-eyebrow">NUEVA PARTIDA</span><h1>Elige tu mapa</h1><p>Selecciona el territorio donde comenzará tu red.</p><div className="map-options">{maps.map(map => <button key={map.id} className={'map-option' + (selected === map.id ? ' selected' : '')} onClick={() => setSelected(map.id)} aria-pressed={selected === map.id}><Compass size={24} /><span><strong>{map.name}</strong><small>{map.description} · {map.cities.length} ciudades</small></span><span className="map-radio" /></button>)}</div><button className="start-primary start-launch" disabled={!selected} onClick={start}>Comenzar partida <ArrowRight size={19} /></button></div>}
      {page === 'help' && <div className="start-page"><span className="start-eyebrow">GUÍA DE VIAJE</span><h1>Cómo jugar</h1><p>De tu primera vía a una red en movimiento.</p><ol className="help-steps"><li><strong>Construye una vía</strong><span>Selecciona una ciudad y elige otra como destino. Escoge el tipo de vía y confirma la construcción.</span></li><li><strong>Crea una línea</strong><span>En «Más → Mis líneas», selecciona en orden ciudades conectadas por vías.</span></li><li><strong>Pon los trenes en marcha</strong><span>Reanuda la simulación. Los viajeros esperan en las estaciones y los trenes cobran según las personas transportadas, la distancia y las esperas.</span></li><li><strong>Haz crecer tu red</strong><span>Mejora las vías para cambiar su velocidad y capacidad. Cada dos minutos reales equivalen a un día de juego.</span></li></ol></div>}
      {page === 'about' && <div className="start-page"><span className="start-eyebrow">ACERCA DEL JUEGO</span><h1>Trainworld</h1><p>Un juego de gestión ferroviaria para construir conexiones entre ciudades.</p><div className="about-card">El mapa utiliza OpenFreeMap, OpenMapTiles y datos de OpenStreetMap. Las ciudades se cargan desde los mapas incluidos en el juego.</div></div>}
    </section>
    <div className="start-footer">CADA CONEXIÓN CUENTA <span>●</span> TRAINWORLD</div>
  </main>;
}
