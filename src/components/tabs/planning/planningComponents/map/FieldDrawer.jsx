import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';

function FieldDrawer({
  fields, draftPolygon, selectedFieldId, editingShapeId,
  onPolygonDrawn, onPolygonEdited, onFieldClick,
}) {
  const map = useMap();
  const layerMapRef = useRef({});
  const draftLayerRef = useRef(null);
  const drawingRef = useRef(false);
  const onPolygonDrawnRef = useRef(onPolygonDrawn);
  const onPolygonEditedRef = useRef(onPolygonEdited);
  const onFieldClickRef = useRef(onFieldClick);
  const { t } = useTranslation(); // <-- Imported useTranslation

  useEffect(() => { onPolygonDrawnRef.current = onPolygonDrawn; }, [onPolygonDrawn]);
  useEffect(() => { onPolygonEditedRef.current = onPolygonEdited; }, [onPolygonEdited]);
  useEffect(() => { onFieldClickRef.current = onFieldClick; }, [onFieldClick]);

  useEffect(() => {
    if (draftLayerRef.current && map.hasLayer(draftLayerRef.current)) {
      map.removeLayer(draftLayerRef.current);
      draftLayerRef.current = null;
    }

    if (draftPolygon && draftPolygon.length >= 3) {
      draftLayerRef.current = L.polygon(draftPolygon.map((p) => [p.lat, p.lng]), {
        color: '#f59e0b',
        weight: 3,
        fillOpacity: 0.18,
        fillColor: '#fde68a',
        dashArray: '8 6',
      }).addTo(map);
      draftLayerRef.current.bringToFront();
    }

    for (const id of Object.keys(layerMapRef.current)) {
      if (!fields.find((f) => f.id === Number(id))) {
        const layer = layerMapRef.current[id];
        if (map.hasLayer(layer)) map.removeLayer(layer);
        delete layerMapRef.current[id];
      }
    }
    for (const field of fields) {
      const isSelected     = field.id === selectedFieldId;
      const isEditingShape = field.id === editingShapeId;
      const style = isSelected || isEditingShape
        ? { color: '#f59e0b', weight: 3.5, fillOpacity: 0.30, fillColor: '#fde68a', dashArray: null }
        : { color: '#ffffff', weight: 2.5, fillOpacity: 0.10, fillColor: '#4ade80', dashArray: null };
      const existingLayer = layerMapRef.current[field.id];
      if (existingLayer && map.hasLayer(existingLayer)) {
        existingLayer.setStyle(style);
        if (isEditingShape) {
          if (!existingLayer.pm.enabled()) existingLayer.pm.enable({ allowSelfIntersection: false });
        } else {
          if (existingLayer.pm.enabled()) existingLayer.pm.disable();
        }
      } else {
        if (existingLayer && map.hasLayer(existingLayer)) map.removeLayer(existingLayer);
        const layer = L.polygon(field.borderPolygon.map((p) => [p.lat, p.lng]), style).addTo(map);
        layer.on('click', () => onFieldClickRef.current(field.id));
        layer.bindTooltip(field.fieldName || t('Unnamed field', 'Unnamed field'), { permanent: false, direction: 'center', className: 'field-tooltip' });
        layerMapRef.current[field.id] = layer;
        if (isEditingShape) layer.pm.enable({ allowSelfIntersection: false });
      }
    }
  }, [fields, draftPolygon, selectedFieldId, editingShapeId, map, t]);

  useEffect(() => {
    if (!editingShapeId) return;
    const layer = layerMapRef.current[editingShapeId];
    if (!layer) return;
    const onEdit = () => {
      const coords = layer.getLatLngs()[0].map(({ lat, lng }) => ({ lat, lng }));
      onPolygonEditedRef.current(editingShapeId, coords);
    };
    map.on('pm:edit', onEdit);
    return () => { map.off('pm:edit', onEdit); if (layer.pm.enabled()) layer.pm.disable(); };
  }, [editingShapeId, map]);

  useEffect(() => {
    map.pm.addControls({
      position: 'topright',
      drawMarker: false, drawCircleMarker: false, drawRectangle: false,
      drawCircle: false, drawPolyline: false, drawText: false,
      drawPolygon: true, editMode: false, dragMode: false,
      cutPolygon: false, removalMode: false,
    });
    map.pm.setPathOptions({ color: '#f59e0b', weight: 2.5, fillOpacity: 0.22 });
    const onCreate = (e) => {
      if (drawingRef.current) return;
      if (!(e.layer instanceof L.Polygon)) return;
      drawingRef.current = true;
      const coords = e.layer.getLatLngs()[0].map(({ lat, lng }) => ({ lat, lng }));
      map.removeLayer(e.layer);
      onPolygonDrawnRef.current(coords);
      setTimeout(() => { drawingRef.current = false; }, 100);
    };
    map.on('pm:create', onCreate);
    return () => { map.off('pm:create', onCreate); map.pm.removeControls(); };
  }, [map]);

  useEffect(() => () => {
    Object.values(layerMapRef.current).forEach((l) => { if (map.hasLayer(l)) map.removeLayer(l); });
    if (draftLayerRef.current && map.hasLayer(draftLayerRef.current)) {
      map.removeLayer(draftLayerRef.current);
      draftLayerRef.current = null;
    }
  }, [map]);

  return null;
}

export default FieldDrawer;