// app/tabs/utils.js

// re-use your existing getDistance function to compute point-to-point distance
function getDistance(c1, c2) {
  if (!c1 || !c2) return Infinity;
  const toRad = x => (x * Math.PI) / 180;
  const R = 6371000; // earth radius in meters
  const dLat = toRad(c2.latitude - c1.latitude);
  const dLon = toRad(c2.longitude - c1.longitude);
  const lat1 = toRad(c1.latitude);
  const lat2 = toRad(c2.latitude);
  const a =
    Math.sin(dLat/2) ** 2 +
    Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// distance from point P to the segment VW (in meters)
function distanceToSegment(P, V, W) {
  const l2 = getDistance(V, W)**2;
  if (l2 === 0) return getDistance(P, V);
  // projection t of P onto VW, clamped [0,1]
  const t = Math.max(
    0,
    Math.min(
      1,
      (( (P.latitude - V.latitude)*(W.latitude - V.latitude) +
         (P.longitude - V.longitude)*(W.longitude - V.longitude)
      ) / l2)
    )
  );
  const proj = {
    latitude:  V.latitude  + t*(W.latitude  - V.latitude),
    longitude: V.longitude + t*(W.longitude - V.longitude),
  };
  return getDistance(P, proj);
}

/**
 * Returns the minimum distance (in meters) from `point` to any segment
 * in the polyline array of { latitude, longitude }.
 */
export function distanceFromPolyline(point, polyline = []) {
  if (!polyline.length) return Infinity;
  let min = Infinity;
  for (let i = 0; i + 1 < polyline.length; i++) {
    const d = distanceToSegment(point, polyline[i], polyline[i+1]);
    if (d < min) min = d;
  }
  return min;
}

// …existing export distanceFromPolyline

const toRad = deg => deg * Math.PI / 180;
const toDeg = rad => rad * 180 / Math.PI;

/**
 * Returns the compass bearing (0–360°) from start → end.
 */
export function calculateBearing(start, end) {
  const φ1 = toRad(start.latitude);
  const φ2 = toRad(end.latitude);
  const Δλ = toRad(end.longitude - start.longitude);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
