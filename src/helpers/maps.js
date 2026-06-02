import polyline from '@mapbox/polyline';

export const decodeRoutePolyline = (
  encodedPolyline
) => {
  const decoded = polyline.decode(encodedPolyline);

  // Google: [lat, lng] → MapLibre: [lng, lat]
  const coordinates = decoded.map(([lat, lng]) => [lng, lat]);

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates,
    }
  };
};