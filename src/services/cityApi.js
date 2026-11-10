import { loadCache, saveCache } from './storage';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000;
export function normalizeCity(raw) {
  const city = {
    id: String(raw.id), name: raw.name, population: Number(raw.population) || 0,
    latitude: Number(raw.latitude), longitude: Number(raw.longitude), country_code: raw.country_code || '',
  };
  return raw.id != null && city.name && Number.isFinite(city.latitude) && Number.isFinite(city.longitude) ? city : null;
}
export function areaKey(latitude, longitude) {
  return Math.round(latitude * 2) / 2 + ',' + Math.round(longitude * 2) / 2;
}
export async function fetchNearbyCities(latitude, longitude, signal) {
  const lat = Math.round(latitude * 2) / 2;
  const lng = Math.round(longitude * 2) / 2;
  const key = areaKey(latitude, longitude);
  const cache = loadCache();
  if (cache[key] && Date.now() - cache[key].time < CACHE_DURATION) {
    return { cities: cache[key].data.map(normalizeCity).filter(Boolean), cached: true, limited: cache[key].limited };
  }
  const url = new URL(import.meta.env.VITE_CITY_API_URL || 'https://alon.one/api/trainworld/nearby');
  url.search = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) });
  if (!response.ok) throw new Error('API de ciudades: ' + response.status);
  const result = await response.json();
  if (!Array.isArray(result.data)) throw new Error('Respuesta de CityAPI no válida');
  cache[key] = { time: Date.now(), data: result.data, limited: !!result.meta?.has_more };
  saveCache(cache);
  return { cities: result.data.map(normalizeCity).filter(Boolean), cached: false, limited: !!result.meta?.has_more };
}
