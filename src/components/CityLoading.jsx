import { TrainFront } from 'lucide-react';

export default function CityLoading() {
  return <div className="city-loading" role="status" aria-live="polite">
    <div className="city-loading-content">
      <div className="city-loading-icon"><TrainFront size={28} strokeWidth={1.7} aria-hidden="true" /></div>
      <span className="city-loading-spinner" aria-hidden="true" />
      <h1>Cargando ciudades</h1>
      <p>Preparando el mapa de tu red ferroviaria…</p>
    </div>
  </div>;
}
