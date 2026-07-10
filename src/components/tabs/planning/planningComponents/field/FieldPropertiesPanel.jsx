import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Droplets, LocateFixed, MapPin, Ruler, Wheat } from 'lucide-react';
import DragDropCrops from './DragDropCrops';
import { calcArea, calcPerimeter } from '../../utils/geometry';

export default function FieldPropertiesPanel({
  polygon,
  existingField,
  onSave,
  onCancel,
  onDelete,
  farmName,
  onEditShape,
  isEditingShape,
  cropDropFeedback,
  templatePlants,
  templateSourceLabel,
}) {
  const [form, setForm] = useState(
    existingField
      ? {
          fieldName: existingField.fieldName,
          cropType: existingField.cropType,
          soilType: existingField.soilType,
          irrigated: existingField.irrigated,
          notes: existingField.notes,
          autoSpacingEnabled: Boolean(existingField.autoSpacingEnabled),
        }
      : {
          fieldName: '',
          cropType: '',
          soilType: '',
          irrigated: false,
          notes: '',
          autoSpacingEnabled: true,
        }
  );
  const [errors, setErrors] = useState({});
  const { t } = useTranslation();

  useEffect(() => {
    if (existingField) {
      setForm({
        fieldName: existingField.fieldName,
        cropType: existingField.cropType,
        soilType: existingField.soilType,
        irrigated: existingField.irrigated,
        notes: existingField.notes,
        autoSpacingEnabled: Boolean(existingField.autoSpacingEnabled),
      });
    } else {
      setForm({
        fieldName: '',
        cropType: '',
        soilType: '',
        irrigated: false,
        notes: '',
        autoSpacingEnabled: true,
      });
    }
    setErrors({});
  }, [existingField]);

  const area = useMemo(() => calcArea(polygon) / 10000, [polygon]);
  const perimeter = useMemo(() => calcPerimeter(polygon) / 1000, [polygon]);

  const validate = () => {
    const next = {};
    if (!form.fieldName.trim()) {
      next.fieldName = t('Field name is required.', 'Field name is required.');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      ...form,
      borderPolygon: polygon.map((p) => ({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) })),
      areaHectares: Number(area.toFixed(2)),
      perimeterKm: Number(perimeter.toFixed(2)),
    });
  };

  return (
    <aside className="field-props-panel">
      <div className="fpp-header">
        <div className="fpp-header-left">
          <div className="fpp-header-icon">🌿</div>
          <div>
            <div className="fpp-title">{existingField ? t('Edit Field', 'Edit Field') : t('New Field', 'New Field')}</div>
            {farmName && <div className="fpp-subtitle">{t('in', 'in')} {farmName}</div>}
          </div>
        </div>
        <button className="fpp-close" type="button" onClick={onCancel}>✕</button>
      </div>
      <div className="fpp-metrics-bar">
        <div className="fpp-metric"><Ruler size={13} /><span>{area.toFixed(2)} {t('ha', 'ha')}</span></div>
        <div className="fpp-metric-divider" />
        <div className="fpp-metric"><LocateFixed size={13} /><span>{perimeter.toFixed(2)} {t('km', 'km')}</span></div>
        <div className="fpp-metric-divider" />
        <div className="fpp-metric"><MapPin size={13} /><span>{polygon.length} {t('pts', 'pts')}</span></div>
      </div>
      <div className="fpp-body">
        <div className="fpp-field-group">
          <label className="fpp-label">{t('Field Name', 'Field Name')} <span className="fpp-req">*</span></label>
          <input
            className={`fpp-input ${errors.fieldName ? 'fpp-input-error' : ''}`}
            value={form.fieldName}
            onChange={(e) => {
              setForm((p) => ({ ...p, fieldName: e.target.value }));
              if (errors.fieldName) setErrors((p) => ({ ...p, fieldName: undefined }));
            }}
            placeholder={t('e.g., North Plot A', 'e.g., North Plot A')}
          />
          {errors.fieldName && <p className="fpp-error-msg">{errors.fieldName}</p>}
        </div>
        <div className="fpp-field-group">
          <label className="fpp-label">{t('Crop Type', 'Crop Type')}</label>
          <DragDropCrops
            selectedCropType={form.cropType}
            crops={templatePlants}
            sourceLabel={templateSourceLabel}
            onSelectCropType={(cropName) => {
              setForm((prev) => ({ ...prev, cropType: cropName }));
              if (errors.cropType) setErrors((prev) => ({ ...prev, cropType: undefined }));
            }}
          />
          {cropDropFeedback && <p className="ddc-map-feedback">{t(cropDropFeedback, cropDropFeedback)}</p>}
          {errors.cropType && <p className="fpp-error-msg">{errors.cropType}</p>}
        </div>
        {existingField?.soilType && (
          <div className="fpp-field-group">
            <label className="fpp-label">{t('Soil Type', 'Soil Type')}</label>
            <div className="fpp-input" style={{ background: '#f8fafc', color: '#475569' }}>
              🌱 {t(existingField.soilType, existingField.soilType)} <span style={{ fontSize: 11, color: '#94a3b8' }}>({t('auto-detected', 'auto-detected')})</span>
            </div>
          </div>
        )}
        <div className="fpp-field-group">
          <label className="fpp-label"><Droplets size={13} style={{ display: 'inline', marginRight: 4 }} />{t('Irrigation', 'Irrigation')}</label>
          <div className="fpp-toggle-row">
            <button type="button" className={`fpp-toggle-opt ${form.irrigated ? 'active' : ''}`} onClick={() => setForm((p) => ({ ...p, irrigated: true }))}>
              💧 {t('Yes, irrigated', 'Yes, irrigated')}
            </button>
            <button type="button" className={`fpp-toggle-opt ${!form.irrigated ? 'active' : ''}`} onClick={() => setForm((p) => ({ ...p, irrigated: false }))}>
              🌧 {t('Rain-fed only', 'Rain-fed only')}
            </button>
          </div>
        </div>
        <div className="fpp-field-group">
          <label className="fpp-label">{t('Auto spacing', 'Auto spacing')}</label>
          <div className="fpp-toggle-row">
            <button
              type="button"
              className={`fpp-toggle-opt ${form.autoSpacingEnabled ? 'active' : ''}`}
              onClick={() => setForm((p) => ({ ...p, autoSpacingEnabled: true }))}
              aria-pressed={form.autoSpacingEnabled}
            >
              {t('Enabled', 'Enabled')}
            </button>
            <button
              type="button"
              className={`fpp-toggle-opt ${!form.autoSpacingEnabled ? 'active' : ''}`}
              onClick={() => setForm((p) => ({ ...p, autoSpacingEnabled: false }))}
              aria-pressed={!form.autoSpacingEnabled}
            >
              {t('Disabled', 'Disabled')}
            </button>
          </div>
          <div className={`fpp-toggle-help ${form.autoSpacingEnabled ? 'active' : 'inactive'}`}>
            <strong>
              {form.autoSpacingEnabled ? t('Auto spacing is on.', 'Auto spacing is on.') : t('Auto spacing is off.', 'Auto spacing is off.')}
            </strong>
            <span>
              {form.autoSpacingEnabled
                ? t('Dropped crops will be nudged to the nearest valid spot inside the field if needed.', 'Dropped crops will be nudged to the nearest valid spot inside the field if needed.')
                : t('Dropped crops must fit exactly where you place them.', 'Dropped crops must fit exactly where you place them.')}
            </span>
          </div>
        </div>
        <div className="fpp-field-group">
          <label className="fpp-label">{t('Notes', 'Notes')}</label>
          <textarea
            className="fpp-textarea"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder={t('Soil tests, irrigation plan, observations…', 'Soil tests, irrigation plan, observations…')}
          />
        </div>
        {existingField && (
          <button type="button" className={`fp-edit-shape-btn ${isEditingShape ? 'active' : ''}`} onClick={() => onEditShape(existingField.id)}>
            {isEditingShape ? t('✓ Finish Reshaping', '✓ Finish Reshaping') : t('✏ Edit Shape on Map', '✏ Edit Shape on Map')}
          </button>
        )}
      </div>
      <div className="fpp-footer">
        {existingField && (
          <button type="button" className="fpp-btn fpp-btn-danger" onClick={() => onDelete(existingField.id)}>{t('Delete', 'Delete')}</button>
        )}
        <button type="button" className="fpp-btn fpp-btn-ghost" onClick={onCancel}>{t('Cancel', 'Cancel')}</button>
        <button type="button" className="fpp-btn fpp-btn-primary" onClick={handleSave}>
          <Wheat size={14} /> {t('Save Field', 'Save Field')}
        </button>
      </div>
    </aside>
  );
}
