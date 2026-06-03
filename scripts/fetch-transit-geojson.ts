#!/usr/bin/env bun
/**
 * Fetches Philadelphia-area transit data and writes GeoJSON files.
 *
 * Sources:
 *   - SEPTA Metro / Bus / Streetcar: official SEPTA GTFS (github.com/septadev/GTFS)
 *   - SEPTA Regional Rail:           official SEPTA GTFS
 *   - PATCO Speedline:               official PATCO GTFS (ridepatco.org/developers)
 *   - NJ Transit bus (Philly-bound): OpenStreetMap Overpass API
 *
 * Output: data/*.geojson  (one file per agency/category)
 * Usage:  bun fetch-transit-geojson.ts [--skip-download]
 *
 * Pass --skip-download if you already have fresh GTFS zips in /tmp.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const OUT_DIR = join(import.meta.dir, "data");
const GTFS_CACHE = join(process.env.HOME!, "Production", "GTFS");
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(GTFS_CACHE, { recursive: true });

// ── Types ────────────────────────────────────────────────────────────────────

interface GeoJsonFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

// ── CSV parser (no dependencies) ─────────────────────────────────────────────

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const result: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, j) => (row[h] = (vals[j] ?? "").trim()));
    result.push(row);
  }
  return result;
}

// ── GTFS → GeoJSON ────────────────────────────────────────────────────────────

function processGtfs(
  gtfsDir: string,
  label: string,
  routeTypeFilter: number[]
): GeoJsonFeature[] {
  console.log(`  reading ${label}…`);

  const routes = parseCsv(readFileSync(join(gtfsDir, "routes.txt"), "utf8"));
  const routeMap = new Map(
    routes
      .filter((r) => routeTypeFilter.includes(parseInt(r.route_type)))
      .map((r) => [r.route_id, r])
  );
  if (routeMap.size === 0) return [];

  // directions.txt (GTFS extension) → human-readable direction names per route+direction
  const dirNamesPath = join(gtfsDir, "directions.txt");
  const dirNames = new Map<string, string>(); // "${route_id}:${direction_id}" → "Northbound" etc.
  if (existsSync(dirNamesPath)) {
    for (const row of parseCsv(readFileSync(dirNamesPath, "utf8"))) {
      if (routeMap.has(row.route_id))
        dirNames.set(`${row.route_id}:${row.direction_id}`, row.direction);
    }
  }

  // trips.txt → best shape per route + trip→{direction_id} lookup
  const trips = parseCsv(readFileSync(join(gtfsDir, "trips.txt"), "utf8"));
  const shapeCounts = new Map<string, Map<string, number>>();
  const tripInfo = new Map<string, { route_id: string; direction_id: string; headsign: string }>();
  for (const t of trips) {
    if (!routeMap.has(t.route_id)) continue;
    tripInfo.set(t.trip_id, { route_id: t.route_id, direction_id: t.direction_id ?? "", headsign: t.trip_headsign ?? "" });
    if (!t.shape_id) continue;
    if (!shapeCounts.has(t.route_id)) shapeCounts.set(t.route_id, new Map());
    const m = shapeCounts.get(t.route_id)!;
    m.set(t.shape_id, (m.get(t.shape_id) ?? 0) + 1);
  }
  const routeToShape = new Map<string, string>();
  for (const [rid, counts] of shapeCounts) {
    let best = "", max = 0;
    for (const [sid, n] of counts) if (n > max) { max = n; best = sid; }
    if (best) routeToShape.set(rid, best);
  }

  // shapes.txt → coords per shape_id
  const shapeLines = parseCsv(readFileSync(join(gtfsDir, "shapes.txt"), "utf8"));
  const shapePts = new Map<string, { lat: number; lon: number; seq: number }[]>();
  for (const pt of shapeLines) {
    if (!shapePts.has(pt.shape_id)) shapePts.set(pt.shape_id, []);
    shapePts.get(pt.shape_id)!.push({
      lat: parseFloat(pt.shape_pt_lat),
      lon: parseFloat(pt.shape_pt_lon),
      seq: parseInt(pt.shape_pt_sequence),
    });
  }
  for (const pts of shapePts.values()) pts.sort((a, b) => a.seq - b.seq);

  // stops.txt
  const stopsRaw = parseCsv(readFileSync(join(gtfsDir, "stops.txt"), "utf8"));
  const stopMap = new Map(stopsRaw.map((s) => [s.stop_id, s]));

  // stop_times.txt → route→stops + per-(stop,route) direction + headsign counts (single pass)
  const routeStops = new Map<string, Set<string>>();
  const stopRouteDir = new Map<string, { direction_id: number; direction: string }>();   // key: `${sid}:${rid}`
  const stopRouteHeadsignCounts = new Map<string, Map<string, number>>();                // key: `${sid}:${rid}`
  const st = parseCsv(readFileSync(join(gtfsDir, "stop_times.txt"), "utf8"));
  for (const row of st) {
    const info = tripInfo.get(row.trip_id);
    if (!info || !routeMap.has(info.route_id)) continue;
    if (!routeStops.has(info.route_id)) routeStops.set(info.route_id, new Set());
    routeStops.get(info.route_id)!.add(row.stop_id);
    const key = `${row.stop_id}:${info.route_id}`;
    if (!stopRouteDir.has(key)) {
      stopRouteDir.set(key, {
        direction_id: parseInt(info.direction_id) || 0,
        direction: dirNames.get(`${info.route_id}:${info.direction_id}`) ?? "",
      });
    }
    if (info.headsign) {
      if (!stopRouteHeadsignCounts.has(key)) stopRouteHeadsignCounts.set(key, new Map());
      const counts = stopRouteHeadsignCounts.get(key)!;
      counts.set(info.headsign, (counts.get(info.headsign) ?? 0) + 1);
    }
  }
  // Pick most-common headsign per (stop, route)
  const stopRouteHeadsign = new Map<string, string>();
  for (const [key, counts] of stopRouteHeadsignCounts) {
    let best = "", max = 0;
    for (const [hs, n] of counts) if (n > max) { max = n; best = hs; }
    stopRouteHeadsign.set(key, best);
  }

  const features: GeoJsonFeature[] = [];

  // Route LineString features
  for (const [rid, route] of routeMap) {
    const shapeId = routeToShape.get(rid);
    if (!shapeId) continue;
    const pts = shapePts.get(shapeId);
    if (!pts || pts.length < 2) continue;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: pts.map((p) => [p.lon, p.lat]) },
      properties: {
        route_id: rid,
        route_short_name: route.route_short_name ?? "",
        route_long_name: route.route_long_name ?? "",
        route_type: parseInt(route.route_type),
        route_color: route.route_color ? `#${route.route_color}` : null,
        route_text_color: route.route_text_color ? `#${route.route_text_color}` : null,
        feature_type: "route",
        source: "gtfs",
      },
    });
  }

  // Stop Point features (deduplicated, with route_ids array)
  const stopRoutes = new Map<string, string[]>();
  for (const [rid, stopIds] of routeStops) {
    for (const sid of stopIds) {
      if (!stopRoutes.has(sid)) stopRoutes.set(sid, []);
      stopRoutes.get(sid)!.push(rid);
    }
  }
  for (const [sid, routeIds] of stopRoutes) {
    const s = stopMap.get(sid);
    if (!s) continue;
    const lat = parseFloat(s.stop_lat), lon = parseFloat(s.stop_lon);
    if (isNaN(lat) || isNaN(lon)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        stop_id: sid,
        stop_name: s.stop_name ?? "",
        stop_code: s.stop_code ?? "",
        routes: routeIds.map((rid) => {
          const key = `${sid}:${rid}`;
          return {
            route_id: rid,
            direction_id: stopRouteDir.get(key)?.direction_id ?? null,
            direction: stopRouteDir.get(key)?.direction ?? "",
            headsign: stopRouteHeadsign.get(key) ?? "",
          };
        }),
        wheelchair_boarding: s.wheelchair_boarding ? parseInt(s.wheelchair_boarding) : 0,
        feature_type: "stop",
        source: "gtfs",
      },
    });
  }

  return features;
}

// ── Download helpers ──────────────────────────────────────────────────────────

function download(url: string, dest: string) {
  console.log(`  → downloading ${url.split("/").pop()}…`);
  execSync(`curl -L -s -o "${dest}" "${url}"`, { stdio: "inherit" });
}

function unzip(zipPath: string, destDir: string) {
  execSync(`unzip -q -o "${zipPath}" -d "${destDir}"`, { stdio: "inherit" });
}

// ── Save GeoJSON ──────────────────────────────────────────────────────────────

function save(name: string, features: GeoJsonFeature[]) {
  const routes = features.filter((f) => f.properties.feature_type === "route").length;
  const stops  = features.filter((f) => f.properties.feature_type === "stop").length;
  const docks  = features.filter((f) => f.properties.feature_type === "dock").length;
  writeFileSync(
    join(OUT_DIR, `${name}.geojson`),
    JSON.stringify({ type: "FeatureCollection", features }, null, 2)
  );
  const summary = [routes && `${routes} routes`, stops && `${stops} stops`, docks && `${docks} docks`].filter(Boolean).join(", ");
  console.log(`  ✓ ${name}.geojson — ${summary}`);
}

// ── Indego GBFS ───────────────────────────────────────────────────────────────

// Snapshot source. For live dock availability (bikes/docks available per station),
// use the GBFS status feed at build time or client-side:
//   https://gbfs.bcycle.com/bcycle_indego/station_status.json
// Full GBFS manifest: https://gbfs.bcycle.com/bcycle_indego/gbfs.json

const INDEGO_STATION_INFO_URL = "https://gbfs.bcycle.com/bcycle_indego/station_information.json";

async function fetchIndego(): Promise<GeoJsonFeature[]> {
  console.log("  → fetching Indego station data…");
  const res = await fetch(INDEGO_STATION_INFO_URL);
  if (!res.ok) throw new Error(`Indego HTTP ${res.status}`);
  const json = await res.json() as { data: { stations: Record<string, unknown>[] } };
  return json.data.stations
    .filter((s) => s.lat != null && s.lon != null)
    .map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: {
        station_id: s.station_id,
        name: s.name,
        address: s.address ?? "",
        feature_type: "dock",
        source: "gbfs",
      },
    }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Philadelphia transit GeoJSON fetch\n");

  // ── GTFS cache dirs ───────────────────────────────────────────────────────

  const septaZip  = join(GTFS_CACHE, "septa.zip");
  const patcoZip  = join(GTFS_CACHE, "patco.zip");
  const njtZip    = join(GTFS_CACHE, "njtransit-bus.zip");
  const septaDir  = join(GTFS_CACHE, "septa");
  const septaRail = join(septaDir, "rail");
  const septaBus  = join(septaDir, "bus");
  const patcoDir  = join(GTFS_CACHE, "patco");
  const njtDir    = join(GTFS_CACHE, "njtransit-bus");

  // ── SEPTA GTFS ────────────────────────────────────────────────────────────

  if (!existsSync(septaBus) || !existsSync(septaRail)) {
    if (!existsSync(septaZip)) {
      console.log("[Downloading SEPTA GTFS]");
      download(
        "https://github.com/septadev/GTFS/releases/download/v202605241/gtfs_public.zip",
        septaZip
      );
    } else {
      console.log("[Using cached septa.zip]");
    }
    mkdirSync(septaDir, { recursive: true });
    unzip(septaZip, septaDir);
    mkdirSync(septaRail, { recursive: true });
    mkdirSync(septaBus, { recursive: true });
    unzip(join(septaDir, "google_rail.zip"), septaRail);
    unzip(join(septaDir, "google_bus.zip"), septaBus);
    console.log();
  } else {
    console.log("[SEPTA GTFS already extracted — skipping download]\n");
  }

  // ── PATCO GTFS ────────────────────────────────────────────────────────────

  if (!existsSync(patcoDir)) {
    if (!existsSync(patcoZip)) {
      console.log("[Downloading PATCO GTFS]");
      download(
        "https://rapid.nationalrtap.org/GTFSFileManagement/UserUploadFiles/13562/PATCO_GTFS.zip",
        patcoZip
      );
    } else {
      console.log("[Using cached patco.zip]");
    }
    mkdirSync(patcoDir, { recursive: true });
    unzip(patcoZip, patcoDir);
    console.log();
  } else {
    console.log("[PATCO GTFS already extracted — skipping download]\n");
  }

  // ── SEPTA Metro (subway type=1) ───────────────────────────────────────────
  console.log("[SEPTA Metro — Market-Frankford, Broad St, NHSL]");
  save("septa-metro", processGtfs(septaBus, "SEPTA Metro", [1]));

  // ── SEPTA Trolleys (streetcar type=0) ────────────────────────────────────
  console.log("[SEPTA Trolleys (surface streetcar)]");
  save("septa-trolley", processGtfs(septaBus, "SEPTA Trolley", [0]));

  // ── SEPTA Regional Rail (commuter rail type=2) ────────────────────────────
  console.log("[SEPTA Regional Rail]");
  save("septa-regional-rail", processGtfs(septaRail, "SEPTA Regional Rail", [2]));

  // ── SEPTA Bus (type=3 + type=11 trolleybus) ───────────────────────────────
  console.log("[SEPTA Bus Lines]");
  save("septa-bus", processGtfs(septaBus, "SEPTA Bus", [3, 11]));

  // ── PATCO Speedline ───────────────────────────────────────────────────────
  console.log("[PATCO Speedline]");
  save("patco", processGtfs(patcoDir, "PATCO", [1]));

  // ── NJ Transit Bus (GTFS) ─────────────────────────────────────────────────
  console.log("[NJ Transit Bus]");
  if (!existsSync(njtDir)) {
    if (!existsSync(njtZip)) {
      console.log("[Downloading NJ Transit GTFS]");
      download(
        "https://www.njtransit.com/mmClient/clients/NJT_BASIC/web/nvbw.ns/googletransit/NJTransitGTFS.zip",
        njtZip
      );
    } else {
      console.log("[Using cached njtransit-bus.zip]");
    }
    mkdirSync(njtDir, { recursive: true });
    unzip(njtZip, njtDir);
    console.log();
  } else {
    console.log("[NJ Transit GTFS already extracted — skipping download]\n");
  }
  // Keep only stops within the Philadelphia metro area bounding box
  const njtFeatures = processGtfs(njtDir, "NJ Transit Bus", [3]).filter((f) => {
    if (f.properties.feature_type !== "stop") return true;
    const [lon, lat] = f.geometry.coordinates as [number, number];
    return lon >= -75.30 && lon <= -74.90 && lat >= 39.85 && lat <= 40.10;
  });
  save("njtransit-bus-philly", njtFeatures);

  // ── Indego bikeshare docks (GBFS snapshot) ────────────────────────────────
  const indegoFile = join(OUT_DIR, "indego.geojson");
  if (existsSync(indegoFile)) {
    console.log("[Indego — using existing snapshot, delete to refresh]");
  } else {
    console.log("[Indego Bikeshare]");
    try {
      save("indego", await fetchIndego());
    } catch (err) {
      console.error("  ✗ Indego fetch failed:", err);
    }
  }

  console.log("\nDone. Files saved to data/");
}

main().catch(console.error);
