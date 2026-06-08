import polyline from '@mapbox/polyline';

const decode = (encoded) =>
  polyline.decode(encoded).map(([lat, lng]) => [lng, lat]);

export const decodeRoutePolyline = (encodedPolyline) => {
  if (Array.isArray(encodedPolyline)) {
    return {
      type: 'Feature',
      geometry: {
        type: 'MultiLineString',
        coordinates: encodedPolyline.map(decode),
      },
    };
  }
  if (!encodedPolyline) {
    return { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [] } };
  }
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: decode(encodedPolyline),
    },
  };
};