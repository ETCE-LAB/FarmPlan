import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

function FieldZoomNavigator({ target }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.8 });
  }, [map, target]);

  return null;
}

export default FieldZoomNavigator;