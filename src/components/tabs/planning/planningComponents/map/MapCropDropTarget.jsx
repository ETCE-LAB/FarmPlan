import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { DRAG_CROP_MIME } from '../../utils/constants';

function MapCropDropTarget({ onDropCrop }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    const handleDragOver = (event) => {
      const hasCrop = event.dataTransfer?.types?.includes(DRAG_CROP_MIME) ||
                     event.dataTransfer?.types?.includes('application/json');
      if (!hasCrop) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (event) => {
      const payload = event.dataTransfer?.getData(DRAG_CROP_MIME) ||
                     event.dataTransfer?.getData('application/json');
      if (!payload) return;

      event.preventDefault();

      let crop;
      try {
        crop = JSON.parse(payload);
      } catch {
        return;
      }

      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const latLng = map.containerPointToLatLng([x, y]);

      onDropCrop(crop, { lat: latLng.lat, lng: latLng.lng });
    };

    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
    };
  }, [map, onDropCrop]);

  return null;
}

export default MapCropDropTarget;