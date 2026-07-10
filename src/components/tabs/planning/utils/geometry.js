import L from 'leaflet';

// Copy all geometry functions from your original file:
// toMeters, calcArea, calcPerimeter, parseCoordinates, 
// getPolygonCenter, getBoundingBox, mapPlanPlacementToLatLng,
// isPointInPolygon, hasSpacingOverlap, offsetPointByMeters,
// findAutoSpacedPoint, normalizeStrataLabel, getStrataColor,
// getStrataCircleStyle

function toMeters(point, referenceLat) {
  const mPerDegLat = 111320;
  const mPerDegLng = Math.cos((referenceLat * Math.PI) / 180) * 111320;
  return { x: point.lng * mPerDegLng, y: point.lat * mPerDegLat };
}

function calcArea(points) {
  if (points.length < 3) return 0;
  const refLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const proj = points.map((p) => toMeters(p, refLat));
  let area = 0;
  for (let i = 0; i < proj.length; i++) {
    const cur = proj[i];
    const nxt = proj[(i + 1) % proj.length];
    area += cur.x * nxt.y - nxt.x * cur.y;
  }
  return Math.abs(area) / 2;
}

function calcPerimeter(points) {
  if (points.length < 2) return 0;
  const refLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const proj = points.map((p) => toMeters(p, refLat));
  let perimeter = 0;
  for (let i = 0; i < proj.length; i++) {
    const cur = proj[i];
    const nxt = proj[(i + 1) % proj.length];
    perimeter += Math.sqrt((nxt.x - cur.x) ** 2 + (nxt.y - cur.y) ** 2);
  }
  return perimeter;
}

function parseCoordinates(input) {
  if (!input) return null;
  const matched = input.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!matched) return null;
  const lat = Number(matched[1]);
  const lng = Number(matched[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function getPolygonCenter(points) {
  if (!points || points.length === 0) return null;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
  };
}

function getBoundingBox(fields) {
  if (!fields || fields.length === 0) return null;
  const allPoints = fields.flatMap((f) => f.borderPolygon ?? []);
  if (allPoints.length === 0) return null;
  return {
    minLat: Math.min(...allPoints.map((p) => p.lat)),
    maxLat: Math.max(...allPoints.map((p) => p.lat)),
    minLng: Math.min(...allPoints.map((p) => p.lng)),
    maxLng: Math.max(...allPoints.map((p) => p.lng)),
  };
}

function mapPlanPlacementToLatLng(placement, field) {
  if (!placement) return null;
  if (placement.lat != null && placement.lng != null) return { lat: placement.lat, lng: placement.lng };
  if (!placement.position_m || !field?.borderPolygon?.length) return null;

  const polygon = field.borderPolygon;
  
  // ── Find the most western corner ───────────────────────────────────
  let westPoint = polygon[0];
  for (const point of polygon) {
    if (point.lng < westPoint.lng) {
      westPoint = point;
    }
  }

  // ── Find the most eastern corner ───────────────────────────────────
  let eastPoint = polygon[0];
  for (const point of polygon) {
    if (point.lng > eastPoint.lng) {
      eastPoint = point;
    }
  }

  console.log('West corner:', westPoint);
  console.log('East corner:', eastPoint);

  // ── Calculate angle from west to east corner ───────────────────────
  const mPerDegLat = 111320;
  const mPerDegLng = Math.cos((westPoint.lat * Math.PI) / 180) * 111320;

  const dxMetres = (eastPoint.lng - westPoint.lng) * mPerDegLng;
  const dyMetres = (eastPoint.lat - westPoint.lat) * mPerDegLat;
  
  const fieldAngle = Math.atan2(dyMetres, dxMetres);
  
  console.log('Field angle (radians):', fieldAngle, 'degrees:', (fieldAngle * 180) / Math.PI);

  // ── Rotate placement offsets by field angle ────────────────────────
  const x = placement.position_m.x || 0;
  const y = placement.position_m.y || 0;
  
  const cos = Math.cos(fieldAngle);
  const sin = Math.sin(fieldAngle);
  
  const rotatedX = x * cos - y * sin;
  const rotatedY = x * sin + y * cos;

  console.log(`Original offset: (${x}, ${y}) → Rotated offset: (${rotatedX}, ${rotatedY})`);

  // ── Apply rotated offsets from west corner ─────────────────────────
  const eastOffset = offsetPointByMeters(westPoint, rotatedX, 0);
  let finalPoint = offsetPointByMeters(eastOffset, 0, rotatedY);
  
  // ── Ensure point stays inside polygon ──────────────────────────────
  if (!isPointInPolygon(finalPoint, polygon)) {
    console.warn('Placement outside polygon, snapping to nearest valid location:', finalPoint);
    
    // Find nearest valid point inside polygon
    const snappedPoint = findAutoSpacedPoint(finalPoint, polygon, [], 1);
    
    if (snappedPoint) {
      finalPoint = snappedPoint;
      console.log('Snapped to:', finalPoint);
    } else {
      // If no valid location found, place at polygon center
      finalPoint = getPolygonCenter(polygon);
      console.warn('No valid location found, placing at polygon center:', finalPoint);
    }
  }
  
  return finalPoint;
}

function isPointInPolygon(point, polygon) {
  if (!point || !polygon || polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function hasSpacingOverlap(placements, targetPoint, targetSpacingMeters) {
  return (placements || []).some((placement) => {
    const distanceM = L.latLng(placement.lat, placement.lng).distanceTo(
      L.latLng(targetPoint.lat, targetPoint.lng)
    );
    return distanceM < (placement.minimumSpacingMeters || 0) + targetSpacingMeters;
  });
}

function offsetPointByMeters(point, eastMeters, northMeters) {
  const mPerDegLat = 111320;
  const mPerDegLng = Math.cos((point.lat * Math.PI) / 180) * 111320 || 1;

  return {
    lat: point.lat + (northMeters / mPerDegLat),
    lng: point.lng + (eastMeters / mPerDegLng),
  };
}

function findAutoSpacedPoint(targetPoint, polygon, placements, spacingMeters) {
  if (!targetPoint || !polygon || polygon.length < 3) return null;
  if (isPointInPolygon(targetPoint, polygon) && !hasSpacingOverlap(placements, targetPoint, spacingMeters)) {
    return targetPoint;
  }

  const step = Math.max(spacingMeters / 2, 1);
  const maxRadius = Math.max(spacingMeters * 8, 20);
  const directions = 16;

  for (let radius = step; radius <= maxRadius; radius += step) {
    for (let index = 0; index < directions; index += 1) {
      const angle = (Math.PI * 2 * index) / directions;
      const candidate = offsetPointByMeters(
        targetPoint,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      );

      if (!isPointInPolygon(candidate, polygon)) continue;
      if (hasSpacingOverlap(placements, candidate, spacingMeters)) continue;
      return candidate;
    }
  }

  return null;
}

function normalizeStrataLabel(strata) {
  return String(strata || '').trim().toLowerCase();
}

function getStrataColor(strata) {
  const s = normalizeStrataLabel(strata);

  if (s.includes('emergent canopy')) return '#a41df9';
  if (s.includes('high canopy')) return '#2a42ce';
  if (s.includes('medium/high tree')) return '#16b3b3';
  if (s.includes('medium tree')) return '#189938';
  if (s.includes('low/medium tree')) return '#79fd05';
  if (s.includes('low tree')) return '#e8f832';
  if (s.includes('shrub')) return '#ffcd38';
  if (s.includes('wetland herb')) return '#d57609';
  if (s.includes('herb')) return '#5e4914';

  return '#d04040';
}

function getStrataCircleStyle(strata) {
  const color = getStrataColor(strata);
  return {
    color,
    fillColor: color,
    fillOpacity: 0.10,
  };
}

export {
  getBoundingBox,
  toMeters,
  calcArea,
  calcPerimeter,
  parseCoordinates,
  getPolygonCenter,
  mapPlanPlacementToLatLng,
  isPointInPolygon,
  hasSpacingOverlap,
  offsetPointByMeters,
  findAutoSpacedPoint,
  normalizeStrataLabel,
  getStrataColor,
  getStrataCircleStyle,
};
