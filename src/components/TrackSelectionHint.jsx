import { MapPin, X } from 'lucide-react';

export default function TrackSelectionHint({ city, onCancel }) {
  return <aside className="track-selection" aria-label="Seleccionar destino">
    <div className="track-selection-icon"><MapPin size={20} aria-hidden="true" /></div>
    <div className="track-selection-copy">
      <strong>Elige una ciudad en el mapa</strong>
      <span>Origen: {city.name} · Mueve o amplía el mapa</span>
    </div>
    <button onClick={onCancel} aria-label="Cancelar construcción de vía" title="Cancelar">
      <X size={19} aria-hidden="true" />
    </button>
  </aside>;
}
