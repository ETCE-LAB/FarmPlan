import { React, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, LayersControl, useMap } from 'react-leaflet';
import {
  LoaderCircle, MapPin, Layers, ChevronRight,
  Wheat, Droplets, Ruler, LocateFixed, Thermometer,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import FieldClimatePanel from './planningComponents/field/FieldClimatePanel';
import FieldPropertiesPanel from './planningComponents/field/FieldPropertiesPanel';
import DragDropCrops from './planningComponents/field/DragDropCrops';
import Template from './planningComponents/field/Template';
import FarmList from './planningComponents/farm/FarmList';
import StrataLegend from './planningComponents/farm/StrataLegend';
import './style/FarmCreationPanel.css';
import { useTranslation } from 'react-i18next';
import { getFieldHardiness } from '../../../utils/dashboardApi';
import { FarmMap } from './planningComponents/map';
import { 
  getPolygonCenter, getBoundingBox, calcArea, calcPerimeter, 
  isPointInPolygon, hasSpacingOverlap, findAutoSpacedPoint,
  parseCoordinates, toMeters, offsetPointByMeters, mapPlanPlacementToLatLng,
  normalizeStrataLabel, getStrataColor, getStrataCircleStyle
} from './utils/geometry';


const INITIAL_CENTER = [52.2689, 10.5268];
const FARM_REQUIRED = ['farmName', 'ownerName', 'location', 'contactEmail'];
const DRAG_CROP_MIME = 'application/x-farm-crop';
const SOIL_OPTIONS = [
  'Sandy', 'Sandy Loam', 'Loam', 'Clay Loam', 'Clay',
  'Silt', 'Silty Loam', 'Peaty', 'Chalky', 'Other',
]

// ─── Main component ──────────────────────────────────────────────────────────

function FarmCreationPanel({ onCreateFarm, farms, onUpdateFarm }) {
  const [formData, setFormData] = useState({ farmName: '', ownerName: '', location: '', contactEmail: '', notes: '' });
  const [formErrors, setFormErrors] = useState({});
  const [formCollapsed, setFormCollapsed] = useState(false);
  const [selectedFarmId, setSelectedFarmId] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [editingShapeId, setEditingShapeId] = useState(null);
  const [draftFieldPolygon, setDraftFieldPolygon] = useState(null);
  const [draftCropPlacements, setDraftCropPlacements] = useState([]);
  const [cropDropFeedback, setCropDropFeedback] = useState('');
  const [templateDialogMode, setTemplateDialogMode] = useState(null);
  const [farmBoundsFields, setFarmBoundsFields] = useState(null);
  const [mapTargetLocation, setMapTargetLocation] = useState(null);
  const [fieldZoomTarget, setFieldZoomTarget] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchFeedback, setSearchFeedback] = useState({ type: '', message: '' });
  const [isSearching, setIsSearching] = useState(false);
  const [fieldHardinessData, setFieldHardinessData] = useState(null);
  const [isLoadingHardiness, setIsLoadingHardiness] = useState(false);
  const [showMapLegend, setShowMapLegend] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (selectedFarmId) setFormCollapsed(true);
    else setFormCollapsed(false);
  }, [selectedFarmId]);

  const selectedFarm  = farms.find((f) => f.id === selectedFarmId) ?? null;
  const selectedField = selectedFarm?.fields?.find((f) => f.id === selectedFieldId) ?? null;
  const templatePlants = selectedField?.template?.plants ?? selectedField?.recipe?.plants ?? selectedFarm?.template?.plants ?? selectedFarm?.recipe?.plants ?? [];
  const isFieldPanelOpen = draftFieldPolygon !== null || selectedFieldId !== null;
  const activeFieldPoly  = draftFieldPolygon ?? selectedField?.borderPolygon ?? [];
  const activeFields     = selectedFarm?.fields ?? [];

  // ── Treeline polygon: show treelines for the currently active polygon ──────
  // (draft polygon while drawing, or the selected saved field's polygon)
  const treelinePolygon = useMemo(() => {
    if (draftFieldPolygon && draftFieldPolygon.length >= 3) return draftFieldPolygon;
    if (selectedField?.borderPolygon?.length >= 3) return selectedField.borderPolygon;
    return null;
  }, [draftFieldPolygon, selectedField]);

  const fetchFieldHardiness = useCallback(async (farm) => {
    if (!farm?.fields || farm.fields.length === 0) {
      setFieldHardinessData(null);
      return;
    }

    // Collect all valid polygons from fields
    const validPolygons = farm.fields
      .filter((f) => f.borderPolygon && f.borderPolygon.length >= 3)
      .map((f) => f.borderPolygon);

    if (validPolygons.length === 0) {
      setFieldHardinessData(null);
      return;
    }

    try {
      setIsLoadingHardiness(true);
      // Use the first field's polygon for now, or combine them later
      const polygon = validPolygons[0];
      // Transform from [{lat, lng}, ...] to [[lat, lng], ...]
      const polygonArray = polygon.map((point) => [point.lat, point.lng]);
      const result = await getFieldHardiness(polygonArray);
      console.log('Hardiness analysis result:', result);
      setFieldHardinessData(result);
    } catch (error) {
      console.error('Error fetching hardiness data:', error);
      setFieldHardinessData(null);
    } finally {
      setIsLoadingHardiness(false);
    }
  }, []);

  useEffect(() => {
    if (selectedFarm) {
      fetchFieldHardiness(selectedFarm);
    } else {
      setFieldHardinessData(null);
    }
  }, [selectedFarm, fetchFieldHardiness]);

  const handleFarmChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (formErrors[name]) setFormErrors((p) => ({ ...p, [name]: undefined }));
  };

  const validateFarm = () => {
    const next = {};
    FARM_REQUIRED.forEach((f) => { if (!formData[f].trim()) next[f] = t('This field is required.', 'This field is required.'); });
    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) next.contactEmail = t('Please provide a valid email address.', 'Please provide a valid email address.');
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const resetFarmForm = () => { setFormData({ farmName: '', ownerName: '', location: '', contactEmail: '', notes: '' }); setFormErrors({}); };

  const handleFarmSubmit = async (e) => {
    e.preventDefault();
    if (!validateFarm()) return;
    const createdFarmId = await onCreateFarm({ id: Date.now(), ...formData, createdAt: new Date().toISOString(), fields: [], template: null });
    resetFarmForm();
    if (createdFarmId) setSelectedFarmId(createdFarmId);
  };

  const handleFarmSelect = useCallback((id) => {
    setSelectedFarmId((prev) => {
      const nextId = prev === id ? null : id;
      if (nextId !== null) {
        const farm = farms.find((f) => f.id === nextId);
        if (farm?.fields?.length > 0) setFarmBoundsFields([...farm.fields]);
        else setFarmBoundsFields(null);
      } else setFarmBoundsFields(null);
      return nextId;
    });
    setSelectedFieldId(null); setEditingShapeId(null); setDraftFieldPolygon(null); setDraftCropPlacements([]); setCropDropFeedback('');
  }, [farms]);

  const handleFieldClick = useCallback((id) => {
    setSelectedFieldId((prev) => {
      const nextId = prev === id ? null : id;
      if (nextId !== null && selectedFarm) {
        const field = selectedFarm.fields?.find((f) => f.id === nextId);
        if (field?.borderPolygon?.length > 0) {
          const center = getPolygonCenter(field.borderPolygon);
          setFieldZoomTarget({ ...center, zoom: 20 });
        } else setFieldZoomTarget(null);
      } else setFieldZoomTarget(null);
      return nextId;
    });
    setDraftFieldPolygon(null);
    setDraftCropPlacements([]);
    setEditingShapeId(null);
    setCropDropFeedback('');
  }, [selectedFarm]);

  const handleFieldPolygonDrawn = useCallback((coords) => {
    setDraftFieldPolygon(coords); setDraftCropPlacements([]); setSelectedFieldId(null); setEditingShapeId(null); setCropDropFeedback('');
  }, []);

  const handleSoilDetected = useCallback((soilType) => {
  if (!selectedFarm || !selectedFieldId || !soilType) return;
  const updatedFields = (selectedFarm.fields ?? []).map((f) =>
    f.id === selectedFieldId
      ? { ...f, soilType }
      : f
  );
  onUpdateFarm({ ...selectedFarm, fields: updatedFields });
}, [selectedFarm, selectedFieldId, onUpdateFarm]);
  const handleFieldPolygonEdited = useCallback((id, coords) => {
    if (!selectedFarm) return;
    const updatedFields = (selectedFarm.fields ?? []).map((f) =>
      f.id === id
        ? { ...f, borderPolygon: coords.map((p) => ({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) })), areaHectares: Number((calcArea(coords) / 10000).toFixed(2)), perimeterKm: Number((calcPerimeter(coords) / 1000).toFixed(2)) }
        : f
    );
    onUpdateFarm({ ...selectedFarm, fields: updatedFields });
  }, [selectedFarm, onUpdateFarm]);

  const handleEditShape = useCallback((id) => { setEditingShapeId((prev) => (prev === id ? null : id)); }, []);

  const handleCropDroppedOnMap = useCallback((crop, point) => {
    if (!selectedFarm) {
      setCropDropFeedback(t('Select a farm first.', 'Select a farm first.'));
      return;
    }

    const targetPolygon = draftFieldPolygon ?? selectedField?.borderPolygon ?? null;
    const autoSpacingEnabled = Boolean(selectedField?.autoSpacingEnabled);
    if (!targetPolygon || targetPolygon.length < 3) {
      setCropDropFeedback(t('Draw or select a field polygon before dropping crops.', 'Draw or select a field polygon before dropping crops.'));
      return;
    }

    if (!isPointInPolygon(point, targetPolygon)) {
      setCropDropFeedback(t('Drop the crop inside the selected field polygon.', 'Drop the crop inside the selected field polygon.'));
      return;
    }

    const spacingMeters = Number(crop.minimumSpacingMeters) || 1;
    const placement = {
      id: `${crop.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      cropId: crop.id,
      cropName: crop.name,
      strata: crop.strata || crop.rawDetails?.strata || '',
      minimumSpacingMeters: spacingMeters,
      lat: Number(point.lat.toFixed(7)),
      lng: Number(point.lng.toFixed(7)),
    };

    if (draftFieldPolygon) {
      if (hasSpacingOverlap(draftCropPlacements, point, spacingMeters)) {
        setCropDropFeedback(`${t('Cannot place', 'Cannot place')} ${t(crop.name, crop.name)}: ${t('minimum spacing overlaps another crop.', 'minimum spacing overlaps another crop.')}`);
        return;
      }

      setDraftCropPlacements((prev) => [...prev, placement]);
      setCropDropFeedback(`${t('Placed', 'Placed')} ${t(crop.name, crop.name)} ${t('on draft field.', 'on draft field.')}`);
      return;
    }

    if (!selectedFieldId) {
      setCropDropFeedback(t('Select a field to place crops.', 'Select a field to place crops.'));
      return;
    }

    const existingPlacements = selectedField?.cropPlacements || [];
    let placementPoint = point;

    if (autoSpacingEnabled) {
      const spacedPoint = findAutoSpacedPoint(point, selectedField?.borderPolygon ?? targetPolygon, existingPlacements, spacingMeters);
      if (!spacedPoint) {
        setCropDropFeedback(`${t('Cannot auto-space', 'Cannot auto-space')} ${t(crop.name, crop.name)}: ${t('no valid location was found inside this field.', 'no valid location was found inside this field.')}`);
        return;
      }
      placementPoint = spacedPoint;
    } else if (hasSpacingOverlap(existingPlacements, point, spacingMeters)) {
      setCropDropFeedback(`${t('Cannot place', 'Cannot place')} ${t(crop.name, crop.name)}: ${t('minimum spacing overlaps another crop.', 'minimum spacing overlaps another crop.')}`);
      return;
    }

    const updatedFields = (selectedFarm.fields || []).map((field) => {
      if (field.id !== selectedFieldId) return field;
      return {
        ...field,
        cropType: crop.name,
        cropPlacements: [...existingPlacements, {
          ...placement,
          lat: Number(placementPoint.lat.toFixed(7)),
          lng: Number(placementPoint.lng.toFixed(7)),
        }],
      };
    });

    onUpdateFarm({ ...selectedFarm, fields: updatedFields });
    setCropDropFeedback(autoSpacingEnabled && (placementPoint.lat !== point.lat || placementPoint.lng !== point.lng)
      ? `${t('Auto-spaced', 'Auto-spaced')} ${t(crop.name, crop.name)} ${t('on', 'on')} ${selectedField?.fieldName || t('selected field', 'selected field')}.`
      : `${t('Placed', 'Placed')} ${t(crop.name, crop.name)} ${t('on', 'on')} ${selectedField?.fieldName || t('selected field', 'selected field')}.`);
  }, [selectedFarm, draftFieldPolygon, selectedField, selectedFieldId, draftCropPlacements, onUpdateFarm, t]);

  const handleFieldSave = (fieldData) => {
    if (!selectedFarm) return;
    let updatedFields;
    if (draftFieldPolygon) {
      updatedFields = [
        ...(selectedFarm.fields ?? []),
        {
          id: Date.now(),
          ...fieldData,
          cropPlacements: draftCropPlacements,
          createdAt: new Date().toISOString(),
        },
      ];
    } else if (selectedFieldId) {
      updatedFields = (selectedFarm.fields ?? []).map((f) => f.id === selectedFieldId ? { ...f, ...fieldData } : f);
    }
    onUpdateFarm({ ...selectedFarm, fields: updatedFields });
    setDraftFieldPolygon(null); setDraftCropPlacements([]); setSelectedFieldId(null); setEditingShapeId(null); setCropDropFeedback('');
  };

  const handleFieldDelete = (id) => {
    if (!selectedFarm) return;
    onUpdateFarm({ ...selectedFarm, fields: (selectedFarm.fields ?? []).filter((f) => f.id !== id) });
    setSelectedFieldId(null); setEditingShapeId(null); setDraftFieldPolygon(null); setDraftCropPlacements([]); setCropDropFeedback('');
  };

  const handleFieldCancel = () => { setDraftFieldPolygon(null); setDraftCropPlacements([]); setSelectedFieldId(null); setEditingShapeId(null); setCropDropFeedback(''); };

  const handleOpenTemplateDialog = (mode) => {
    if (!selectedFarm) return;
    setTemplateDialogMode(mode);
  };

  const handleSaveTemplate = (template) => {
    if (!selectedFarm || !selectedFieldId) {
      return;
    }
    const updatedFields = (selectedFarm.fields ?? []).map((field) =>
      field.id === selectedFieldId ? { ...field, template } : field
    );
    onUpdateFarm({ ...selectedFarm, fields: updatedFields });
    setTemplateDialogMode(null);
  };

  const handleLocationSearch = async () => {
    const cleaned = searchInput.trim();
    if (!cleaned) { setSearchFeedback({ type: 'error', message: t('Enter an address or coordinates.', 'Enter an address or coordinates.') }); return; }
    const coords = parseCoordinates(cleaned);
    if (coords) { setMapTargetLocation(coords); setSearchFeedback({ type: 'success', message: `${t('Centered at', 'Centered at')} ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}.` }); return; }
    try {
      setIsSearching(true); setSearchFeedback({ type: '', message: '' });
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(cleaned)}`);
      if (!r.ok) throw new Error();
      const results = await r.json();
      if (!results.length) { setSearchFeedback({ type: 'error', message: t('No matching place found.', 'No matching place found.') }); return; }
      const { lat, lon, display_name } = results[0];
      setMapTargetLocation({ lat: Number(lat), lng: Number(lon) });
      setSearchFeedback({ type: 'success', message: `${t('Found:', 'Found:')} ${display_name}` });
    } catch { setSearchFeedback({ type: 'error', message: t('Could not search right now.', 'Could not search right now.') }); }
    finally { setIsSearching(false); }
  };

  return (
    <section className="farm-create-grid">
      <article className="panel farm-create-form-panel">
        <div className="panel-header" style={{ cursor: selectedFarm ? 'pointer' : 'default' }} onClick={() => selectedFarm && setFormCollapsed(c => !c)}>
          <span>🌾 {t('Register New Farm', 'Register New Farm')}</span>
          {selectedFarm && <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>{formCollapsed ? `▼ ${t('show', 'show')}` : `▲ ${t('hide', 'hide')}`}</span>}
        </div>

        {!formCollapsed && (
          <form className="farm-form" onSubmit={handleFarmSubmit} noValidate>
            <label htmlFor="farmName">{t('Farm Name', 'Farm Name')} *</label>
            <input id="farmName" name="farmName" value={formData.farmName} onChange={handleFarmChange} placeholder={t('e.g., Green Valley Farm', 'e.g., Green Valley Farm')} required />
            {formErrors.farmName && <p className="error-text">{formErrors.farmName}</p>}
            <label htmlFor="ownerName">{t('Owner Name', 'Owner Name')} *</label>
            <input id="ownerName" name="ownerName" value={formData.ownerName} onChange={handleFarmChange} placeholder={t('e.g., Max Mustermann', 'e.g., Max Mustermann')} required />
            {formErrors.ownerName && <p className="error-text">{formErrors.ownerName}</p>}
            <label htmlFor="location">{t('Location / Address', 'Location / Address')} *</label>
            <input id="location" name="location" value={formData.location} onChange={handleFarmChange} placeholder={t('e.g., Wolfenbüttel, Lower Saxony', 'e.g., Wolfenbüttel, Lower Saxony')} required />
            {formErrors.location && <p className="error-text">{formErrors.location}</p>}
            <label htmlFor="contactEmail">{t('Contact Email', 'Contact Email')} *</label>
            <input id="contactEmail" name="contactEmail" type="email" value={formData.contactEmail} onChange={handleFarmChange} placeholder={t('e.g., owner@farm.com', 'e.g., owner@farm.com')} required />
            {formErrors.contactEmail && <p className="error-text">{formErrors.contactEmail}</p>}
            <label htmlFor="notes">{t('Notes', 'Notes')}</label>
            <textarea id="notes" name="notes" rows={3} value={formData.notes} onChange={handleFarmChange} placeholder={t('Optional details…', 'Optional details…')} />
            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={resetFarmForm}>{t('Reset', 'Reset')}</button>
              <button type="submit" className="primary-btn">{t('Save Farm', 'Save Farm')}</button>
            </div>
          </form>
        )}

        {selectedFarm && (
          <>
            <div style={{ height: 1, background: 'var(--panel-divider)', margin: '8px 0' }} />
            <div className="panel-header" style={{ padding: '10px 16px' }}>
              <span>📍 {selectedFarm.farmName}</span>
              <button className="close-btn" type="button" onClick={() => { setSelectedFarmId(null); setSelectedFieldId(null); setEditingShapeId(null); setDraftFieldPolygon(null); }}>✕</button>
            </div>
            <div className="farm-detail-body">
              <div className="farm-detail-card">
                <p className="farm-detail-meta"><strong>{t('Owner', 'Owner')}</strong><span>{selectedFarm.ownerName}</span></p>
                <p className="farm-detail-meta"><strong>{t('Location', 'Location')}</strong><span>{selectedFarm.location}</span></p>
                <p className="farm-detail-meta"><strong>{t('Email', 'Email')}</strong><span>{selectedFarm.contactEmail}</span></p>
                {selectedFarm.notes && <p className="farm-detail-meta"><strong>{t('Notes', 'Notes')}</strong><span>{selectedFarm.notes}</span></p>}
              </div>
              <div className="farm-detail-divider" />
              <div className="template-choice-panel">
                <div className="template-choice-header">
                  <strong>{t('Template setup', 'Template setup')}</strong>
                  <span>
                    {selectedField
                      ? (selectedField.template || selectedField.recipe || selectedFarm?.template || selectedFarm?.recipe
                        ? t('Field is using template.', 'Field is using template.')
                        : t('Create a template for this field to define which plants can be dragged into it.', 'Create a template for this field to define which plants can be dragged into it.'))
                      : t('Draw a field to be able to create a template for that field.', 'Draw a field to be able to create a template for that field.')}
                  </span>
                </div>
                <div className="template-choice-actions">
                  <button type="button" className="template-choice-btn" onClick={() => handleOpenTemplateDialog('create')}>
                    {t('Create new template', 'Create new template')}
                  </button>
                  {(selectedField?.recipe || selectedFarm?.recipe) && (
                    <button type="button" className="template-choice-btn secondary" onClick={() => handleOpenTemplateDialog('edit')}>
                      {t('Edit template', 'Edit template')}
                    </button>
                  )}
                  <button type="button" className="template-choice-btn third" onClick={() => handleOpenTemplateDialog('generate')}>
                    {t('Generate template', 'Generate template')}
                  </button>
                </div>
              </div>
              <div className="farm-fields-summary">
                <div className="fields-count-header">
                  <strong>{t('Fields', 'Fields')}</strong>
                  <span className="fields-badge">{(selectedFarm.fields ?? []).length}</span>
                </div>
                {(selectedFarm.fields ?? []).length === 0 ? (
                  <p className="empty-state">{t('No fields yet — draw a polygon on the map.', 'No fields yet — draw a polygon on the map.')}</p>
                ) : (
                  <div className="field-list">
                    {(selectedFarm.fields ?? []).map((f) => (
                      <div key={f.id}
                        className={`field-list-item ${f.id === selectedFieldId ? 'selected' : ''}`}
                        onClick={() => handleFieldClick(f.id)}
                        role="button" tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleFieldClick(f.id)}
                      >
                        <div className="fli-top">
                          <span className="fli-name fli-name-zoomable" title={t('Click to zoom to this field', 'Click to zoom to this field')}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (f.borderPolygon?.length > 0) {
                                const bb = getBoundingBox([f]);
                                setFieldZoomTarget({ lat: (bb.minLat + bb.maxLat) / 2, lng: (bb.minLng + bb.maxLng) / 2, zoom: 20 });
                                setFarmBoundsFields(null);
                              }
                            }}
                          >{f.fieldName || t('Unnamed', 'Unnamed')}</span>
                          <ChevronRight size={13} className="fli-arrow" />
                        </div>
                        <div className="fli-badges">
                          {f.cropType && <span className="field-badge crop">{t(f.cropType, f.cropType)}</span>}
                          {f.soilType && <span className="field-badge soil">{t(f.soilType, f.soilType)}</span>}
                          {f.irrigated && <span className="field-badge irrigated">💧 {t('Irrigated', 'Irrigated')}</span>}
                        </div>
                        <div className="fli-stats">{f.areaHectares} {t('ha', 'ha')} · {f.perimeterKm} {t('km', 'km')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Climate & Soil panel — auto-fetches when a field is selected ── */}
              {selectedField && (
                <FieldClimatePanel field={selectedField}
                  onSoilDetected={handleSoilDetected}
                  fieldHardinessData={fieldHardinessData}
                  isLoadingHardiness={isLoadingHardiness}
                />
              )}
            </div>
          </>
        )}
      </article>

      <article className="panel farm-map-panel" style={{ position: 'relative', overflow: 'visible' }}>
        <div className="panel-header">
          <span>
            {selectedFarm
              ? <><Layers size={15} style={{ display: 'inline', marginRight: 6 }} />{t('Fields', 'Fields')} — {selectedFarm.farmName}</>
              : <><MapPin size={15} style={{ display: 'inline', marginRight: 6 }} />{t('Map', 'Map')}</>}
          </span>
        </div>
        <div className="location-search-row">
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLocationSearch(); } }}
            placeholder={t('Search address or lat, lng…', 'Search address or lat, lng…')} aria-label={t('Search location', 'Search location')} />
          <button type="button" className="secondary-btn" onClick={handleLocationSearch} disabled={isSearching}>
            {isSearching ? <LoaderCircle size={14} className="spin" /> : t('Find', 'Find')}
          </button>
        </div>
        {searchFeedback.message && <p className={`location-search-feedback ${searchFeedback.type}`}>{searchFeedback.message}</p>}

        <articel className="farm-map" center={INITIAL_CENTER} zoom={13} scrollWheelZoom maxZoom={22}>
          <FarmMap
          mapTargetLocation={mapTargetLocation}
          fieldZoomTarget={fieldZoomTarget}
          farmBoundsFields={farmBoundsFields}
          activeFields={activeFields}
          draftFieldPolygon={draftFieldPolygon}
          draftCropPlacements={draftCropPlacements}
          templatePlants={templatePlants}
          selectedFieldId={selectedFieldId}
          selectedFarm={selectedFarm}
          selectedField={selectedField}
          editingShapeId={editingShapeId}
          treelinePolygon={treelinePolygon}
          onDropCrop={handleCropDroppedOnMap}
          onPolygonDrawn={handleFieldPolygonDrawn}
          onPolygonEdited={handleFieldPolygonEdited}
          onFieldClick={handleFieldClick}
        />
        </articel>
        <button className="map-strata-legend-toggle" type="button" onClick={() => setShowMapLegend((prev) => !prev)}>
            <strong>{showMapLegend ? "Hide Strata Legend" : "Show Strata Legend"}</strong>
          </button>
        <StrataLegend 
            show={showMapLegend} 
            onClose={() => setShowMapLegend(false)} 
        />

        {isFieldPanelOpen && selectedFarm && (
          <FieldPropertiesPanel polygon={activeFieldPoly} existingField={selectedField}
            onSave={handleFieldSave} onCancel={handleFieldCancel} onDelete={handleFieldDelete}
            farmName={selectedFarm.farmName} onEditShape={handleEditShape}
            isEditingShape={editingShapeId === selectedFieldId}
            cropDropFeedback={cropDropFeedback}
            templatePlants={templatePlants}
            templateSourceLabel={(selectedFarm?.template || selectedFarm?.recipe) ? ((selectedFarm?.template || selectedFarm?.recipe).name || selectedFarm.farmName || '') : undefined}
          />
        )}

        {selectedFarm && templateDialogMode && (
          <Template
            open
            mode={templateDialogMode}
            farmName={selectedFarm.farmName}
            initialTemplate={selectedField?.template ?? selectedField?.recipe ?? selectedFarm?.template ?? selectedFarm?.recipe}
            onClose={() => setTemplateDialogMode(null)}
            onSave={handleSaveTemplate}
          />
        )}
      </article>

      <FarmList 
        farms={farms} 
        selectedFarmId={selectedFarmId} 
        onSelectFarm={handleFarmSelect} 
      />

    </section>
  );
}

export default FarmCreationPanel;