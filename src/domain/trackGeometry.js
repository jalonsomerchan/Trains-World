// The shortest route on the globe provides a neutral alignment without inventing
// bends or suggesting that terrain or existing railways have been surveyed.
const MAX_LATITUDE = 85.05112878;
const radians = Math.PI / 180;

function latitudeFromY(y) {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) / radians;
}
function longitudeFromX(x) {
  return ((x * 360) % 360 + 360) % 360 - 180;
}
function vector(city) {
  const lat = city.latitude * radians, lon = city.longitude * radians;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}
function projectedPoint(v, previousX) {
  const longitude = Math.atan2(v[1], v[0]) / radians;
  const latitude = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, Math.atan2(v[2], Math.hypot(v[0], v[1])) / radians));
  let x = (longitude + 180) / 360;
  if (previousX !== undefined) x += Math.round(previousX - x);
  return [x, (1 - Math.asinh(Math.tan(latitude * radians)) / Math.PI) / 2];
}

function splitAtAntimeridian(points) {
  const segments = [[[longitudeFromX(points[0][0]), latitudeFromY(points[0][1])]]];
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1], current = points[i];
    const previousWorld = Math.floor(previous[0]), currentWorld = Math.floor(current[0]);
    if (previousWorld !== currentWorld) {
      const east = current[0] > previous[0];
      const boundary = east ? currentWorld : previousWorld;
      const ratio = (boundary - previous[0]) / (current[0] - previous[0]);
      const lat = latitudeFromY(previous[1] + ratio * (current[1] - previous[1]));
      segments[segments.length - 1].push([east ? 180 : -180, lat]);
      segments.push([[east ? -180 : 180, lat]]);
    }
    segments[segments.length - 1].push([longitudeFromX(current[0]), latitudeFromY(current[1])]);
  }
  return segments;
}

export function trackGeometry(first, second) {
  const order = first.longitude - second.longitude || first.latitude - second.latitude;
  const reversed = order > 0;
  const a = reversed ? second : first, b = reversed ? first : second;
  const start = vector(a), end = vector(b);
  const dot = Math.max(-1, Math.min(1, start.reduce((sum, value, i) => sum + value * end[i], 0)));
  const angle = Math.acos(dot);
  if (Math.hypot(...start.map((value, i) => value - end[i])) < 1e-10) return { type: 'LineString', coordinates: [[first.longitude, first.latitude], [second.longitude, second.latitude]] };
  // A stable perpendicular also defines a route for exactly antipodal points.
  let tangent = end.map((value, i) => value - dot * start[i]);
  let magnitude = Math.hypot(...tangent);
  if (magnitude < 1e-10) {
    const axis = Math.abs(start[2]) < .9 ? [0, 0, 1] : [0, 1, 0];
    const projection = start.reduce((sum, value, i) => sum + value * axis[i], 0);
    tangent = axis.map((value, i) => value - projection * start[i]);
    magnitude = Math.hypot(...tangent);
  }
  tangent = tangent.map(value => value / magnitude);
  const steps = Math.max(16, Math.min(256, Math.ceil(angle / radians * 2)));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = angle * i / steps;
    const point = start.map((value, j) => value * Math.cos(t) + tangent[j] * Math.sin(t));
    points.push(projectedPoint(point, points.at(-1)?.[0]));
  }
  let segments = splitAtAntimeridian(points);
  // Preserve exact city coordinates instead of projection round-off.
  segments[0][0] = [a.longitude, a.latitude];
  segments[segments.length - 1][segments[segments.length - 1].length - 1] = [b.longitude, b.latitude];
  if (reversed) segments = segments.reverse().map(segment => segment.reverse());
  return segments.length === 1
    ? { type: 'LineString', coordinates: segments[0] }
    : { type: 'MultiLineString', coordinates: segments };
}
