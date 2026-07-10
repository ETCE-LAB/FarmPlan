import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import '../../style/FarmCreationPanel.css';

function FarmList({ farms = [], selectedFarmId, onSelectFarm }) {
  const { t } = useTranslation();

  const handleFarmSelect = useCallback((id) => {
    // Call the parent's onSelectFarm with the farm id
    // The parent component will handle all the state management
    onSelectFarm(id);
  }, [onSelectFarm]);

  return (
    <section className="panel farm-list-panel">
      <div className="panel-header">
        <span>🏡 {t('Saved Farms', 'Saved Farms')} ({farms.length})</span>
      </div>
      
      {farms.length === 0 ? (
        <p className="empty-state">
          {t('No farms saved yet. Fill in the form above to register your first farm.', 
             'No farms saved yet. Fill in the form above to register your first farm.')}
        </p>
      ) : (
        <div className="farm-list">
          {farms.map((farm) => (
            <div
              key={farm.id}
              className={`farm-list-item ${farm.id === selectedFarmId ? 'selected' : ''}`}
              onClick={() => handleFarmSelect(farm.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleFarmSelect(farm.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="fli-top">
                <span className="farm-list-name">{farm.farmName}</span>
                <span className="field-badge crop">
                  {(farm.fields ?? []).length} {t('field', 'field')}
                  {(farm.fields ?? []).length !== 1 ? t('s', 's') : ''}
                </span>
              </div>
              <p className="farm-list-loc">{farm.location}</p>
              <small className="farm-list-stats">{farm.ownerName}</small>
              
              {farm.id === selectedFarmId && (
                <div style={{ 
                  marginTop: 8, 
                  fontSize: 12, 
                  color: 'var(--farm-green-main)', 
                  fontWeight: 600 
                }}>
                  ✓ {t('Selected — draw fields on the map', 'Selected — draw fields on the map')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default FarmList;