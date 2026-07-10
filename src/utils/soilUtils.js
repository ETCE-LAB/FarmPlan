import proj4 from 'proj4';

// ArcGIS layers often put their meaningful value in attributes instead of
// the top-level `value` property, so we prioritize these keys first.
const PREFERRED_ATTRIBUTE_KEYS = [
  'Classify.Pixel Value',
  'UniqueValue.Pixel Value',
  'Classify.Class value',
  'Pixel Value',
  'value',
];

// Register projections once so lookup components can transform GPS coordinates
// from WGS84 (EPSG:4326) to the service-specific projection.
proj4.defs('EPSG:3034', '+proj=lcc +lat_0=52 +lon_0=10 +lat_1=35 +lat_2=65 +x_0=4000000 +y_0=2800000 +ellps=GRS80 +units=m +no_defs +type=crs');
proj4.defs('EPSG:3035', '+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +units=m +no_defs +type=crs');

export function transformCoordinates(lat, lon, spatialRef) {
  return proj4('EPSG:4326', spatialRef, [lon, lat]);
}

export function getPrimaryResultValue(result) {
  // Prefer ArcGIS-provided display value when available.
  if (result?.value) {
    return result.value;
  }

  const attributes = result?.attributes || {};
  const preferredMatch = PREFERRED_ATTRIBUTE_KEYS.find((key) => (
    attributes[key] !== undefined && attributes[key] !== null && attributes[key] !== ''
  ));

  if (preferredMatch) {
    return `${preferredMatch}: ${attributes[preferredMatch]}`;
  }

  const firstEntry = Object.entries(attributes)
    .find(([, value]) => value !== undefined && value !== null && value !== '');

  if (firstEntry) {
    return `${firstEntry[0]}: ${firstEntry[1]}`;
  }

  return 'No value returned for this layer';
}

export function getAttributePreview(attributes) {
  const entries = Object.entries(attributes || {});

  if (!entries.length) {
    return 'No attributes';
  }

  return entries.slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' | ');
}
