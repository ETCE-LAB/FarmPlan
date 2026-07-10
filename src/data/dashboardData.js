// Shared static/demo data and config for dashboard sections.
// Keep this file free of UI logic so components stay presentation-focused.
export const FIELD_LOGS = [
  { id: 'FP-101', name: 'Sektor Nord-A', crop: 'Winter Wheat', moisture: '31%', lastUpdate: '10:45' },
  { id: 'FP-102', name: 'Harz Plain B', crop: 'Corn', moisture: '28%', lastUpdate: '11:20' },
  { id: 'FP-103', name: 'Goslar Field 4', crop: 'Barley', moisture: '35%', lastUpdate: '09:15' },
];

export const PERFORMANCE_DATA = [
  { week: 'W1', value: 420 },
  { week: 'W2', value: 380 },
  { week: 'W3', value: 510 },
  { week: 'W4', value: 490 },
];

export const SOIL_SERVICES = {
  bodenpotenziale: {
    label: 'Bodenpotenziale',
    path: 'boden/bodenpotenziale',
    spatialRef: 'EPSG:3034',
  },
  buek1000de: {
    label: 'BUEK1000DE',
    path: 'boden/buek1000de',
    spatialRef: 'EPSG:3035',
  },
};

export const STATS = [
  { label: 'Total field area', value: '1,420', unit: 'ha' },
  { label: 'Sensors connected', value: '58', unit: 'ok' },
  { label: 'Mean moisture', value: '31.4', unit: '%' },
  { label: 'Yield estimate', value: '4.2', unit: 't/ha' },
];
