import { useEffect, useState } from 'react';
import { getShrubStrataCrops } from '../../../../../utils/dashboardApi';
import PlantImage from '../../PlantImage';

const DRAG_CROP_MIME = 'application/x-farm-crop';

function parseSpacingMeters(value) {
  if (value === null || value === undefined) return 1;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0.25, value);
  const text = String(value).replace(',', '.');
  const matched = text.match(/\d+(?:\.\d+)?/);
  if (!matched) return 1;
  const parsed = Number(matched[0]);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(0.25, parsed);
}

function toCropRecord(row) {
  const minimumSpacingRaw = row?.rawDetails?.minimum_spacing ?? row?.minimum_spacing ?? '';
  return {
    id: row?.id || row?.source_id || '',
    name: row?.crop || row?.name || 'Unknown crop',
    latinName: row?.rawDetails?.latin_name || '',
    minimumSpacingRaw,
    minimumSpacingMeters: parseSpacingMeters(minimumSpacingRaw),
  };
}

function DragDropCrops({ selectedCropType, onSelectCropType, crops: providedCrops, sourceLabel }) {
  const hasProvidedCrops = providedCrops !== undefined;
  const [crops, setCrops] = useState(providedCrops || []);
  const [isLoading, setIsLoading] = useState(!hasProvidedCrops);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    if (hasProvidedCrops) {
      setCrops(providedCrops || []);
      setError('');
      setIsLoading(false);
      return () => { mounted = false; };
    }
    async function loadShrubCrops() {
      setIsLoading(true);
      setError('');
      try {
        const rows = await getShrubStrataCrops(6);
        if (!mounted) return;
        setCrops(rows.map(toCropRecord));
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || 'Could not load shrub crops.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadShrubCrops();
    return () => { mounted = false; };
  }, [hasProvidedCrops, providedCrops]);

  const handleDragStart = (event, crop) => {
    if (onSelectCropType) onSelectCropType(crop.name);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(DRAG_CROP_MIME, JSON.stringify(crop));
    event.dataTransfer.setData('application/json', JSON.stringify(crop));
  };

  return (
    <div className="ddc-wrap">
      <div className="ddc-cards">
        {isLoading && <p className="ddc-meta">Loading shrub crops...</p>}
        {!isLoading && error && <p className="ddc-error">{error}</p>}
        {!isLoading && !error && crops.map((crop) => (
          <button
            key={crop.id}
            type="button"
            className={`ddc-card ${selectedCropType === crop.name ? 'active' : ''}`}
            draggable
            onDragStart={(event) => handleDragStart(event, crop)}
            onClick={() => onSelectCropType && onSelectCropType(crop.name)}
            title={`${crop.name}${crop.latinName ? ` (${crop.latinName})` : ''} — min. spacing: ${crop.minimumSpacingRaw || `${crop.minimumSpacingMeters} m`}`}
          >
            <PlantImage sourceId={crop.id} size="card" alt={crop.name} />
            <span className="ddc-name">{crop.name}</span>
            <span className="ddc-spacing">{crop.minimumSpacingMeters} m spacing</span>
          </button>
        ))}
      </div>
      <div className="ddc-footer">
        <span>{sourceLabel ? `Template plants for ${sourceLabel}.` : 'Drag a card onto the map inside the active field polygon.'}</span>
      </div>
    </div>
  );
}

export default DragDropCrops;