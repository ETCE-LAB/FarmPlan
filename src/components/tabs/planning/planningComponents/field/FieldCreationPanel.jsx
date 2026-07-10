import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, LayersControl, useMap } from 'react-leaflet';
import { Search, LoaderCircle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import './../../style/FieldCreationPanel.css';
import { useTranslation } from 'react-i18next'; // <-- Imported useTranslation

// ─── helpers ────────────────────────────────────────────────────────────────

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
    const dx = nxt.x - cur.x;
    const dy = nxt.y - cur.y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
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

const EMPTY_FORM = {
  fieldName: '',
  cropType: '',
  soilType: '',
  irrigated: false,
  notes: '',
};

const CROP_OPTIONS = [
  'Winter Wheat', 'Corn', 'Barley', 'Rapeseed', 'Sunflower',
  'Rye', 'Oats', 'Soybean', 'Sugar Beet', 'Potato', 'Other',
];

const SOIL_OPTIONS = [
  'Sandy', 'Sandy Loam', 'Loam', 'Clay Loam', 'Clay',
  'Silt', 'Silty Loam', 'Peaty', 'Chalky', 'Other',
];

// ─── Map sub-components ──────────────────────────────────────────────────────

function MapNavigator({ targetLocation }) {
  const map = useMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!targetLocation) return;
    
    map.flyTo([targetLocation.lat, targetLocation.lng], 16, { duration: 0.8 });
    
    if (markerRef.current) map.removeLayer(markerRef.current);
    
    markerRef.current = L.circleMarker([targetLocation.lat, targetLocation.lng], {
      radius: 7, color: '#1b5e20', fillColor: '#2e7d32', fillOpacity: 0.8, weight: 2,
    }).addTo(map);
  }, [map, targetLocation]);

  useEffect(() => {
    return () => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    };
  }, [map]);

  return null;
}

function FieldMapManager({
  fields,
  selectedFieldId,
  editingShapeId,
  farmPolygon,
  onPolygonDrawn,
  onPolygonEdited,
  onFieldClick,
}) {
  const map = useMap();
  const layerMapRef = useRef({});
  const farmLayerRef = useRef(null);
  const drawingRef = useRef(false);
  const { t } = useTranslation();

  // ── Farm boundary reference ──────────────────────────────────────────────
  useEffect(() => {
    if (farmLayerRef.current) {
      map.removeLayer(farmLayerRef.current);
      farmLayerRef.current = null;
    }
    if (farmPolygon && farmPolygon.length >= 3) {
      farmLayerRef.current = L.polygon(
        farmPolygon.map((p) => [p.lat, p.lng]),
        { color: '#1b5e20', weight: 2.5, fillOpacity: 0.06, dashArray: '8 5' },
      ).addTo(map);
      farmLayerRef.current.bindTooltip(t('Farm boundary', 'Farm boundary'), {
        permanent: false, direction: 'center', className: 'farm-tooltip',
      });
    }
    return () => {
      if (farmLayerRef.current) map.removeLayer(farmLayerRef.current);
    };
  }, [map, farmPolygon, t]);

  // ── Render / restyle saved fields ────────────────────────────────────────
  useEffect(() => {
    for (const id of Object.keys(layerMapRef.current)) {
      if (!fields.find((f) => f.id === Number(id))) {
        map.removeLayer(layerMapRef.current[id]);
        delete layerMapRef.current[id];
      }
    }

    for (const field of fields) {
      const isSelected = field.id === selectedFieldId;
      const isEditingShape = field.id === editingShapeId;

      const style = isSelected
        ? { color: '#f57f17', weight: 3, fillOpacity: 0.35, fillColor: '#ffe082' }
        : { color: '#2e7d32', weight: 2, fillOpacity: 0.2, fillColor: '#81c784' };

      if (layerMapRef.current[field.id]) {
        const layer = layerMapRef.current[field.id];
        layer.setStyle(style);
        if (isEditingShape) {
          layer.pm.enable({ allowSelfIntersection: false });
        } else {
          if (layer.pm.enabled()) layer.pm.disable();
        }
      } else {
        const layer = L.polygon(
          field.borderPolygon.map((p) => [p.lat, p.lng]), style,
        ).addTo(map);

        layer.on('click', () => onFieldClick(field.id));
        layer.bindTooltip(field.fieldName || t('Unnamed field', 'Unnamed field'), {
          permanent: false, direction: 'center', className: 'field-tooltip',
        });

        layerMapRef.current[field.id] = layer;
      }
    }
  }, [fields, selectedFieldId, editingShapeId, map, onFieldClick, t]);

  // ── Edit-mode: sync new coords after pm:edit ─────────────────────────────
  useEffect(() => {
    if (!editingShapeId) return;
    const layer = layerMapRef.current[editingShapeId];
    if (!layer) return;

    const onEdit = () => {
      const coords = layer.getLatLngs()[0].map(({ lat, lng }) => ({ lat, lng }));
      onPolygonEdited(editingShapeId, coords);
    };

    map.on('pm:edit', onEdit);
    return () => {
      map.off('pm:edit', onEdit);
      if (layer.pm.enabled()) layer.pm.disable();
    };
  }, [editingShapeId, map, onPolygonEdited]);

  // ── Draw new polygon via geoman ───────────────────────────────────────────
  useEffect(() => {
    map.pm.addControls({
      position: 'topright',
      drawMarker: false, drawCircleMarker: false, drawRectangle: false,
      drawCircle: false, drawPolyline: false, drawText: false,
      drawPolygon: true, editMode: false, dragMode: false,
      cutPolygon: false, removalMode: false,
    });
    map.pm.setPathOptions({ color: '#f57f17', weight: 2.5, fillOpacity: 0.22 });

    const onCreate = (e) => {
      if (drawingRef.current) return;
      if (!(e.layer instanceof L.Polygon)) return;
      drawingRef.current = true;
      const coords = e.layer.getLatLngs()[0].map(({ lat, lng }) => ({ lat, lng }));
      map.removeLayer(e.layer);
      onPolygonDrawn(coords);
      setTimeout(() => { drawingRef.current = false; }, 100);
    };

    map.on('pm:create', onCreate);
    return () => {
      map.off('pm:create', onCreate);
      map.pm.removeControls();
    };
  }, [map, onPolygonDrawn]);

  return null;
}

// ─── Properties panel ───────────────────────────────────────────────────────

function FieldPropertiesPanel({
  polygon,
  existingField,
  onSave,
  onCancel,
  onDelete,
  onEditShape,
  isEditingShape,
}) {
  const [form, setForm] = useState(
    existingField
      ? { fieldName: existingField.fieldName, cropType: existingField.cropType, soilType: existingField.soilType, irrigated: existingField.irrigated, notes: existingField.notes }
      : EMPTY_FORM,
  );
  const [errors, setErrors] = useState({});
  const { t } = useTranslation();

  useEffect(() => {
    if (existingField) {
      setForm({ fieldName: existingField.fieldName, cropType: existingField.cropType, soilType: existingField.soilType, irrigated: existingField.irrigated, notes: existingField.notes });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [existingField]);

  const area = useMemo(() => calcArea(polygon) / 10000, [polygon]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.fieldName.trim()) next.fieldName = t('Field name is required.', 'Field name is required.');
    if (!form.cropType.trim()) next.cropType = t('Crop type is required.', 'Crop type is required.');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      ...form,
      borderPolygon: polygon.map((p) => ({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) })),
      areaHectares: Number(area.toFixed(2)),
      perimeterKm: Number((calcPerimeter(polygon) / 1000).toFixed(2)),
    });
  };

  return (
    <aside className="field-props-panel">
      <div className="field-props-header">
        <span>{existingField ? t('Edit Field', 'Edit Field') : t('New Field', 'New Field')}</span>
        <button className="close-btn" type="button" onClick={onCancel} title={t('Cancel', 'Cancel')}>✕</button>
      </div>

      <div className="field-props-body">
        <label htmlFor="fp-fieldName">
          {t('Field Name', 'Field Name')} <span className="req">*</span>
          <input id="fp-fieldName" name="fieldName" value={form.fieldName} onChange={handleChange} placeholder={t('e.g., North Plot', 'e.g., North Plot')} />
          {errors.fieldName && <p className="fp-error">{errors.fieldName}</p>}
        </label>

        <label htmlFor="fp-cropType">
          {t('Crop Type', 'Crop Type')} <span className="req">*</span>
          <select id="fp-cropType" name="cropType" value={form.cropType} onChange={handleChange}>
            <option value="">{t('Select crop…', 'Select crop…')}</option>
            {CROP_OPTIONS.map((c) => <option key={c} value={c}>{t(c, c)}</option>)}
          </select>
          {errors.cropType && <p className="fp-error">{errors.cropType}</p>}
        </label>
      {existingField?.soilType && (
       <div className="fp-metrics">
         🌱 {t('Soil', 'Soil')}: {t(existingField.soilType, existingField.soilType)} <span style={{color:'#94a3b8', fontSize:11}}>({t('auto-detected', 'auto-detected')})</span>
       </div>
      )}

        <div className="fp-irrigated-row">
          <span>{t('Irrigated', 'Irrigated')}</span>
          <div className="fp-toggle-group">
            <button type="button" className={`fp-toggle-btn ${form.irrigated ? 'active' : ''}`} onClick={() => setForm((p) => ({ ...p, irrigated: true }))}>{t('Yes', 'Yes')}</button>
            <button type="button" className={`fp-toggle-btn ${!form.irrigated ? 'active' : ''}`} onClick={() => setForm((p) => ({ ...p, irrigated: false }))}>{t('No', 'No')}</button>
          </div>
        </div>

        <div className="fp-metrics">
          <span>📐 {area.toFixed(2)} {t('ha', 'ha')}</span>
          <span>📍 {polygon.length} {t('pts', 'pts')}</span>
        </div>

        <label htmlFor="fp-notes">
          {t('Notes', 'Notes')}
          <textarea id="fp-notes" name="notes" rows={3} value={form.notes} onChange={handleChange} placeholder={t('Irrigation plan, soil tests, legal notes…', 'Irrigation plan, soil tests, legal notes…')} />
        </label>

        {existingField && (
          <button type="button" className={`fp-edit-shape-btn ${isEditingShape ? 'active' : ''}`} onClick={() => onEditShape(existingField.id)}>
            {isEditingShape ? t('✓ Finish Reshaping', '✓ Finish Reshaping') : t('✏ Edit Shape on Map', '✏ Edit Shape on Map')}
          </button>
        )}
      </div>

      <div className="field-props-footer">
        {existingField && <button type="button" className="fp-danger-btn" onClick={() => onDelete(existingField.id)}>{t('Delete', 'Delete')}</button>}
        <button type="button" className="fp-secondary-btn" onClick={onCancel}>{t('Cancel', 'Cancel')}</button>
        <button type="button" className="fp-primary-btn" onClick={handleSave}>{t('Save Field', 'Save Field')}</button>
      </div>
    </aside>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const INITIAL_CENTER = [52.2689, 10.5268];

function FieldCreationPanel({ farm }) {
  const [fields, setFields] = useState(farm?.fields ?? []);
  const [draftPolygon, setDraftPolygon] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [editingShapeId, setEditingShapeId] = useState(null);
  
  // ── Geolocation search state ─────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [searchFeedback, setSearchFeedback] = useState({ type: '', message: '' });
  const [isSearching, setIsSearching] = useState(false);
  const [mapTargetLocation, setMapTargetLocation] = useState(null);
  const { t } = useTranslation();

  const isPanelOpen = draftPolygon !== null || selectedFieldId !== null;
  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;
  const activePoly = draftPolygon ?? selectedField?.borderPolygon ?? [];

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePolygonDrawn = useCallback((coords) => {
    setDraftPolygon(coords);
    setSelectedFieldId(null);
  }, []);

  const handlePolygonEdited = useCallback((id, coords) => {
    setFields((prev) => prev.map((f) => f.id === id ? {
      ...f,
      borderPolygon: coords.map((p) => ({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) })),
      areaHectares: Number((calcArea(coords) / 10000).toFixed(2)),
      perimeterKm: Number((calcPerimeter(coords) / 1000).toFixed(2)),
    } : f));
  }, []);

  const handleFieldClick = useCallback((id) => {
    setSelectedFieldId(id);
    setDraftPolygon(null);
    setEditingShapeId(null);
  }, []);

  const handleSave = (formData) => {
    if (draftPolygon) {
      setFields((prev) => [...prev, { id: Date.now(), ...formData, createdAt: new Date().toISOString() }]);
      setDraftPolygon(null);
    } else if (selectedFieldId) {
      setFields((prev) => prev.map((f) => (f.id === selectedFieldId ? { ...f, ...formData } : f)));
      setSelectedFieldId(null);
      setEditingShapeId(null);
    }
  };

  const handleCancel = () => {
    setDraftPolygon(null);
    setSelectedFieldId(null);
    setEditingShapeId(null);
  };

  const handleDelete = (id) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    setSelectedFieldId(null);
    setEditingShapeId(null);
  };

  const handleEditShape = (id) => {
    setEditingShapeId((prev) => (prev === id ? null : id));
  };

  // ── Geolocation search ─────────────────────────────────────────────────────
  const handleLocationSearch = async () => {
    const cleaned = searchInput.trim();
    if (!cleaned) {
      setSearchFeedback({ type: 'error', message: t('Enter an address or coordinates (lat, lng).', 'Enter an address or coordinates (lat, lng).') });
      return;
    }

    const coords = parseCoordinates(cleaned);
    if (coords) {
      setMapTargetLocation(coords);
      setSearchFeedback({ type: 'success', message: `${t('Centered map at', 'Centered map at')} ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}.` });
      return;
    }

    try {
      setIsSearching(true);
      setSearchFeedback({ type: '', message: '' });
      const query = encodeURIComponent(cleaned);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`);
      
      if (!response.ok) throw new Error(t('Address lookup failed.', 'Address lookup failed.'));
      
      const results = await response.json();
      if (!Array.isArray(results) || results.length === 0) {
        setSearchFeedback({ type: 'error', message: t('No matching place found. Try a more specific address.', 'No matching place found. Try a more specific address.') });
        return;
      }

      const first = results[0];
      const lat = Number(first.lat);
      const lng = Number(first.lon);
      
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        setSearchFeedback({ type: 'error', message: t('Result did not contain valid coordinates.', 'Result did not contain valid coordinates.') });
        return;
      }

      setMapTargetLocation({ lat, lng });
      setSearchFeedback({ type: 'success', message: `${t('Found:', 'Found:')} ${first.display_name}` });
    } catch {
      setSearchFeedback({ type: 'error', message: t('Could not search this location right now. Please try again.', 'Could not search this location right now. Please try again.') });
    } finally {
      setIsSearching(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="field-creation-wrap">
      <div className="field-map-area">
        {/* Search bar on top of map */}
        <div className="field-search-bar">
          <Search size={16} className="field-search-icon" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLocationSearch(); }}}
            placeholder={t('Search by address or lat,lng (e.g., 52.2689, 10.5268)', 'Search by address or lat,lng (e.g., 52.2689, 10.5268)')}
            aria-label={t('Search location by address or coordinates', 'Search location by address or coordinates')}
          />
          <button
            type="button"
            className="field-search-btn"
            onClick={handleLocationSearch}
            disabled={isSearching}
          >
            {isSearching ? <LoaderCircle size={14} className="spin" /> : t('Find', 'Find')}
          </button>
        </div>
        
        {searchFeedback.message && (
          <div className={`field-search-feedback ${searchFeedback.type}`}>
            {searchFeedback.message}
          </div>
        )}

        <MapContainer className="field-map" center={INITIAL_CENTER} zoom={13} scrollWheelZoom>
          <MapNavigator targetLocation={mapTargetLocation} />
          <FieldMapManager
            fields={fields}
            selectedFieldId={selectedFieldId}
            editingShapeId={editingShapeId}
            farmPolygon={farm?.borderPolygon ?? null}
            onPolygonDrawn={handlePolygonDrawn}
            onPolygonEdited={handlePolygonEdited}
            onFieldClick={handleFieldClick}
          />

          <LayersControl position="topleft">
            <LayersControl.BaseLayer name={t('OpenStreetMap', 'OpenStreetMap')}>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer checked name={t('Satellite (Esri)', 'Satellite (Esri)')}>
              <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            </LayersControl.BaseLayer>
          </LayersControl>
        </MapContainer>

        {!isPanelOpen && (
          <div className="field-map-hint">
            {t('Use the polygon tool (top-right) to draw a field boundary, or click an existing field.', 'Use the polygon tool (top-right) to draw a field boundary, or click an existing field.')}
          </div>
        )}

        {isPanelOpen && (
          <FieldPropertiesPanel
            polygon={activePoly}
            existingField={selectedField}
            onSave={handleSave}
            onCancel={handleCancel}
            onDelete={handleDelete}
            onEditShape={handleEditShape}
            isEditingShape={editingShapeId === selectedFieldId}
          />
        )}
      </div>

      <article className="panel field-list-panel">
        <div className="panel-header">
          {t('Saved Fields', 'Saved Fields')} ({fields.length})
          {farm?.farmName && <span className="field-list-farm-name"> — {farm.farmName}</span>}
        </div>
        {fields.length === 0 ? (
          <p className="empty-state">{t('No fields saved yet. Draw a polygon on the map to start.', 'No fields saved yet. Draw a polygon on the map to start.')}</p>
        ) : (
          <div className="field-list">
            {fields.map((f) => (
              <div
                key={f.id}
                className={`field-list-item ${f.id === selectedFieldId ? 'selected' : ''}`}
                onClick={() => handleFieldClick(f.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleFieldClick(f.id)}
              >
                <div className="field-list-name">{f.fieldName || t('Unnamed', 'Unnamed')}</div>
                <div className="field-list-meta">
                  {f.cropType && <span className="field-badge crop">{t(f.cropType, f.cropType)}</span>}
                  {f.soilType && <span className="field-badge soil">{t(f.soilType, f.soilType)}</span>}
                  {f.irrigated && <span className="field-badge irrigated">💧 {t('Irrigated', 'Irrigated')}</span>}
                </div>
                <div className="field-list-stats">
                  {f.areaHectares} {t('ha', 'ha')} · {f.perimeterKm} {t('km', 'km')} · {f.borderPolygon.length} {t('pts', 'pts')}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

export default FieldCreationPanel;