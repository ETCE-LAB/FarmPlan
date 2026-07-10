import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

function MapNavigator({ targetLocation }) {
  const map = useMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!targetLocation) return;
    
    map.flyTo([targetLocation.lat, targetLocation.lng], 16, { duration: 0.8 });
    
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
    }
    
    markerRef.current = L.circleMarker(
      [targetLocation.lat, targetLocation.lng],
      {
        radius: 7,
        color: '#1b5e20',
        fillColor: '#2e7d32',
        fillOpacity: 0.8,
        weight: 2,
      }
    ).addTo(map);
  }, [map, targetLocation]);

  useEffect(() => {
    return () => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }
    };
  }, [map]);

  return null;
}

export default MapNavigator;