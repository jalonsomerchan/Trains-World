import { CircleDollarSign, Globe2, Minus, MoreHorizontal, Plus, Route, TrainFront } from 'lucide-react';
import { compactMoney, formatMoney } from '../domain/game';

export function TopControls({ game, income, expenses = 0, onSpeedChange, onZoom }) {
  return <header className="top-controls">
    <div className="balance" title={'Capital disponible: ' + formatMoney(game.money) + ' · Ingresos estimados: ' + formatMoney(income) + ' al día · Gastos de trenes: ' + formatMoney(expenses) + ' al día'}>
      <span className="balance-icon"><CircleDollarSign size={19} strokeWidth={2} /></span>
      <span className="balance-copy"><span className="control-caption">CAPITAL</span><strong>{compactMoney(game.money)}</strong></span>
    </div>
    <div className="top-actions">
      <select className="speed-selector" value={game.paused ? '0' : String(game.speed || 1)} onChange={event => onSpeedChange(Number(event.target.value))} aria-label="Velocidad de simulación" title="Velocidad de simulación">
        <option value="0">Pausa</option><option value="1">×1</option><option value="2">×2</option><option value="5">×5</option><option value="10">×10</option>
      </select>
      <div className="zoom-controls">
        <button className="square-button" onClick={() => onZoom(-1)} aria-label="Alejar mapa"><Minus size={19}/></button>
        <button className="square-button" onClick={() => onZoom(1)} aria-label="Acercar mapa"><Plus size={19}/></button>
      </div>
    </div>
  </header>;
}
export function BottomNav({ onOpen }) {
  return <nav className="bottom-nav" aria-label="Menú principal">
    <button onClick={() => onOpen('cities')}><Globe2 size={22} strokeWidth={1.8}/><span>Ciudades</span></button>
    <button onClick={() => onOpen('tracks')}><TrainFront size={22} strokeWidth={1.8}/><span>Vías</span></button>
    <button onClick={() => onOpen('lines')}><Route size={22} strokeWidth={1.8}/><span>Líneas</span></button>
    <button onClick={() => onOpen('more')}><MoreHorizontal size={23} strokeWidth={2}/><span>Más</span></button>
  </nav>;
}
