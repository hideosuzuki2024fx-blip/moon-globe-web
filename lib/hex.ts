import { cellToBoundary, gridDisk, latLngToCell } from "h3-js";

export const FIXED_HEX_RESOLUTION = 6;
export const MIN_GRID_ZOOM = 4.5;
const MAX_GRID_CELLS = 1200;

export function pointToCellId(lat: number, lon: number) {
  return latLngToCell(lat, lon, FIXED_HEX_RESOLUTION);
}

function zoomToRingK(zoom: number) {
  if (zoom < 5) return 12;
  if (zoom < 6) return 18;
  if (zoom < 7) return 26;
  if (zoom < 8) return 34;
  return 42;
}

export function buildCellsAroundCenter(centerLat: number, centerLon: number, zoom: number) {
  if (zoom < MIN_GRID_ZOOM) {
    return [];
  }

  const centerCell = latLngToCell(centerLat, centerLon, FIXED_HEX_RESOLUTION);
  const cells = gridDisk(centerCell, zoomToRingK(zoom));
  return cells.slice(0, MAX_GRID_CELLS);
}

export function cellsToFeatureCollection(cellIds: string[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: cellIds.map((cellId) => ({
      type: "Feature",
      properties: { cell_id: cellId },
      geometry: {
        type: "Polygon",
        coordinates: [cellToBoundary(cellId, true)],
      },
    })),
  };
}
