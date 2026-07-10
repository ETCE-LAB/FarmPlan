import { TREELINE_PATTERN, TREELINE_CYCLE_M } from './constants';


/**
 * Generate all treeline center x-positions (in metres from the western bounding
 * edge) that fit inside the polygon's bounding box.
 */
function generateTreelineCenterXPositions(boundingWidthM) {
  const positions = []; // { xM, widthM }
  let cycle = 0;
  while (true) {
    for (const { widthM, centerOffsetInCycle } of TREELINE_PATTERN) {
      const xM = cycle * TREELINE_CYCLE_M + centerOffsetInCycle;
      if (xM - widthM / 2 > boundingWidthM) return positions;
      positions.push({ xM, widthM });
    }
    cycle++;
  }
}

/**
 * Clip a vertical strip (xLeft..xRight in metres from west edge) against the
 * polygon and return an array of lat/lng polyline segments running N→S.
 *
 * Strategy: sample the polygon at many latitude steps and collect contiguous
 * runs where the strip centre falls inside the polygon.
 */
function computeTreelineSegments(polygon, refLat, refLng, xCenterM, halfWidthM, mPerDegLat, mPerDegLng) {
  // Project polygon to metres
  const projPoly = polygon.map(p => ({
    x: (p.lng - refLng) * mPerDegLng,
    y: (p.lat - refLat) * mPerDegLat,
  }));

  const xs = projPoly.map(p => p.x);
  const ys = projPoly.map(p => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const STEPS = Math.ceil((maxY - minY) / 0.5); // sample every ~0.5m
  const segments = []; // array of [[lat,lng],[lat,lng]] pairs for each strip edge

  // For the strip we draw two polylines: left edge and right edge of the treeline band
  // Then fill them as a polygon. We collect the lat/lng bounds clipped to polygon.

  // We represent the strip as a filled polygon by clipping left/right at xCenterM±halfWidthM
  // and north/south where the polygon edge crosses those x values.
  // Simpler: for each scan line (latitude step), find if xCenter is inside the polygon.
  // Collect contiguous inside runs → each run becomes a rectangle segment.

  const insideRuns = []; // {startY, endY}
  let runStart = null;

  for (let i = 0; i <= STEPS; i++) {
    const y = minY + (i / STEPS) * (maxY - minY);
    const inside = isXInsidePolygonAtY(xCenterM, y, projPoly);
    if (inside && runStart === null) {
      runStart = y;
    } else if (!inside && runStart !== null) {
      insideRuns.push({ startY: runStart, endY: y });
      runStart = null;
    }
  }
  if (runStart !== null) insideRuns.push({ startY: runStart, endY: maxY });

  // Convert each run to a lat/lng rectangle
  for (const { startY, endY } of insideRuns) {
    const left  = xCenterM - halfWidthM;
    const right = xCenterM + halfWidthM;

    // Convert back to lat/lng
    const latBottom = refLat + startY / mPerDegLat;
    const latTop    = refLat + endY   / mPerDegLat;
    const lngLeft   = refLng + left   / mPerDegLng;
    const lngRight  = refLng + right  / mPerDegLng;

    segments.push([
      [latTop,    lngLeft],
      [latTop,    lngRight],
      [latBottom, lngRight],
      [latBottom, lngLeft],
    ]);
  }

  return segments;
}

/** Ray-cast: is point (px, py) inside projected polygon at scan-line y? */
function isXInsidePolygonAtY(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersects =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Build the full treeline dataset for a polygon.
 * Returns an array of { xM, widthM, segments } where segments are lat/lng quads.
 */
function buildTreelines(polygon) {
  if (!polygon || polygon.length < 3) return [];

  const refLat = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
  const refLng = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length;
  const mPerDegLat = 111320;
  const mPerDegLng = Math.cos((refLat * Math.PI) / 180) * 111320;

  // Bounding box in metres (we need west→east width)
  const lngs = polygon.map(p => p.lng);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const westEdgeM  = (minLng - refLng) * mPerDegLng;
  const eastEdgeM  = (maxLng - refLng) * mPerDegLng;
  const widthM = eastEdgeM - westEdgeM;

  const centerPositions = generateTreelineCenterXPositions(widthM);
  const treelines = [];

  for (const { xM, widthM: w } of centerPositions) {
    // xM is relative to west edge, convert to metres from refLng
    const xAbsM = westEdgeM + xM;
    const segments = computeTreelineSegments(
      polygon, refLat, refLng,
      xAbsM, w / 2,
      mPerDegLat, mPerDegLng
    );
    if (segments.length > 0) {
      treelines.push({ xAbsM, widthM: w, segments });
    }
  }

  return treelines;
}

/**
 * Snap a lat/lng point to the nearest treeline centre line (N→S line at xAbsM).
 * Returns a new { lat, lng } with the same latitude but snapped longitude.
 */
function snapToNearestTreeline(point, treelines, refLat, refLng) {
  if (!treelines || treelines.length === 0) return point;

  const mPerDegLng = Math.cos((refLat * Math.PI) / 180) * 111320;
  const pointXM = (point.lng - refLng) * mPerDegLng;

  let bestTreeline = null;
  let bestDist = Infinity;
  for (const tl of treelines) {
    const dist = Math.abs(tl.xAbsM - pointXM);
    if (dist < bestDist) {
      bestDist = dist;
      bestTreeline = tl;
    }
  }
  if (!bestTreeline) return point;

  const snappedLng = refLng + bestTreeline.xAbsM / mPerDegLng;
  return { lat: point.lat, lng: snappedLng };
}

export {
  generateTreelineCenterXPositions,
  computeTreelineSegments,
  isXInsidePolygonAtY,
  buildTreelines,
  snapToNearestTreeline,
};