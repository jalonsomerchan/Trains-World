// Cada archivo JSON de maps/ se incorpora automáticamente al selector.
const files = import.meta.glob('./maps/*.json', { eager: true, import: 'default' });
export const maps = Object.entries(files).map(([path, data]) => ({
  id: path.split('/').pop().replace(/\.json$/, ''),
  name: data.mapa.nombre,
  latitude: data.mapa.latitud,
  longitude: data.mapa.longitud,
  zoom: data.mapa.zoom,
  description: data.metadatos?.territorio || '',
  cities: data.ciudades.map(city => ({
    id: String(city.id), name: city.nombre, country_code: city.pais || '',
    latitude: city.latitud, longitude: city.longitud, population: city.poblacion,
  })),
}));
export const getMap = id => maps.find(map => map.id === id) || maps[0];
