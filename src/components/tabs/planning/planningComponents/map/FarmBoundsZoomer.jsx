import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { getBoundingBox } from '../../utils/geometry';

function FarmBoundsZoomer({ fields }) {
  const map = useMap();

  useEffect(() => {
    if (!fields || fields.length === 0) return;
    
    const bb = getBoundingBox(fields);
    if (!bb) return;
    
    map.flyToBounds(
      [[bb.minLat, bb.minLng], [bb.maxLat, bb.maxLng]],
      { padding: [48, 48], duration: 0.9, maxZoom: 17 }
    );
  }, [fields, map]);

  return null;
}

export default FarmBoundsZoomer;