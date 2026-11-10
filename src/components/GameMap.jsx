import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrainFront } from 'lucide-react';
import { avoidMarkerCollisions, cityDiameter, visibleCities } from '../domain/mapDisplay';
import { trackGeometry } from '../domain/trackGeometry';
import { trainPosition } from '../domain/trainPosition';
import { formatMoney } from '../domain/game';
import { formatConstructionTime, trackType } from '../domain/trackTypes';
import { lineTrains } from '../domain/trains';
import { trainType } from '../domain/trainTypes';
import { crowdingLevel, stationWaitingPassengers, trainOccupancy } from '../domain/passengers';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

function recolorMap(map) {
  const layers = map.getStyle()?.layers || [];
  for (const layer of layers) {
    try {
      if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#4a5a69');
      if (layer.type === 'fill') {
        const id = layer.id.toLowerCase();
        map.setPaintProperty(layer.id, 'fill-color', id.includes('water') ? '#384b5a' : '#4a5a69');
        map.setPaintProperty(layer.id, 'fill-opacity', 1);
      }
      if (layer.type === 'line') {
        map.setPaintProperty(layer.id, 'line-color', layer.id.toLowerCase().includes('water') ? '#415462' : '#263746');
        map.setPaintProperty(layer.id, 'line-opacity', .85);
      }
      if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none');
    } catch { /* Los estilos del proveedor pueden variar entre versiones. */ }
  }
}

export default function GameMap({ cities, tracks, lines, arrivals, onCityClick, onTrainClick, onTrackClick, trackSelectionEnabled, mapConfig, zoomRequest, onMapStatus, selectedOrigin, previewTrack }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const trainMarkers = useRef(new Map());
  const constructionMarkers = useRef(new Map());
  const arrivalMarkers = useRef(new Map());
  const lastArrivalId = useRef(null);
  const [viewport, setViewport] = useState({ zoom: mapConfig.zoom, revision: 0 });
  const callbacks = useRef({ onCityClick, onTrainClick, onTrackClick, trackSelectionEnabled, onMapStatus });
  callbacks.current = { onCityClick, onTrainClick, onTrackClick, trackSelectionEnabled, onMapStatus };

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current, style: STYLE_URL, center: [mapConfig.longitude, mapConfig.latitude], zoom: mapConfig.zoom,
      attributionControl: false, maxZoom: 15, minZoom: 2, renderWorldCopies: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => { recolorMap(map); callbacks.current.onMapStatus('ready'); });
    map.on('error', event => { if (!map.isStyleLoaded()) callbacks.current.onMapStatus('error'); });
    const trackAtPoint = point => {
      if (!callbacks.current.trackSelectionEnabled || !map.getLayer('trainworld-tracks')) return null;
      const radius = 14;
      const features = map.queryRenderedFeatures(
        [[point.x - radius, point.y - radius], [point.x + radius, point.y + radius]],
        { layers: ['trainworld-tracks'] }
      );
      return features.length ? features[0] : null;
    };
    map.on('click', event => {
      const track = trackAtPoint(event.point);
      if (track && Number.isInteger(Number(track.properties.index))) callbacks.current.onTrackClick(Number(track.properties.index));
    });
    map.on('mousemove', event => {
      map.getCanvas().style.cursor = trackAtPoint(event.point) ? 'pointer' : '';
    });
    map.on('moveend', () => {
      setViewport(previous => ({ zoom: map.getZoom(), revision: previous.revision + 1 }));
    });
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      trainMarkers.current.forEach(marker => marker.remove());
      trainMarkers.current.clear();
      constructionMarkers.current.forEach(marker => marker.remove());
      constructionMarkers.current.clear();
      arrivalMarkers.current.forEach(({ marker, timer }) => { clearTimeout(timer); marker.remove(); });
      arrivalMarkers.current.clear();
      map.remove(); mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !zoomRequest) return;
    map.zoomTo(map.getZoom() + zoomRequest.direction, { duration: 250 });
  }, [zoomRequest]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    const bounds = map.getBounds();
    const visible = visibleCities(cities, tracks, viewport.zoom,
      city => bounds.contains([city.longitude, city.latitude]));
    const uncluttered = avoidMarkerCollisions(visible, tracks, city => map.project([city.longitude, city.latitude]));
    const stationIds = new Set(tracks.flatMap(track => [String(track.a), String(track.b)]));
    for (const city of uncluttered) {
      const element = document.createElement('button');
      element.type = 'button';
      element.dataset.cityId = String(city.id);
      const hasStation = stationIds.has(String(city.id));
      element.className = 'city-marker' + (hasStation ? ' city-marker-station' : '') + (String(city.id) === String(selectedOrigin) ? ' city-marker-origin' : '');
      const baseLabel = city.name + ', ' + new Intl.NumberFormat('es-ES').format(city.population) + ' habitantes' + (hasStation ? ', con estación' : '');
      element.dataset.baseLabel = baseLabel;
      element.setAttribute('aria-label', baseLabel);
      const size = cityDiameter(city.population);
      const circle = document.createElement('span');
      circle.className = 'city-circle';
      circle.style.width = size + 'px';
      circle.style.height = size + 'px';
      const label = document.createElement('span');
      label.className = 'city-name';
      label.textContent = city.name;
      element.append(circle, label);
      if (hasStation) {
        const badge = document.createElement('span');
        badge.className = 'station-crowding';
        badge.hidden = true;
        badge.setAttribute('aria-hidden', 'true');
        badge.style.left = `calc(50% + ${size / 2 - 3}px)`;
        element.append(badge);
      }
      element.addEventListener('click', event => { event.stopPropagation(); callbacks.current.onCityClick(city); });
      markersRef.current.push(new maplibregl.Marker({ element, anchor: 'center' }).setLngLat([city.longitude, city.latitude]).addTo(map));
    }
  }, [cities, tracks, viewport, selectedOrigin]);

  useEffect(() => {
    const served = new Set(lines.flatMap(line => line.stops.map(String)));
    for (const marker of markersRef.current) {
      const element = marker.getElement(), badge = element.querySelector('.station-crowding');
      if (!badge) continue;
      const id = element.dataset.cityId;
      badge.hidden = !served.has(id);
      if (badge.hidden) {
        element.setAttribute('aria-label', element.dataset.baseLabel);
        element.removeAttribute('title');
        continue;
      }
      const count = stationWaitingPassengers(lines, id), level = crowdingLevel(count);
      const description = `${level.label}: ${new Intl.NumberFormat('es-ES').format(count)} viajeros esperando`;
      badge.className = 'station-crowding station-crowding-' + level.id;
      badge.textContent = count > 999 ? '999+' : String(count);
      element.title = description;
      element.setAttribute('aria-label', element.dataset.baseLabel + ', ' + description);
    }
  }, [lines, cities, tracks, viewport, selectedOrigin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const renderTracks = () => {
      if (!map.isStyleLoaded()) return;
      const data = { type: 'FeatureCollection', features: tracks.flatMap((track, index) => {
        const a = cities[String(track.a)], b = cities[String(track.b)];
        if (!a || !b) return [];
        return [{ type: 'Feature', properties: { color: trackType(track).color, index, underConstruction: !!track.construction }, geometry: trackGeometry(a, b) }];
      }) };
      const source = map.getSource('trainworld-tracks');
      if (source) source.setData(data);
      else {
        map.addSource('trainworld-tracks', { type: 'geojson', data });
        const rounded = { 'line-cap': 'round', 'line-join': 'round' };
        // At a regional scale the colored line stays readable; zooming in
        // reveals ballast, sleepers and two rails instead of a thick stripe.
        map.addLayer({ id: 'trainworld-tracks-casing', type: 'line', source: 'trainworld-tracks', layout: rounded,
          paint: { 'line-color': '#1b2930', 'line-opacity': .85, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 4, 10, 7, 15, 13] } });
        map.addLayer({ id: 'trainworld-tracks', type: 'line', source: 'trainworld-tracks', layout: rounded,
          paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2, 10, 3, 15, 8], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 1, 12, .55] } });
        map.addLayer({ id: 'trainworld-track-sleepers', type: 'line', source: 'trainworld-tracks', minzoom: 10,
          layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: { 'line-color': '#35434a', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 15, 9], 'line-dasharray': [0.35, 1.2], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 12, .9] } });
        map.addLayer({ id: 'trainworld-track-rails', type: 'line', source: 'trainworld-tracks', minzoom: 10, layout: rounded,
          paint: { 'line-color': '#e4e9e5', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, .7, 15, 1.5], 'line-gap-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 5], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0, 12, .95] } });
        map.addLayer({ id: 'trainworld-tracks-building', type: 'line', source: 'trainworld-tracks', filter: ['==', ['get', 'underConstruction'], true], layout: rounded, paint: { 'line-color': '#fff0a3', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 3, 10, 5, 15, 10], 'line-dasharray': [1, 1.3], 'line-opacity': .95 } });
      }
    };
    if (map.isStyleLoaded()) renderTracks();
    else map.once('load', renderTracks);
    return () => map.off('load', renderTracks);
  }, [tracks, cities]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const active = new Set();
    tracks.forEach((track, index) => {
      if (!track.construction) return;
      const a = cities[String(track.a)], b = cities[String(track.b)];
      if (!a || !b) return;
      const key = String(index), geometry = trackGeometry(a, b);
      const coordinates = geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates[0];
      const position = coordinates[Math.floor(coordinates.length / 2)];
      active.add(key);
      let marker = constructionMarkers.current.get(key);
      if (!marker) {
        const element = document.createElement('span');
        element.className = 'construction-countdown';
        element.setAttribute('role', 'status');
        marker = new maplibregl.Marker({ element, anchor: 'center' }).setLngLat(position).addTo(map);
        constructionMarkers.current.set(key, marker);
      }
      const remaining = formatConstructionTime(track.construction.remainingDays);
      marker.getElement().textContent = remaining;
      marker.getElement().title = (track.construction.action === 'upgrade' ? 'Mejora en curso' : 'Construcción en curso') + ' · ' + remaining + ' restantes';
      marker.setLngLat(position);
    });
    constructionMarkers.current.forEach((marker, key) => {
      if (!active.has(key)) { marker.remove(); constructionMarkers.current.delete(key); }
    });
  }, [tracks, cities]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const renderPreview = () => {
      if (!map.isStyleLoaded()) return;
      const a = previewTrack && cities[String(previewTrack.a)];
      const b = previewTrack && cities[String(previewTrack.b)];
      const data = { type: 'FeatureCollection', features: a && b ? [{
        type: 'Feature', properties: {},
        geometry: trackGeometry(a, b),
      }] : [] };
      const source = map.getSource('trainworld-preview');
      if (source) {
        source.setData(data);
        map.setPaintProperty('trainworld-preview', 'line-color', previewTrack?.color || '#b4edff');
      }
      else {
        map.addSource('trainworld-preview', { type: 'geojson', data });
        map.addLayer({ id: 'trainworld-preview', type: 'line', source: 'trainworld-preview',
          paint: { 'line-color': previewTrack?.color || '#b4edff', 'line-width': 3, 'line-dasharray': [2, 2] },
          layout: { 'line-cap': 'round', 'line-join': 'round' } });
      }
    };
    if (map.isStyleLoaded()) renderPreview();
    else map.once('load', renderPreview);
    return () => map.off('load', renderPreview);
  }, [previewTrack?.a, previewTrack?.b, previewTrack?.color, cities]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const active = new Set();
    lines.forEach((line, index) => lineTrains(line).forEach((train, trainIndex) => {
      const stopIndex = train?.stopIndex ?? 0;
      const from = cities[String(line.stops[stopIndex])];
      const to = train?.moving && cities[String(line.stops[stopIndex + train.direction])];
      if (!from) return;
      const position = to ? trainPosition(from, to, train.progress) : [from.longitude, from.latitude];
      const key = index + ':' + trainIndex;
      active.add(key);
      let marker = trainMarkers.current.get(key);
      if (!marker) {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'train-marker';
        element.addEventListener('click', event => {
          event.stopPropagation();
          if (callbacks.current.trackSelectionEnabled) callbacks.current.onTrainClick(index, trainIndex);
        });
        element.innerHTML = renderToStaticMarkup(createElement(TrainFront, { size: 16, strokeWidth: 2.4, 'aria-hidden': true }));
        const badge = document.createElement('span');
        badge.className = 'train-occupancy';
        badge.setAttribute('aria-hidden', 'true');
        element.append(badge);
        marker = new maplibregl.Marker({ element, anchor: 'center' }).setLngLat(position).addTo(map);
        trainMarkers.current.set(key, marker);
      }
      const occupancy = trainOccupancy(train, trainType(line).viajeros);
      marker.getElement().querySelector('.train-occupancy').textContent = occupancy + '%';
      marker.getElement().title = line.name + (train?.paused ? ' · Tren pausado' : train?.moving ? ' · En viaje' : ' · En estación o esperando vía') + ' · Ocupación: ' + occupancy + '%';
      marker.getElement().setAttribute('aria-label', 'Ver tren ' + (trainIndex + 1) + ' de ' + line.name + ', ocupación ' + occupancy + ' %');
      marker.getElement().classList.toggle('train-marker-waiting', !!train && !train.moving);
      marker.getElement().classList.toggle('train-marker-paused', !!train?.paused);
      marker.setLngLat(position);
    }));
    trainMarkers.current.forEach((marker, key) => {
      if (!active.has(key)) { marker.remove(); trainMarkers.current.delete(key); }
    });
  }, [lines, cities]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Do not replay a previously saved notification on page load.
    if (lastArrivalId.current === null) {
      lastArrivalId.current = Math.max(0, ...arrivals.map(event => event.id));
      return;
    }
    for (const event of arrivals) {
      if (event.id <= lastArrivalId.current) continue;
      const city = cities[String(event.cityId)];
      if (!city) continue;
      const element = document.createElement('div');
      element.className = 'arrival-badge';
      element.setAttribute('aria-hidden', 'true');
      element.tabIndex = -1;
      element.textContent = '+ ' + formatMoney(event.amount);
      const marker = new maplibregl.Marker({ element, anchor: 'bottom', offset: [0, -20] })
        .setLngLat([city.longitude, city.latitude]).addTo(map);
      const timer = setTimeout(() => { marker.remove(); arrivalMarkers.current.delete(event.id); }, 2400);
      arrivalMarkers.current.set(event.id, { marker, timer });
    }
    lastArrivalId.current = Math.max(lastArrivalId.current, ...arrivals.map(event => event.id));
  }, [arrivals, cities]);

  return <div className="map" ref={containerRef} aria-label="Mapa interactivo de ciudades y vías" />;
}
