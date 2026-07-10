import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../style/FarmCreationPanel.css';

const STRATA_ITEMS = [
  { label: 'Emergent Canopy', color: '#a41df9' },
  { label: 'High Canopy', color: '#2a42ce' },
  { label: 'High Tree', color: '#16b3b3' },
  { label: 'Medium Tree', color: '#189938' },
  { label: 'Low/Medium Tree', color: '#79fd05' },
  { label: 'Low Tree', color: '#e8f832' },
  { label: 'Shrub', color: '#ffcd38' },
  { label: 'Wetland Herb', color: '#d57609' },
  { label: 'Herb', color: '#5e4914' },
  { label: 'Other', color: '#ff0101' },
];

function StrataLegend({ show = true, className = '' }) {
  const { t } = useTranslation();

  if (!show) return null;

  return (
    <div className={`map-strata-legend ${className}`}>
      <h4>{t('Strata Legend', 'Strata Legend')}</h4>
      
      {STRATA_ITEMS.map((item) => (
        <div key={item.label} className="legend-item">
          <span 
            className="legend-color" 
            style={{ background: item.color }} 
          />
          {t(item.label, item.label)}
        </div>
      ))}
    </div>
  );
}

export default StrataLegend;