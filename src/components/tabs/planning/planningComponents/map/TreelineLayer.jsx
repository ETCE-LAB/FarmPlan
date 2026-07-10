import { useEffect, useRef, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { buildTreelines } from '../../utils/treelines';

function TreelineLayer({ fieldPolygons }) {
  const map = useMap();
  const layerGroupRef = useRef(null);

  const allTreelines = useMemo(() => {
    if (!fieldPolygons || fieldPolygons.length === 0) return [];
    
    return fieldPolygons.flatMap(({ polygon, fieldId, fieldName }) => {
      const treelines = buildTreelines(polygon);
      return treelines.map(tl => ({ ...tl, fieldId, fieldName }));
    });
  }, [fieldPolygons]);

  useEffect(() => {
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map);
    }
    const group = layerGroupRef.current;
    group.clearLayers();

    for (const tl of allTreelines) {
      const color = tl.widthM >= 1.5 ? '#14532d' : '#166534';
      const fillClr = tl.widthM >= 1.5 ? '#15803d' : '#22c55e';

      for (const quad of tl.segments) {
        L.polygon(quad, {
          color,
          weight: 1,
          fillColor: fillClr,
          fillOpacity: 0.45,
          interactive: true,
        }).addTo(group);
      }
    }
  }, [map, allTreelines]);

  useEffect(() => {
    return () => {
      if (layerGroupRef.current && map.hasLayer(layerGroupRef.current)) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
    };
  }, [map]);

  return null;
}

export default TreelineLayer;