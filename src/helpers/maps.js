import polyline from '@mapbox/polyline';

const decode = (encoded) =>
  polyline.decode(encoded).map(([lat, lng]) => [lng, lat]);

export const decodeRoutePolyline = (encodedPolyline) => {
  if (Array.isArray(encodedPolyline)) {
    // Tagged segments (e.g. bike lanes): [{ p, category, type, street }, ...]
    if (encodedPolyline.length && typeof encodedPolyline[0] === 'object') {
      return {
        type: 'FeatureCollection',
        features: encodedPolyline.map((seg) => ({
          type: 'Feature',
          properties: { category: seg.category, type: seg.type, street: seg.street },
          geometry: { type: 'LineString', coordinates: decode(seg.p) },
        })),
      };
    }
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