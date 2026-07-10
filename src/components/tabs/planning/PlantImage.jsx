import { useState } from 'react';
import './style/PlantImage.css';
import { usePlantImage } from '../../../hooks/usePlantImage';

// Default fallback image — a generic green plant photo from Wikimedia Commons (CC0)
const DEFAULT_PLANT_IMG = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/320px-Camponotus_flavomarginatus_ant.jpg';

// A simple green leaf SVG used as instant placeholder before anything loads
const LEAF_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><rect width='80' height='80' rx='8' fill='%23f0fdf4'/><text x='40' y='52' text-anchor='middle' font-size='36'>🌿</text></svg>`;

function PlantImage({ sourceId, size = 'panel', alt = '' }) {
  const { image, isLoading } = usePlantImage(sourceId);
  const [imgError, setImgError] = useState(false);

  const displayUrl = (!image || imgError) ? LEAF_PLACEHOLDER : image.image_url;

  // ── Card size ────────────────────────────────────────────────────────────
  if (size === 'card') {
    return (
      <div className="pi-card-wrap">
        <img
          src={isLoading ? LEAF_PLACEHOLDER : displayUrl}
          alt={alt || image?.plant_name || 'Plant'}
          className={`pi-card-img ${isLoading ? 'pi-card-img--loading' : ''}`}
          loading="lazy"
          onError={() => setImgError(true)}
        />
        {image && !imgError && (
          <div className="pi-card-attribution">
            <span className="pi-card-author">© {image.author_name}</span>
            {' · '}
            <a href={image.license_url} target="_blank" rel="noopener noreferrer" className="pi-card-license">
              {image.license_name}
            </a>
          </div>
        )}
      </div>
    );
  }

// ── Panel size ───────────────────────────────────────────────────────────
if (isLoading) {
  return (
    <div className="pi-panel-wrap">
      <img
        src={LEAF_PLACEHOLDER}
        alt="Loading..."
        className="pi-panel-img pi-panel-img--fallback"
      />
    </div>
  );
}

if (!image || imgError) {
  return (
    <div className="pi-panel-wrap">
      <img
        src={LEAF_PLACEHOLDER}
        alt={alt || 'Plant'}
        className="pi-panel-img pi-panel-img--fallback"
      />
    </div>
  );
}

  return (
    <div className="pi-panel-wrap">
      <img
        src={image.image_url}
        alt={alt || image.plant_name}
        className="pi-panel-img"
        loading="lazy"
        onError={() => setImgError(true)}
      />
      <p className="pi-panel-attribution">
        <span className="pi-attr-label">Photo:</span>{' '}
        <span>{image.author_name}</span>
        {' '}via{' '}
        <a href={image.source_page_url} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>
        {' — '}
        <a href={image.license_url} target="_blank" rel="noopener noreferrer">{image.license_name}</a>
      </p>
    </div>
  );
}

export default PlantImage;