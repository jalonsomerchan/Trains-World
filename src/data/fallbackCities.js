// Datos de reserva para poder comenzar si CityAPI no responde.
export const fallbackCities = [
  [3117735, 'Madrid', 3266126, 40.4165, -3.7026, 'ES'],
  [2520600, 'Cáceres', 96068, 39.4765, -6.3722, 'ES'],
  [2510610, 'Mérida', 59548, 38.9161, -6.3437, 'ES'],
  [2509954, 'Badajoz', 150984, 38.8779, -6.9706, 'ES'],
  [2267057, 'Lisboa', 545796, 38.7167, -9.1333, 'PT'],
  [2510042, 'Sevilla', 684234, 37.3828, -5.9732, 'ES'],
  [2508270, 'Valladolid', 299265, 41.6552, -4.7237, 'ES'],
  [2510409, 'Salamanca', 144825, 40.9701, -5.6635, 'ES'],
  [2519256, 'Toledo', 85811, 39.8581, -4.0226, 'ES'],
  [2519233, 'Talavera de la Reina', 83303, 39.9635, -4.8308, 'ES'],
  [2519240, 'Trujillo', 8957, 39.4579, -5.882, 'ES'],
  [2516489, 'Plasencia', 40068, 40.0312, -6.0885, 'ES'],
  [2512911, 'Évora', 55620, 38.5714, -7.9135, 'PT'],
  [2513416, 'Córdoba', 325708, 37.8916, -4.7728, 'ES'],
].map(([id, name, population, latitude, longitude, country_code]) => ({
  id: String(id), name, population, latitude, longitude, country_code,
}));
