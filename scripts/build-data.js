import fs from "fs";
import { featureCollection, point, circle, pointsWithinPolygon, booleanIntersects, bbox, distance } from "@turf/turf";



// ── Config ────────────────────────────────────────────────────────────────────

const RADIUS_METERS = 800;
const SHORT_RADIUS = 400; // buses and bikes try this first, expand to RADIUS_METERS if empty
const SHORT_RADIUS_NS = new Set(["septa-bus", "septa-trolley", "njtransit-bus", "indego"]);

// Path to listings JSON — array of listing objects with id, venue, date, etc.
const LISTINGS_PATH = "./data/airtable/listings.json";

// Path to venues JSON — array pulled from Airtable, each with id, name, latitude, longitude
const VENUES_PATH = "./data/airtable/venues.json";

// GeoJSON files to include, each tagged with a namespace to avoid ID collisions
const GEOJSON_SOURCES = [
  { file: "./data/agencies/septa-metro.geojson", namespace: "septa-metro" },
  { file: "./data/agencies/septa-bus.geojson", namespace: "septa-bus" },
  { file: "./data/agencies/septa-trolley.geojson", namespace: "septa-trolley" },
  { file: "./data/agencies/septa-regional-rail.geojson", namespace: "septa-regional-rail" },
  { file: "./data/agencies/patco.geojson", namespace: "patco" },
  { file: "./data/agencies/njtransit-bus-philly.geojson", namespace: "njtransit-bus" },
  { file: "./data/agencies/indego.geojson", namespace: "indego" },
  { file: "./data/agencies/phlash.geojson", namespace: "phlash" },
];

// Route short-name overrides — keyed by "namespace:route_id"
const ROUTE_ALIASES = {
  "septa-bus:MANNLP": "Mann Loop",
};

// ── Load inputs ───────────────────────────────────────────────────────────────

const listings = JSON.parse(fs.readFileSync(LISTINGS_PATH, "utf8"));
const venuesRaw = JSON.parse(fs.readFileSync(VENUES_PATH, "utf8"));

// Lookup: Airtable record ID → slug, used to resolve cross-references
const venueIdToSlug = Object.fromEntries(venuesRaw.map((v) => [v.id, v.slug]));

// Bike network segments — pre-encoded, filtered per venue at output time
const BIKE_NETWORK_PATH = "./data/agencies/bike-network.geojson";
const bikeSegments = fs.existsSync(BIKE_NETWORK_PATH)
  ? JSON.parse(fs.readFileSync(BIKE_NETWORK_PATH, "utf8")).features
  : [];
console.log(`Loaded ${bikeSegments.length} bike network segments`);

// ── Ingest GeoJSON ────────────────────────────────────────────────────────────

const allStops = []; // { key, namespace, feature }
const allRoutes = []; // { key, namespace, routeId, feature }

for (const { file, namespace } of GEOJSON_SOURCES) {
  if (!fs.existsSync(file)) {
    console.warn(`  skipping missing file: ${file}`);
    continue;
  }
  const fc = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const feature of fc.features) {
    const p = feature.properties;
    if (p.feature_type === "stop") {
      allStops.push({ key: `${namespace}:${p.stop_id}`, namespace, feature });
    } else if (p.feature_type === "route") {
      // NJ Transit routes come from OSM and use osm_id instead of route_id
      const routeId = p.route_id || String(p.osm_id);
      allRoutes.push({ key: `${namespace}:${routeId}`, namespace, routeId, feature });
    } else if (p.feature_type === "dock") {
      // Normalize dock to stop shape; assign synthetic indego route
      allStops.push({
        key: `${namespace}:${p.station_id}`,
        namespace,
        feature: {
          ...feature,
          properties: {
            ...p,
            stop_id: p.station_id,
            stop_name: p.name,
            routes: [{ route_id: "indego", direction_id: null, direction: null, headsign: null }],
          },
        },
      });
    }
  }
}

console.log(`Loaded ${allStops.length} stops, ${allRoutes.length} routes`);

// ── Build stops map ───────────────────────────────────────────────────────────

function agencyName(namespace) {
  if (namespace.startsWith("septa")) return "SEPTA";
  if (namespace === "patco") return "PATCO";
  if (namespace === "njtransit-bus") return "NJ Transit";
  if (namespace === "indego") return "Indego";
  if (namespace === "phlash") return "Philly Phlash";
  return namespace;
}

const stops = {};

for (const { key, namespace, feature } of allStops) {
  const p = feature.properties;
  const [lon, lat] = feature.geometry.coordinates;

  // routes array: namespaced route_id, direction, headsign
  // NJ Transit stops (OSM source) don't have the routes array — add handling here if needed
  const routes = (p.routes || []).map((r) => ({
    route_id: `${namespace}:${r.route_id}`,
    direction_id: r.direction_id,
    direction: r.direction,
    headsign: r.headsign,
  }));

  stops[key] = {
    stop_id: p.stop_id,
    stop_name: p.stop_name,
    coordinates: [lon, lat],
    wheelchair_boarding: p.wheelchair_boarding ?? 0,
    routes,
  };
}

// Returns true if a color is absent or is plain black/white (no brand value)
function isGenericColor(color) {
  if (!color) return true;
  const c = color.replace(/^#/, "").toUpperCase();
  return c === "000000" || c === "FFFFFF";
}

// ── Polyline helpers ──────────────────────────────────────────────────────────

// Removes polylines that are geographic prefixes of longer ones.
// Delta-encoded polylines have the prefix property: if route A is a sub-path of
// route B starting from the same point, encoded(A) is a string prefix of encoded(B).
function dedupePolylines(polylines) {
  const sorted = [...polylines].sort((a, b) => b.length - a.length);
  const kept = [];
  for (const p of sorted) {
    if (!kept.some((k) => k.startsWith(p))) kept.push(p);
  }
  return kept;
}

// Encodes [[lon, lat], ...] (GeoJSON order) to a Google encoded polyline string.
// Consumers: Google Maps, Mapbox, Leaflet (via plugin), or any polyline decoder.
function encodePolyline(coords) {
  let out = "",
    prevLat = 0,
    prevLng = 0;
  for (const [lng, lat] of coords) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    for (const delta of [latE5 - prevLat, lngE5 - prevLng]) {
      let v = delta < 0 ? ~(delta << 1) : delta << 1;
      while (v >= 0x20) {
        out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
        v >>>= 5;
      }
      out += String.fromCharCode(v + 63);
    }
    prevLat = latE5;
    prevLng = lngE5;
  }
  return out;
}

// ── Build routes map ──────────────────────────────────────────────────────────

// GTFS route_type → display mode
// 0 = tram/streetcar, 1 = subway, 2 = commuter rail, 3 = bus, 11 = trolleybus
// NJ Transit (OSM source) has route_type as the string "bus"
function routeMode(routeType, namespace) {
  if (namespace === "indego") return "Bike";
  switch (Number(routeType)) {
    case 0:
      return "Metro"; // streetcar/tram
    case 1:
      return "Metro"; // subway
    case 2:
      return "Rail";
    case 3:
      return "Bus";
    case 11:
      return "Bus"; // trolleybus
    default:
      return "Bus"; // fallback covers OSM string "bus" and unknowns
  }
}

const routes = {};

// Group route features by namespace:route_id — fetch emits one per direction
const routeGroups = new Map();
for (const r of allRoutes) {
  if (!routeGroups.has(r.key)) routeGroups.set(r.key, []);
  routeGroups.get(r.key).push(r);
}

for (const [key, group] of routeGroups) {
  const { namespace, routeId, feature } = group[0];
  const p = feature.properties;

  const polylines = dedupePolylines(group.flatMap(({ feature: f }) => {
    if (f.geometry.type === "LineString") {
      return f.geometry.coordinates.length >= 2 ? [encodePolyline(f.geometry.coordinates)] : [];
    } else if (f.geometry.type === "MultiLineString") {
      return f.geometry.coordinates
        .filter((coords) => coords.length >= 2)
        .map((coords) => encodePolyline(coords));
    }
    return [];
  }));

  routes[key] = {
    route_id: routeId,
    namespace,
    agency: agencyName(namespace),
    mode: routeMode(p.route_type, namespace),
    route_short_name: (ROUTE_ALIASES[key] || p.route_short_name || p.route_ref || routeId).replace(/"/g, ""),
    route_long_name: p.route_long_name || p.route_name || "",
    route_type: p.route_type ?? null,
    route_color: (() => {
      const raw = p.route_color ? `#${p.route_color.replace(/^#/, "")}` : null;
      if (namespace === "phlash") return "#4C388B";
      if (namespace === "septa-bus" && isGenericColor(raw)) return "#2C2B27";
      if (namespace === "njtransit-bus" && isGenericColor(raw)) return "#FCF9F5";
      return raw;
    })(),
    route_text_color: (() => {
      const raw = p.route_text_color ? `#${p.route_text_color.replace(/^#/, "")}` : null;
      if (namespace === "phlash") return "#FFFFFF";
      if (namespace === "septa-bus" && isGenericColor(raw)) return "#FCF9F5";
      if (namespace === "njtransit-bus" && isGenericColor(raw)) return "#2C2B27";
      return raw;
    })(),
    polylines,
    stop_ids: [],
  };
}

// Synthetic Indego route — docks are stops, no path geometry needed
routes["indego:indego"] = {
  route_id: "indego",
  namespace: "indego",
  agency: "Indego",
  mode: "Bike",
  route_short_name: "Indego",
  route_long_name: "Indego Bike Share",
  route_type: null,
  route_color: "#3980C4",
  route_text_color: "#FFFFFF",
  polylines: [],
  stop_ids: [],
};

// ── Reverse-index: routes → stop_ids ─────────────────────────────────────────

for (const [stopKey, stop] of Object.entries(stops)) {
  for (const r of stop.routes) {
    if (routes[r.route_id]) {
      routes[r.route_id].stop_ids.push(stopKey);
    }
  }
}

// ── Build venues map ──────────────────────────────────────────────────────────

const stopPoints = featureCollection(Object.entries(stops).map(([key, stop]) => point(stop.coordinates, { key })));

const venues = {};

for (const venue of venuesRaw) {
  const slug = venue.slug;
  const name = venue.name || venue.fields?.Name;
  const lat = venue.latitude ?? venue.fields?.Latitude;
  const lon = venue.longitude ?? venue.fields?.Longitude;

  if (!lat || !lon) {
    console.warn(`  venue "${name}" has no coordinates, skipping`);
    continue;
  }

  const searchArea = circle([lon, lat], RADIUS_METERS / 1000, { units: "kilometers" });
  const nearbyStops = pointsWithinPolygon(stopPoints, searchArea);

  venues[slug] = {
    name,
    address: venue.address ?? venue.fields?.Address ?? "",
    coordinates: [lon, lat],
    stop_ids: nearbyStops.features.map((f) => f.properties.key),
  };

  console.log(`  ${name}: ${venues[slug].stop_ids.length} stops within ${RADIUS_METERS}m`);
}

// ── Build listings map ────────────────────────────────────────────────────────

const listingsOut = listings.map((listing) => ({
  slug: listing.slug,
  name: listing.name,
  date: listing.date,
  type: listing.type,
  link: listing.link,
  group_name: listing.group_name,
  venue_id: venueIdToSlug[listing.venue] ?? null,
  venue: listing.venue_name,
}));

// ── Write output ──────────────────────────────────────────────────────────────

// index.json — lightweight initial payload for map load
const indexOut = {
  meta: {
    generated: new Date().toISOString(),
    radius_meters: RADIUS_METERS,
    bounds: bbox(featureCollection(Object.values(venues).map((v) => point(v.coordinates)))),
  },
  venues: Object.entries(venues).map(([slug, v]) => ({ slug, name: v.name, address: v.address, coordinates: v.coordinates })),
  listings: listingsOut,
};

fs.writeFileSync("./src/data/index.json", JSON.stringify(indexOut));
console.log(`\nWrote ./src/data/index.json`);
console.log(`  ${listingsOut.length} listings`);
console.log(`  ${indexOut.venues.length} venues`);

// venues/{id}.json — per-venue detail loaded on selection
const venuesDir = "./public/data/venues";
if (!fs.existsSync(venuesDir)) fs.mkdirSync(venuesDir);

const routesByVenue = {};

for (const [slug, venue] of Object.entries(venues)) {
  const allVenueStops = Object.fromEntries(
    venue.stop_ids.map((key) => [key, stops[key]]).filter(([, s]) => s)
  );

  // Compute venue→stop distances for all candidates
  const [vlon, vlat] = venue.coordinates;
  const stopDist = Object.fromEntries(
    Object.keys(allVenueStops).map((key) => {
      const [slon, slat] = allVenueStops[key].coordinates;
      return [key, distance([vlon, vlat], [slon, slat], { units: "meters" })];
    })
  );

  // For surface/bike modes, prefer 400m; expand to full radius only if nothing closer
  const shortHasNearby = {};
  for (const ns of SHORT_RADIUS_NS) {
    shortHasNearby[ns] = Object.keys(allVenueStops).some(
      (key) => key.startsWith(`${ns}:`) && stopDist[key] <= SHORT_RADIUS
    );
  }
  const candidateStops = Object.fromEntries(
    Object.entries(allVenueStops).filter(([key]) => {
      const ns = key.split(":")[0];
      return !SHORT_RADIUS_NS.has(ns) || !shortHasNearby[ns] || stopDist[key] <= SHORT_RADIUS;
    })
  );

  // Pass 1: for each (route, direction) pair, record the nearest stop
  const nearest = new Map();
  for (const [key, stop] of Object.entries(candidateStops)) {
    for (const r of stop.routes) {
      const dirKey = `${r.route_id}|${r.direction_id ?? ""}`;
      if (!nearest.has(dirKey) || stopDist[key] < stopDist[nearest.get(dirKey)]) {
        nearest.set(dirKey, key);
      }
    }
  }

  // Pass 2: keep stops that won at least one (route, direction) pair;
  // always keep all Indego docks (no direction concept, show every station in radius)
  const keptKeys = new Set(nearest.values());
  const venueStops = Object.fromEntries(
    Object.keys(candidateStops)
      .filter((key) => keptKeys.has(key) || key.startsWith("indego:"))
      .map((key) => [key, { ...candidateStops[key], walk_minutes: Math.ceil(stopDist[key] / 80) }])
  );

  const routeKeys = new Set(
    Object.values(venueStops).flatMap((s) => s.routes.map((r) => r.route_id))
  );

  // Bike segments that intersect the venue search circle
  const searchCircle = circle([vlon, vlat], RADIUS_METERS / 1000, { units: "kilometers" });
  const nearbyBikePolylines = bikeSegments
    .filter((seg) => booleanIntersects(seg, searchCircle))
    .map((seg) => encodePolyline(seg.geometry.coordinates));

  const venueRoutes = Object.fromEntries(
    [...routeKeys]
      .filter((key) => {
        if (!routes[key]) {
          console.warn(`  [${slug}] stop references unknown route: ${key}`);
          return false;
        }
        return true;
      })
      .map((key) => {
        const { geometry, ...rest } = routes[key];
        const extra = key === "indego:indego" ? { polylines: nearbyBikePolylines } : {};
        return [key, { key, ...rest, ...extra }];
      })
  );

  routesByVenue[slug] = venueRoutes;

  fs.writeFileSync(
    `${venuesDir}/${slug}.json`,
    JSON.stringify({ name: venue.name, coordinates: venue.coordinates, stops: venueStops, routes: venueRoutes })
  );
}

console.log(`Wrote ${Object.keys(venues).length} files to ${venuesDir}/`);

fs.writeFileSync("./src/data/routes.json", JSON.stringify(routesByVenue));
console.log(`Wrote ./src/data/routes.json`);
