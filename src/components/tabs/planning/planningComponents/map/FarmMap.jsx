import React from 'react';
import { MapContainer } from 'react-leaflet';
import {
  MapNavigator,
  FieldZoomNavigator,
  FarmBoundsZoomer,
  MapCropDropTarget,
  CropPlacementLayer,
  FieldDrawer,
  TreelineLayer,
  MapLayers
} from './'; //get all components from the index.js
import { INITIAL_CENTER } from '../../utils/constants';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

function FarmMap({
  mapTargetLocation,
  fieldZoomTarget,
  farmBoundsFields,
  activeFields,
  draftFieldPolygon,
  draftCropPlacements,
  templatePlants,
  selectedFieldId,
  selectedFarm,
  selectedField,
  editingShapeId,
  treelinePolygon,
  onDropCrop,
  onPolygonDrawn,
  onPolygonEdited,
  onFieldClick,
}) {
  return (
    <MapContainer 
      className="farm-map" 
      center={INITIAL_CENTER} 
      zoom={13} 
      scrollWheelZoom 
      maxZoom={22}
    >
      {/* Navigation Components */}
      <MapNavigator targetLocation={mapTargetLocation} />
      <FieldZoomNavigator target={fieldZoomTarget} />
      <FarmBoundsZoomer fields={farmBoundsFields} />
      
      {/* Drop Target */}
      <MapCropDropTarget onDropCrop={onDropCrop} />
      
      {/* Crop Placements */}
      <CropPlacementLayer
        fields={activeFields}
        draftPolygon={draftFieldPolygon}
        draftPlacements={draftCropPlacements}
        templatePlants={templatePlants}
        selectedFieldId={selectedFieldId}
        generatedPlacements={(selectedField?.template?.generatedPlacements || 
                             selectedField?.recipe?.generatedPlacements) ?? []}
      />
      
      {/* Field Drawer */}
      {selectedFarm && (
        <FieldDrawer
          fields={activeFields}
          draftPolygon={draftFieldPolygon}
          selectedFieldId={selectedFieldId}
          editingShapeId={editingShapeId}
          onPolygonDrawn={onPolygonDrawn}
          onPolygonEdited={onPolygonEdited}
          onFieldClick={onFieldClick}
        />
      )}

      {/* Treelines - for all fields when farm is selected */}
      {selectedFarm && activeFields.length > 0 && (
        <TreelineLayer 
          fieldPolygons={activeFields.map(field => ({
            polygon: field.borderPolygon,
            fieldId: field.id,
            fieldName: field.fieldName || 'Unnamed Field'
          }))}
        />
      )}

      {/* Treelines - for draft polygon */}
      {treelinePolygon && !selectedFarm?.fields?.length && (
        <TreelineLayer 
          fieldPolygons={[{
            polygon: treelinePolygon,
            fieldId: selectedFieldId,
            fieldName: 'Draft Field'
          }]}
        />
      )}
      
      {/* Map Layers */}
      <MapLayers />
    </MapContainer>
  );
}

export default FarmMap;