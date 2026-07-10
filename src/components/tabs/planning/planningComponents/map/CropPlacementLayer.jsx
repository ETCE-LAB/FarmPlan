import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getStrataCircleStyle, mapPlanPlacementToLatLng, isPointInPolygon } from '../../utils/geometry';
import { buildTreelines, snapToNearestTreeline } from '../../utils/treelines';


function CropPlacementLayer({
    fields,
    draftPolygon,
    draftPlacements,
    templatePlants,
    selectedFieldId,
    generatedPlacements
}) {
  const map = useMap();
  const layerGroupRef = useRef(null);
  const plantMarkersRef = useRef([]);
  const strataLookup = useMemo(() => {
    const lookup = new Map();
    (templatePlants || []).forEach((plant) => {
      if (plant?.id) lookup.set(String(plant.id), plant);
      if (plant?.name) lookup.set(String(plant.name).toLowerCase(), plant);
      if (plant?.crop) lookup.set(String(plant.crop).toLowerCase(), plant);
    });
    return lookup;
  }, [templatePlants]);

  const resolvePlacementStrata = useCallback((placement) => {
    if (placement?.strata) return placement.strata;
    const byId = placement?.cropId ? strataLookup.get(String(placement.cropId)) : null;
    if (byId?.strata) return byId.strata;
    const byName = placement?.cropName ? strataLookup.get(String(placement.cropName).toLowerCase()) : null;
    return byName?.strata || '';
  }, [strataLookup]);

  // Pre-compute treelines for the selected field so we can snap generated placements
  const selectedField = useMemo(
    () => fields?.find(f => f.id === selectedFieldId) ?? null,
    [fields, selectedFieldId]
  );

  const selectedFieldTreelines = useMemo(
    () => buildTreelines(selectedField?.borderPolygon ?? []),
    [selectedField]
  );

  const selectedFieldRef = useMemo(() => {
    if (!selectedField?.borderPolygon?.length) return null;
    const poly = selectedField.borderPolygon;
    const refLat = poly.reduce((s, p) => s + p.lat, 0) / poly.length;
    const refLng = poly.reduce((s, p) => s + p.lng, 0) / poly.length;
    return { refLat, refLng };
  }, [selectedField]);

  useEffect(() => {
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map);
    }

    const group = layerGroupRef.current;
    group.clearLayers();

    (fields || []).forEach((field) => {
      (field.cropPlacements || []).forEach((placement) => {
        const latLng = [placement.lat, placement.lng];
        const strata = resolvePlacementStrata(placement);
        const strataStyle = getStrataCircleStyle(strata);

        L.circle(latLng, {
          radius: placement.minimumSpacingMeters,
          ...strataStyle,
          weight: 2,
          fillOpacity: 0.08,
        }).addTo(group);

        L.circleMarker(latLng, {
          radius: 5,
          color: strataStyle.color,
          weight: 2,
          fillColor: strataStyle.fillColor,
          fillOpacity: 1,
        })
          .bindTooltip(`${placement.cropName}${strata ? ` · ${strata}` : ''} (${placement.minimumSpacingMeters}m)`, {
            permanent: false,
            direction: 'top',
          })
          .addTo(group);
      });
    });

    const hasDraftPolygon = draftPolygon && draftPolygon.length >= 3;
    if (hasDraftPolygon) {
      (draftPlacements || []).forEach((placement) => {
        const latLng = [placement.lat, placement.lng];
        const strata = resolvePlacementStrata(placement);
        const strataStyle = getStrataCircleStyle(strata);

        L.circle(latLng, {
          radius: placement.minimumSpacingMeters,
          ...strataStyle,
          weight: 2,
          fillOpacity: 0.08,
          dashArray: '6 4',
        }).addTo(group);

        L.circleMarker(latLng, {
          radius: 5,
          color: strataStyle.color,
          weight: 2,
          fillColor: strataStyle.fillColor,
          fillOpacity: 1,
        })
          .bindTooltip(`Draft: ${placement.cropName}${strata ? ` · ${strata}` : ''} (${placement.minimumSpacingMeters}m)`, {
            permanent: false,
            direction: 'top',
          })
          .addTo(group);
      });
    }

    console.log("(Before)Rendering generated placements:", generatedPlacements, "for selected field:", selectedField);

    (fields || []).forEach((field) => {
      if (!field.template?.generatedPlacements && !field.recipe?.generatedPlacements) {
        return;
      }

      const isSelectedField = field.id === selectedFieldId;

      const fieldTreelines = buildTreelines(field.borderPolygon ?? []);
      const fieldRef = (() => {
        if (!field?.borderPolygon?.length) return null;
        const poly = field.borderPolygon;
        const refLat = poly.reduce((s, p) => s + p.lat, 0) / poly.length;
        const refLng = poly.reduce((s, p) => s + p.lng, 0) / poly.length;
        return { refLat, refLng };
      })();

      // Render each generated placement for this field
      const generatedPlacementsForField = field.template?.generatedPlacements || field.recipe?.generatedPlacements || [];
      generatedPlacementsForField.forEach((placement) => {
        let point = mapPlanPlacementToLatLng(placement, field);
        if (!point) return;

        // ── Snap to nearest treeline ──────────────────────────────────────
        if (fieldTreelines.length > 0 && fieldRef) {
          const snapped = snapToNearestTreeline(
            point,
            fieldTreelines,
            fieldRef.refLat,
            fieldRef.refLng,
          );
          // Only use snapped if it stays inside the polygon
          if (isPointInPolygon(snapped, field.borderPolygon)) {
            point = snapped;
          }
        }

        const latLng = [point.lat, point.lng];
        const strata = placement.strata || '';
        const style = getStrataCircleStyle(strata);
        const radius = placement.spacing_m ?? placement.minimumSpacingMeters ?? 2;

        // Different styling based on selection state
        const dashArray = isSelectedField ? '4 5' : '8 4';
        const fillOpacity = isSelectedField ? 0.15 : 0.08;
        const weight = isSelectedField ? 2.5 : 1.5;

        L.circle(latLng, {
          radius,
          color: style.color,
          fillColor: style.fillColor,
          weight,
          fillOpacity,
          dashArray,
        }).addTo(group);

        const marker = L.circleMarker(latLng, {
          radius: isSelectedField ? 7 : 5,
          color: style.color,
          fillColor: style.fillColor,
          weight: isSelectedField ? 2.5 : 2,
          fillOpacity: 1,
        })
          .bindTooltip(
            `${placement.english_name || placement.german_name || placement.species_id}${strata ? ` · ${strata}` : ''}`,
            { 
              permanent: false, 
              direction: 'top',
            }
          )
          .addTo(group);

          plantMarkersRef.current.push(marker);
      });
    });
    plantMarkersRef.current.forEach(marker => marker.bringToFront());
  }, [map, fields, draftPolygon, draftPlacements, resolvePlacementStrata, selectedFieldId]);

  useEffect(() => () => {
    if (layerGroupRef.current && map.hasLayer(layerGroupRef.current)) {
      map.removeLayer(layerGroupRef.current);
      layerGroupRef.current = null;
    }
  }, [map]);

  return null;
}

export default CropPlacementLayer;