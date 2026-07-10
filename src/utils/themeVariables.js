const LIGHT_THEME_DEFAULTS = {
  mode: 'light',
  primary: '#2e7d32',
  sidebar: '#1b5e20',
  background: '#f8faf8',
  panel: '#ffffff',
};

const DARK_THEME_DEFAULTS = {
  mode: 'dark',
  primary: '#66bb6a',
  sidebar: '#0f3d12',
  background: '#0f1410',
  panel: '#1a241a',
};

function hexToRgb(hexColor) {
  if (!hexColor) return null;

  const hex = hexColor.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return null;

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function getAccessibleTextColor(hexColor) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return '#ffffff';

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? '#172317' : '#ffffff';
}

export function buildThemeVariables(theme) {
  const isDark = theme.mode === 'dark';

  return {
    '--farm-green-main': theme.primary,
    '--farm-green-dark': theme.sidebar,
    '--bg-main': theme.background,
    '--panel-bg': theme.panel,
    '--text-main': isDark ? '#e2ebe2' : '#2c312c',
    '--sidebar-text': getAccessibleTextColor(theme.sidebar),
  };
}

export { LIGHT_THEME_DEFAULTS, DARK_THEME_DEFAULTS };