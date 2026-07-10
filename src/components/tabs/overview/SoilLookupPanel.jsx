import { useState, useEffect } from 'react';
import { MapPin, LoaderCircle, AlertCircle, Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SOIL_SERVICES } from '../../../data/dashboardData';
import { transformCoordinates, getPrimaryResultValue, getAttributePreview } from '../../../utils/soilUtils';
import './SoilLookupPanel.css';

// 1. Accept your real Firebase farms as a prop
function SoilLookupPanel({ farms = [] }) {
  const { t } = useTranslation();
  
  // 2. State for selecting a farm instead of manual coordinates
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [serviceKey, setServiceKey] = useState('bodenpotenziale');
  const [loadingSoil, setLoadingSoil] = useState(false);
  const [soilError, setSoilError] = useState('');
  const [soilData, setSoilData] = useState(null);

  const activeService = SOIL_SERVICES[serviceKey];
  const soilResults = soilData?.results || [];

  // Automatically select the first farm if none is selected yet
  useEffect(() => {
    if (farms.length > 0 && !selectedFarmId) {
      setSelectedFarmId(farms[0].id);
    }
  }, [farms, selectedFarmId]);

  const lookupSoilData = async () => {
    // 3. Find the exact farm the user selected from Firebase
    const selectedFarm = farms.find((f) => f.id === selectedFarmId);
    
    if (!selectedFarm || !selectedFarm.borderPolygon || selectedFarm.borderPolygon.length === 0) {
      setSoilError(t('soil.errors.no_polygon', 'No map data found for this farm.'));
      return;
    }

    // Grab the first coordinate point of the farm's polygon border
    const firstPoint = selectedFarm.borderPolygon[0];
    
    // Safely extract Lat/Lng whether it was saved as an array [lat, lng] or object {lat, lng}
    const latNum = Number(firstPoint.lat !== undefined ? firstPoint.lat : firstPoint[0]);
    const lonNum = Number(firstPoint.lng !== undefined ? firstPoint.lng : firstPoint[1]);

    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
      setSoilError(t('soil.errors.invalid_coords', 'Invalid farm coordinates in database.'));
      setSoilData(null);
      return;
    }

    setLoadingSoil(true);
    setSoilError('');

    // 4. Run your friend's exact API fetch logic using your real farm coordinates
    try {
      const [x, y] = transformCoordinates(latNum, lonNum, activeService.spatialRef);

      const params = new URLSearchParams({
        geometry: `${x},${y}`,
        geometryType: 'esriGeometryPoint',
        sr: activeService.spatialRef.replace('EPSG:', ''),
        layers: 'all',
        tolerance: '1',
        mapExtent: '9,50,12,53',
        imageDisplay: '800,600,96',
        returnGeometry: 'false',
        f: 'json',
      });

      const response = await fetch(`/api/bgr/arcgis/rest/services/${activeService.path}/MapServer/identify?${params.toString()}`);

      if (!response.ok) {
        throw new Error(t('soil.errors.http_fail', { status: response.status }));
      }

      const payload = await response.json();

      if (payload.error) {
        throw new Error(payload.error.message || t('soil.errors.api_error'));
      }

      setSoilData(payload);
    } catch (error) {
      setSoilData(null);
      setSoilError(error.message || t('soil.errors.generic'));
    } finally {
      setLoadingSoil(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      
        {t('soil.title', 'Farm Soil Quality Analysis')}
      </div>
      
      <div className="soil-form">
        {/* Changed the manual Lat/Lng inputs to a dropdown of your real farms */}
        <label>
          {t('soil.farm_label', 'Select Farm')}
          <select value={selectedFarmId} onChange={(e) => {
            setSelectedFarmId(e.target.value);
            setSoilData(null); // Clear old results when picking a new farm
          }}>
            {farms.length === 0 ? (
              <option value="">{t('soil.no_farms', 'No farms saved yet')}</option>
            ) : (
              farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.farmName} ({farm.areaHectares} {t('ha')})
                </option>
              ))
            )}
          </select>
        </label>

        <label className="soil-service-select">
          {t('soil.service_label', 'Analysis Type')}
          <select value={serviceKey} onChange={(e) => setServiceKey(e.target.value)}>
            {Object.entries(SOIL_SERVICES).map(([key, service]) => (
              <option key={key} value={key}>
                {t(`soil.services.${key}`, service.label)}
              </option>
            ))}
          </select>
        </label>

        <button className="soil-lookup-btn" type="button" onClick={lookupSoilData} disabled={loadingSoil || farms.length === 0}>
          {loadingSoil ? <LoaderCircle size={14} className="spin" /> : <MapPin size={14} />} 
          {t('soil.button_run', 'Analyze Soil')}
        </button>
      </div>

      {soilError && (
        <div className="soil-error">
          <AlertCircle size={14} /> {soilError}
        </div>
      )}

      {soilData && (
        <div className="soil-results-wrap">
          <p className="soil-meta">{t('soil.hits', 'Data Layers Found')}: {soilResults.length}</p>
          <div className="soil-results-list">
            {soilResults.slice(0, 6).map((result) => (
              <article key={`${result.layerId}-${result.layerName}`} className="soil-result-item">
                <h4>{result.layerName || `${t('soil.layer')} ${result.layerId}`}</h4>
                <p className="soil-main-value">{getPrimaryResultValue(result)}</p>
                <p className="soil-attr-preview">{getAttributePreview(result.attributes)}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default SoilLookupPanel;