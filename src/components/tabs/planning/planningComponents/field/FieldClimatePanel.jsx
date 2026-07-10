import { useEffect, useRef, useState } from 'react';
import {
  Cloud, Sun, Droplets, Thermometer, Wind,
  Layers, Loader, AlertCircle, ChevronDown, ChevronUp, Leaf, LandPlot, Grid2x2
} from 'lucide-react';
import '../../style/FieldClimatePanel.css';


// ─── Coordinate helpers ───────────────────────────────────────────────────────

function getPolygonCenter(polygon) {
  if (!polygon || polygon.length === 0) return null;
  return {
    lat: polygon.reduce((s, p) => s + p.lat, 0) / polygon.length,
    lng: polygon.reduce((s, p) => s + p.lng, 0) / polygon.length,
  };
}

function toEtrsLcc(lat, lng) {
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180;
  const lat0 = (52 * Math.PI) / 180;
  const lng0 = (10 * Math.PI) / 180;
  const n = Math.sin(lat0);
  const F = Math.cos(lat0) * Math.pow(Math.tan(Math.PI / 4 + lat0 / 2), n) / n;
  const rho = F * 6378137 * Math.pow(1 / Math.tan(Math.PI / 4 + latR / 2), n);
  const rho0 = F * 6378137 * Math.pow(1 / Math.tan(Math.PI / 4 + lat0 / 2), n);
  const theta = n * (lngR - lng0);
  const x = 4000000 + rho * Math.sin(theta);
  const y = 2900000 + rho0 - rho * Math.cos(theta);
  return { x: Math.round(x), y: Math.round(y) };
}

function toEtrsLaea(lat, lng) {
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180;
  const lat0 = (52 * Math.PI) / 180;
  const lng0 = (10 * Math.PI) / 180;
  const R = 6371000;
  const C = Math.sqrt(2 / (1 + Math.sin(lat0) * Math.sin(latR) + Math.cos(lat0) * Math.cos(latR) * Math.cos(lngR - lng0)));
  const x = 4321000 + R * C * Math.cos(latR) * Math.sin(lngR - lng0);
  const y = 3210000 + R * C * (Math.cos(lat0) * Math.sin(latR) - Math.sin(lat0) * Math.cos(latR) * Math.cos(lngR - lng0));
  return { x: Math.round(x), y: Math.round(y) };
}


// ─── KA5 soil type code → readable name ──────────────────────────────────────
const KA5_SOIL_TYPES = {
  '1': 'Sand (S)',
  '1.1': 'Pure Sand',
  '2': 'Loamy Sand (lS)',
  '2.1': 'Slightly Loamy Sand',
  '2.2': 'Moderately Loamy Sand',
  '2.3': 'Strongly Loamy Sand',
  '3': 'Sandy Loam (sL)',
  '3.1': 'Slightly Sandy Loam',
  '3.2': 'Moderately Sandy Loam',
  '3.3': 'Strongly Sandy Loam',
  '4': 'Loam (L)',
  '4.1': 'Sandy Loam',
  '4.2': 'Silt Loam',
  '4.3': 'Clay Loam',
  '5': 'Silty Loam (uL)',
  '5.1': 'Slightly Silty Loam',
  '5.2': 'Moderately Silty Loam',
  '6': 'Clay Loam (tL)',
  '6.1': 'Slightly Clayey Loam',
  '6.2': 'Moderately Clayey Loam',
  '7': 'Silt (U)',
  '7.1': 'Sandy Silt',
  '7.2': 'Loamy Silt',
  '8': 'Clayey Silt (tU)',
  '9': 'Clay (T)',
  '9.1': 'Slightly Sandy Clay',
  '9.2': 'Silty Clay',
  '9.3': 'Pure Clay',
  '10': 'Heavy Clay (TT)',
  // Integer codes from BF_KA5 field (numeric column)
  '1.0': 'Sand (S)',
  '2.0': 'Loamy Sand (lS)',
  '2.5': 'Sandy Loam / Loamy Sand',
  '3.0': 'Sandy Loam (sL)',
  '3.5': 'Loam / Sandy Loam',
  '4.0': 'Loam (L)',
  '4.5': 'Silty Loam / Loam',
  '5.0': 'Silty Loam (uL)',
  '5.5': 'Clay Loam / Silty Loam',
  '6.0': 'Clay Loam (tL)',
  '6.5': 'Clayey Loam / Clay',
  '7.0': 'Silt (U)',
  '7.5': 'Clayey Silt',
  '8.0': 'Clayey Silt (tU)',
  '8.5': 'Silty Clay',
  '9.0': 'Clay (T)',
  '9.5': 'Heavy Clay',
  '10.0': 'Heavy Clay (TT)',
};

function decodeSoilType(raw) {
  if (!raw) return null;
  // Normalise: replace German comma decimal separator → dot, trim whitespace
  const normalised = String(raw).trim().replace(',', '.');
  // Direct lookup
  if (KA5_SOIL_TYPES[normalised]) return KA5_SOIL_TYPES[normalised];
  // Try rounding to nearest 0.5 step as fallback
  const num = parseFloat(normalised);
  if (!isNaN(num)) {
    const rounded = (Math.round(num * 2) / 2).toFixed(1);
    if (KA5_SOIL_TYPES[rounded]) return KA5_SOIL_TYPES[rounded];
    // Last resort: integer bucket
    const intKey = String(Math.round(num));
    if (KA5_SOIL_TYPES[intKey]) return KA5_SOIL_TYPES[intKey];
  }
  // If it's already a readable string (not a number), return it as-is
  if (isNaN(Number(normalised))) return raw;
  return `Soil Code ${normalised}`;
}
// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchWeather(lat, lng) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  const fmt = (d) => d.toISOString().split('T')[0];

  // ── Primary: Open-Meteo archive for precipitation (more complete coverage) ──
  const omUrl =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lng}` +
    `&start_date=${fmt(start)}&end_date=${fmt(end)}` +
    `&hourly=temperature_2m,precipitation,wind_speed_10m,cloud_cover` +
    `&timezone=auto`;

  // ── Secondary: Bright Sky for station name / distance metadata only ──
  const bsUrl =
    `https://api.brightsky.dev/weather?lat=${lat}&lon=${lng}` +
    `&date=${fmt(start)}&last_date=${fmt(end)}`;

  const [omRes, bsRes] = await Promise.allSettled([
    fetch(omUrl).then((r) => { if (!r.ok) throw new Error(`Open-Meteo ${r.status}`); return r.json(); }),
    fetch(bsUrl).then((r) => { if (!r.ok) throw new Error(`BrightSky ${r.status}`); return r.json(); }),
  ]);

  let avgTemp = null, totalPrecip = null, avgWind = null, avgCloud = null;
  let stationSource = null;

  // ── Parse Open-Meteo hourly data ──
  if (omRes.status === 'fulfilled') {
    const h = omRes.value?.hourly ?? {};
    const temps   = (h.temperature_2m   ?? []).filter((v) => v != null);
    const precips = (h.precipitation     ?? []).filter((v) => v != null);  // keep 0.0 — it's valid!
    const winds   = (h.wind_speed_10m    ?? []).filter((v) => v != null);
    const clouds  = (h.cloud_cover       ?? []).filter((v) => v != null);

    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    avgTemp    = avg(temps)?.toFixed(1)  ?? null;
    totalPrecip = precips.length > 0
      ? precips.reduce((a, b) => a + b, 0).toFixed(1)
      : null;
    avgWind    = avg(winds)?.toFixed(1)  ?? null;
    avgCloud   = avg(clouds)?.toFixed(0) ?? null;
  }

  // ── Grab station metadata from Bright Sky (cosmetic only) ──
  if (bsRes.status === 'fulfilled') {
    stationSource = bsRes.value?.sources?.[0] ?? null;
  }

  return { avgTemp, totalPrecip, avgWind, avgCloud, source: stationSource };
}

async function fetchSolar(lat, lng) {
  const end = new Date();
  end.setDate(end.getDate() - 2);
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  const fmt = (d) => d.toISOString().split('T')[0];

  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
    `&start_date=${fmt(start)}&end_date=${fmt(end)}` +
    `&daily=sunshine_duration,shortwave_radiation_sum&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();

  const sunshineHrs = (json.daily?.sunshine_duration ?? []).filter((v) => v != null);
  const radiation   = (json.daily?.shortwave_radiation_sum ?? []).filter((v) => v != null);
  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const avgSunHrs   = avg(sunshineHrs);
  const avgRadiation = avg(radiation);

  return {
    avgSunHrsPerDay:       avgSunHrs != null ? (avgSunHrs / 3600).toFixed(1) : null,
    avgRadiationMJPerDay:  avgRadiation?.toFixed(1) ?? null,
  };
}

async function fetchSoil(lat, lng) {
  const lcc  = toEtrsLcc(lat, lng);
  const laea = toEtrsLaea(lat, lng);

  const makeParams = (x, y, sr) =>
    new URLSearchParams({
      geometry:      `${x},${y}`,
      geometryType:  'esriGeometryPoint',
      sr,
      layers:        'all',
      tolerance:     '5',   // wider tolerance to catch more layers
      mapExtent:     `${x - 10000},${y - 10000},${x + 10000},${y + 10000}`,
      imageDisplay:  '800,800,96',
      returnGeometry: 'false',
      f:             'json',
    });

  const [boden, buek] = await Promise.allSettled([
    fetch(`https://services.bgr.de/arcgis/rest/services/boden/bodenpotenziale/MapServer/identify?${makeParams(lcc.x, lcc.y, '3034')}`).then((r) => r.json()),
    fetch(`https://services.bgr.de/arcgis/rest/services/boden/buek1000de/MapServer/identify?${makeParams(laea.x, laea.y, '3035')}`).then((r) => r.json()),
  ]);

  const bodenResults = boden.status === 'fulfilled' ? boden.value?.results ?? [] : [];
  const buekResults  = buek.status  === 'fulfilled' ? buek.value?.results  ?? [] : [];

  // ── Collect all unique non-null attribute keys from all layers for diagnostics ──
  const allBodenAttrs = {};
  bodenResults.forEach((r) => {
    Object.entries(r.attributes ?? {}).forEach(([k, v]) => {
      if (v != null && v !== '' && v !== 'Null' && v !== 0 && v !== -9999) {
        allBodenAttrs[k] = String(v);
      }
    });
  });
  const allBuekAttrs = {};
  buekResults.forEach((r) => {
    Object.entries(r.attributes ?? {}).forEach(([k, v]) => {
      if (v != null && v !== '' && v !== 'Null' && v !== 0 && v !== -9999) {
        allBuekAttrs[k] = String(v);
      }
    });
  });

  // ── Smart attribute extraction — scans all layers, all keys ──────────────────
  const findAttr = (results, keys) => {
    for (const result of results) {
      for (const key of keys) {
        const val = result.attributes?.[key];
        if (val != null && val !== '' && val !== 'Null' && val !== 0 && val !== -9999) {
          return String(val);
        }
      }
    }
    return null;
  };

  // Soil type: try many possible German/English attribute names
const rawSoilType =
  findAttr(bodenResults, ['BF_KA5', 'BF', 'BODENART', 'Legendentext', 'LEGENDENTEXT', 'Legende', 'LEGENDE', 'BEZ', 'BEZEICHNUNG', 'NAME', 'BODENARTENGRUPPE']) ??
  findAttr(buekResults,  ['LEGEND', 'BEZ_EINH', 'LEGENDENTEXT', 'Legendentext', 'BEZEICHNUNG', 'NAME', 'BEZ', 'SGE']) ??
  (Object.entries(allBodenAttrs).find(([k, v]) =>
    !['OBJECTID', 'FID', 'Shape', 'SHAPE', 'Shape_Area', 'Shape_Length'].includes(k) &&
    isNaN(Number(v)) && v.length > 1
  )?.[1]) ?? null;

const soilType = decodeSoilType(rawSoilType);

  const fieldCapacity =
    findAttr(bodenResults, ['NFK', 'NUTZBARE_FK', 'NUTZBARE_FEL', 'nutzbare_Feldkapazitat', 'NFK_WE', 'FK']) ??
    null;

  const ph =
    findAttr(bodenResults, ['PH', 'PH_WERT', 'PH_KCL', 'PHWERT']) ??
    null;

  const organicMatter =
    findAttr(bodenResults, ['HUMUS', 'C_ORG', 'Humusgehalt', 'HUMUSGEHALT', 'HG', 'HUMUS_STUFE']) ??
    null;

  const hardinessZone =
    findAttr(bodenResults, ['KLIMAZONE', 'KZ', 'KLIMAZONE_DE']) ??
    null;

  // Soil name from BUEK (often more readable)
  const buekLegend =
    findAttr(buekResults, ['LEGEND', 'BEZ_EINH', 'LEGENDENTEXT', 'Legendentext', 'BEZEICHNUNG', 'SGE']) ??
    null;

  // AWC (available water capacity)
  const awc =
    findAttr(bodenResults, ['AWC', 'NUTZBARE_FEL', 'NFK']) ??
    null;

  return {
    soilType,
    fieldCapacity,
    ph,
    organicMatter,
    hardinessZone,
    buekLegend,
    awc,
    bodenLayers: bodenResults.length,
    buekLayers:  buekResults.length,
    // Keep a selection of readable boden attributes for the "raw" fallback display
    rawBodenAttrs: Object.entries(allBodenAttrs)
      .filter(([k]) => !['OBJECTID', 'FID', 'Shape_Area', 'Shape_Length', 'Shape'].includes(k))
      .slice(0, 12),
    rawBuekAttrs: Object.entries(allBuekAttrs)
      .filter(([k]) => !['OBJECTID', 'FID', 'Shape_Area', 'Shape_Length', 'Shape'].includes(k))
      .slice(0, 8),
  };
}

// ─── Sub-widgets ──────────────────────────────────────────────────────────────

function StatTile({ icon, label, value, unit, accent, nullLabel = '—' }) {
  const display = value != null ? value : nullLabel;
  return (
    <div className={`fcp-stat-tile ${accent ? 'accent' : ''} ${value == null ? 'fcp-stat-tile--null' : ''}`}>
      <div className="fcp-stat-icon">{icon}</div>
      <div className="fcp-stat-body">
        <span className="fcp-stat-value">{display}</span>
        {unit && value != null && <span className="fcp-stat-unit">{unit}</span>}
        <span className="fcp-stat-label">{label}</span>
      </div>
    </div>
  );
}

function Section({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="fcp-section">
      <button type="button" className="fcp-section-header" onClick={() => setOpen((o) => !o)}>
        <span className="fcp-section-icon">{icon}</span>
        <span className="fcp-section-title">{title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="fcp-section-body">{children}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function FieldClimatePanel({ field, onSoilDetected, fieldHardinessData, isLoadingHardiness }) {
  const [weather, setWeather] = useState(null);
  const [solar,   setSolar]   = useState(null);
  const [soil,    setSoil]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const aliveRef = useRef(null);

  useEffect(() => {
    if (!field?.borderPolygon?.length) return;

    // Invalidate previous fetch
    aliveRef.current = {};
    const token = aliveRef.current;

    const center = getPolygonCenter(field.borderPolygon);
    if (!center) return;

    setLoading(true);
    setError('');
    setWeather(null);
    setSolar(null);
    setSoil(null);

    Promise.allSettled([
      fetchWeather(center.lat, center.lng),
      fetchSolar(center.lat, center.lng),
      fetchSoil(center.lat, center.lng),
    ]).then(([w, s, so]) => {
      if (aliveRef.current !== token) return; // stale response
      if (w.status  === 'fulfilled') setWeather(w.value);
      if (s.status  === 'fulfilled') setSolar(s.value);
      if (so.status === 'fulfilled') setSoil(so.value);
      if (so.value?.soilType && onSoilDetected) {onSoilDetected(so.value.soilType);}

      const failures = [w, s, so].filter((r) => r.status === 'rejected');
      if (failures.length === 3) setError('All data sources failed. Check your network connection.');
      else if (failures.length > 0) setError(`${failures.length} source(s) unavailable — partial data shown.`);

      setLoading(false);
    });
  }, [field?.id]);

  if (!field) return null;

  const center = getPolygonCenter(field.borderPolygon);

  // Determine if we have any soil attributes to show
  const hasSoilAttrs = soil && (
    soil.soilType || soil.fieldCapacity || soil.ph ||
    soil.organicMatter || soil.hardinessZone || soil.buekLegend ||
    soil.rawBodenAttrs?.length > 0 || soil.rawBuekAttrs?.length > 0
  );

  return (
    <div className="fcp-panel">
      {/* ── Header ── */}
      <div className="fcp-header">
        <div className="fcp-header-left">
          <Leaf size={16} className="fcp-header-leaf" />
          <div>
            <div className="fcp-header-title">Climate &amp; Soil</div>
            <div className="fcp-header-sub">
              {center ? `${center.lat.toFixed(4)}°N, ${center.lng.toFixed(4)}°E` : 'No coordinates'}
            </div>
          </div>
        </div>
        {loading && <Loader size={16} className="fcp-spin" />}
      </div>

      {error && (
        <div className="fcp-error">
          <AlertCircle size={13} />
          <span>{error}</span>
        </div>
      )}

      {loading && !weather && !solar && !soil && (
        <div className="fcp-loading-state">
          <Loader size={20} className="fcp-spin" />
          <p>Fetching climate data…</p>
        </div>
      )}

      {/* ── Weather ── */}
      {weather && (
        <Section title="Weather (last 7 days)" icon={<Cloud size={14} />}>
          <div className="fcp-stat-grid">
            <StatTile icon={<Thermometer size={15} />} label="Avg Temperature" value={weather.avgTemp} unit="°C" accent />
            <StatTile
              icon={<Droplets size={15} />}
              label="Total Rainfall"
              value={weather.totalPrecip}
              unit="mm"
              // If value is null show "No data" instead of — to make it clear
              nullLabel={weather.precipCount === 0 ? 'No data' : '—'}
            />
            <StatTile icon={<Wind size={15} />}  label="Avg Wind Speed"  value={weather.avgWind}  unit="km/h" />
            <StatTile icon={<Cloud size={15} />} label="Avg Cloud Cover" value={weather.avgCloud} unit="%" />
          </div>
          {weather.source && (
            <p className="fcp-source-note">
              Nearest station: <strong>{weather.source.station_name ?? weather.source.id}</strong>
              {weather.source.distance != null && ` — ${(weather.source.distance / 1000).toFixed(1)} km away`}
            </p>
          )}
          {weather.precipCount === 0 && (
            <p className="fcp-source-note fcp-warn">
              ⚠ The nearest DWD station did not report precipitation data for this period.
            </p>
          )}
        </Section>
      )}

      {/* ── Solar ── */}
      {solar && (
        <Section title="Solar Radiation (last 30 days)" icon={<Sun size={14} />}>
          <div className="fcp-stat-grid">
            <StatTile icon={<Sun size={15} />} label="Avg Sunshine"        value={solar.avgSunHrsPerDay}      unit="h/day"        accent />
            <StatTile icon={<Sun size={15} />} label="Avg Solar Radiation" value={solar.avgRadiationMJPerDay} unit="MJ/m²/day" />
          </div>
        </Section>
      )}

      {/* ── Soil ── */}
      {soil && (
        <Section title="Soil Properties (BGR)" icon={<Layers size={14} />}>
          {soil.bodenLayers === 0 && soil.buekLayers === 0 ? (
            <p className="fcp-source-note fcp-warn">
              ⚠ No BGR soil layers matched this location. The field center may fall outside Germany's soil data coverage.
            </p>
          ) : hasSoilAttrs ? (
            <div className="fcp-soil-grid">
              {soil.soilType && (
                <div className="fcp-soil-row">
                  <span className="fcp-soil-key">Soil Type</span>
                  <span className="fcp-soil-val">{soil.soilType}</span>
                </div>
              )}
              {soil.buekLegend && soil.buekLegend !== soil.soilType && (
                <div className="fcp-soil-row">
                  <span className="fcp-soil-key">Soil Unit (BUEK)</span>
                  <span className="fcp-soil-val">{soil.buekLegend}</span>
                </div>
              )}
              {soil.fieldCapacity && (
                <div className="fcp-soil-row">
                  <span className="fcp-soil-key">Field Capacity</span>
                  <span className="fcp-soil-val">{soil.fieldCapacity} mm</span>
                </div>
              )}
              {soil.ph && (
                <div className="fcp-soil-row">
                  <span className="fcp-soil-key">pH Value</span>
                  <span className="fcp-soil-val">{soil.ph}</span>
                </div>
              )}
              {soil.organicMatter && (
                <div className="fcp-soil-row">
                  <span className="fcp-soil-key">Organic Matter</span>
                  <span className="fcp-soil-val">{soil.organicMatter}%</span>
                </div>
              )}
              {soil.hardinessZone && (
                <div className="fcp-soil-row">
                  <span className="fcp-soil-key">Hardiness Zone</span>
                  <span className="fcp-soil-val">{soil.hardinessZone}</span>
                </div>
              )}

              {/* ── Raw attribute fallback: show whatever BGR returned ── */}
              {!soil.soilType && !soil.fieldCapacity && !soil.ph && soil.rawBodenAttrs?.length > 0 && (
                <>
                  <p className="fcp-source-note" style={{ marginTop: 8 }}>
                    BGR returned data but attribute names differ from expected. Showing raw values:
                  </p>
                  {soil.rawBodenAttrs.map(([k, v]) => (
                    <div key={k} className="fcp-soil-row fcp-soil-row--raw">
                      <span className="fcp-soil-key">{k}</span>
                      <span className="fcp-soil-val">{v}</span>
                    </div>
                  ))}
                </>
              )}
              {!soil.buekLegend && soil.rawBuekAttrs?.length > 0 && (
                <>
                  {soil.rawBuekAttrs.map(([k, v]) => (
                    <div key={`buek-${k}`} className="fcp-soil-row fcp-soil-row--raw">
                      <span className="fcp-soil-key">{k} (BUEK)</span>
                      <span className="fcp-soil-val">{v}</span>
                    </div>
                  ))}
                </>
              )}

              <p className="fcp-source-note">
                BGR: {soil.bodenLayers} Bodenpotenziale layer{soil.bodenLayers !== 1 ? 's' : ''}, {soil.buekLayers} BUEK1000 layer{soil.buekLayers !== 1 ? 's' : ''}
              </p>
            </div>
          ) : (
            // Layers found but all attributes were null/empty
            <div className="fcp-soil-grid">
              <p className="fcp-source-note fcp-warn">
                ⚠ {soil.bodenLayers + soil.buekLayers} BGR layer{soil.bodenLayers + soil.buekLayers !== 1 ? 's' : ''} matched but returned no readable soil attributes for this location. This can happen in water bodies, urban areas, or data gaps in the BGR dataset.
              </p>
              <p className="fcp-source-note">
                BGR: {soil.bodenLayers} Bodenpotenziale layer{soil.bodenLayers !== 1 ? 's' : ''}, {soil.buekLayers} BUEK1000 layer{soil.buekLayers !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </Section>
      )}

   {/* ── Hardiness Zone ── */}
{isLoadingHardiness && (
  <Section title="Farm Hardiness Zone" icon={<Thermometer size={14} />} defaultOpen={true}>
    <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>
      <Loader size={14} className="fcp-spin" />
      <p style={{ marginTop: '8px' }}>Analyzing hardiness zone…</p>
    </div>
  </Section>
)}

{fieldHardinessData?.dominantZone && !isLoadingHardiness && (
  <Section title="Farm Hardiness Zone" icon={<LandPlot size={17} />}>
    <div className="fcp-stat-grid">
      <StatTile
        icon={<LandPlot size={15} />}
        label="Dominant Zone"
        value={fieldHardinessData.dominantZone}
      />
      <StatTile
        icon={<Thermometer size={15} />}
        label="Temperature Range"
        value={fieldHardinessData.temperature[0] + "°C, " + fieldHardinessData.temperature[1] + "°C"}
      />
      </div>

      <div className="fcp-soil-grid" style={{ marginTop: '10px' }}></div>
        <div className="fcp-soil-row">
          <span className="fcp-soil-key">Pixels (km²) Intersected</span>
          <span className="fcp-soil-val">{fieldHardinessData.pixelCount ?? fieldHardinessData.rawPixelCount}  </span>
        </div>

        {Object.keys(fieldHardinessData.distribution || {}).length > 0 && (
        <div className="fcp-soil-grid" style={{ marginTop: '1px' }}>
          {Object.entries(fieldHardinessData.distribution)
            .sort((a, b) => b[1] - a[1])
            .map(([zone, pct]) => (
              <div key={zone} className="fcp-soil-row">
                <span className="fcp-soil-key">Zone {zone}</span>
                <span className="fcp-soil-val">
                  {pct}%
                </span>
              </div>
            ))}
        </div>
      )}
  </Section>
)}

      {!loading && !weather && !solar && !soil && !error && (
        <div className="fcp-loading-state">
          <p>Select a field to load climate &amp; soil data.</p>
        </div>
      )}
    </div>
  );
}

export default FieldClimatePanel;