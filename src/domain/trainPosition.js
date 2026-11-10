import { trackGeometry } from './trackGeometry';
import { distance } from './game';

// Follow the same sampled geometry used to draw the track. Crossings of the
// antimeridian are separate segments, never a jump across the whole map.
export function trainPosition(from, to, progress) {
  const geometry = trackGeometry(from, to);
  const segments = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
  const pieces = [];
  let total = 0;
  for (const segment of segments) {
    for (let i = 1; i < segment.length; i++) {
      const a = segment[i - 1], b = segment[i];
      const length = distance({ longitude: a[0], latitude: a[1] }, { longitude: b[0], latitude: b[1] });
      pieces.push({ a, b, length });
      total += length;
    }
  }
  if (!total) return [from.longitude, from.latitude];
  let remaining = Math.max(0, Math.min(1, progress)) * total;
  for (const piece of pieces) {
    if (remaining <= piece.length) {
      const t = piece.length ? remaining / piece.length : 0;
      return [piece.a[0] + (piece.b[0] - piece.a[0]) * t, piece.a[1] + (piece.b[1] - piece.a[1]) * t];
    }
    remaining -= piece.length;
  }
  return [to.longitude, to.latitude];
}
