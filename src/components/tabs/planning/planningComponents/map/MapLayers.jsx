import React from 'react';
import { LayersControl, TileLayer } from 'react-leaflet';
import { useTranslation } from 'react-i18next';

function MapLayers() {
  const { t } = useTranslation();

  return (
    <LayersControl position="topleft">
      <LayersControl.BaseLayer name={t('OpenStreetMap', 'OpenStreetMap')}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
      </LayersControl.BaseLayer>
      
      <LayersControl.BaseLayer name={t('Satellite (Esri)', 'Satellite (Esri)')}>
        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
      </LayersControl.BaseLayer>
      
      <LayersControl.BaseLayer checked name={t('Satellite HD (Google)', 'Satellite HD (Google)')}>
        <TileLayer
          attribution="&copy; Google Maps"
          url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
          maxZoom={22}
        />
      </LayersControl.BaseLayer>
      
      <LayersControl.BaseLayer name={t('Hybrid (Google)', 'Hybrid (Google)')}>
        <TileLayer
          attribution="&copy; Google Maps"
          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          maxZoom={22}
        />
      </LayersControl.BaseLayer>
    </LayersControl>
  );
}

export default MapLayers;