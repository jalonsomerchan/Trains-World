// Population thresholds make the map readable at world and regional scales.
export function minimumPopulation(zoom) {
  if (zoom < 4) return 1000000;
  if (zoom < 6) return 250000;
  if (zoom < 8) return 50000;
  if (zoom < 10) return 10000;
  if (zoom < 12) return 1000;
  return 1;
}

// Circle area, rather than diameter, grows with population. Bounds preserve
// a usable touch target for small towns and avoid obscuring the map.
export function cityDiameter(population) {
  return Math.min(64, Math.max(12, 10 + 44 * Math.sqrt(Math.max(0, population) / 3300000)));
}

export function visibleCities(cities, tracks, zoom, contains) {
  const connected = new Set(tracks.flatMap(track => [String(track.a), String(track.b)]));
  const candidates = Object.values(cities).filter(city =>
    contains(city) && (connected.has(String(city.id)) || city.population >= minimumPopulation(zoom))
  );
  const fixed = candidates.filter(city => connected.has(String(city.id)));
  const others = candidates.filter(city => !connected.has(String(city.id)))
    .sort((a, b) => b.population - a.population).slice(0, 250);
  return [...fixed, ...others];
}

// Keep connected cities even when labels overlap; otherwise give space to the
// most populous places first so dense metropolitan areas remain readable.
export function avoidMarkerCollisions(cities, tracks, project) {
  const connected = new Set(tracks.flatMap(track => [String(track.a), String(track.b)]));
  const ordered = [...cities].sort((a, b) =>
    Number(connected.has(String(b.id))) - Number(connected.has(String(a.id)))
    || b.population - a.population
  );
  const occupied = [];
  return ordered.filter(city => {
    const point = project(city);
    const diameter = cityDiameter(city.population);
    const halfWidth = Math.max(diameter / 2, Math.min(150, city.name.length * 6.5) / 2) + 6;
    const box = { left: point.x - halfWidth, right: point.x + halfWidth, top: point.y - diameter / 2 - 3, bottom: point.y + diameter / 2 + 23 };
    const overlaps = occupied.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top);
    if (overlaps && !connected.has(String(city.id))) return false;
    occupied.push(box);
    return true;
  });
}
