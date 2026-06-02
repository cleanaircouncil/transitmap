import Airtable from "airtable";
import fs from "fs";
import "dotenv/config";
import { slugify } from "./utils.js";
import { marked } from "marked";
import * as turf from "@turf/turf";

import listingData from "../src/data/data.json" with { type: "json" };
import networks from "../src/data/networks.json" with {type:"json"} ;
import stops from "../src/data/stops.json" with { type: "json" };
import allRoutes from "../src/data/routes.json" with { type: "json" };

import nearbyRoutes from "../src/data/nearby-routes.json" with { type: "json" };
import nearbyStops from "../src/data/nearby-stops.json" with { type: "json" };

const PHILLY_LAT = 39.952583;
const PHILLY_LON = -75.165222;

import apify from "./apify.js";


const transitAPIPublic = apify(`${process.env.TRANSIT_API_URL}/v4/public`, { apiKey: process.env.TRANSIT_API_KEY });
const transitAPIMapLayers= apify(`${process.env.TRANSIT_API_URL}/map_layers`, { apiKey: process.env.TRANSIT_API_KEY });



async function getNetworks() {
    const networks = await transitAPIPublic.get("available_networks", {
      lat: PHILLY_LAT,
      lon: PHILLY_LON,
      country_code: "US",
      include_all_networks: false,
    });

    const routes = await transitAPIPublic.get("routes_for_networks", {
      lat: PHILLY_LAT,
      lon: PHILLY_LON,
      network_ids: networks.networks.map((network) => network.network_id),
      include_iteneraries: true,
    });

   fs.writeFileSync("./src/data/networks.json", JSON.stringify( networks ));
   fs.writeFileSync("./src/data/routes.json", JSON.stringify( routes ));
}


async function getStops() {

  for( const network of networks.networks ) {
    // console.log( network );
    if( stops[network.network_id])
      continue;

    const networkStops = await transitAPIPublic.get("stops_for_network", {
      network_id: network.network_id,
      lat: PHILLY_LAT,
      lon: PHILLY_LON
    })

    console.log(`🚊 ${network.network_name}`);
    stops[network.network_id] = networkStops;
    fs.writeFileSync("./src/data/stops.json", JSON.stringify(stops, null, 2));

    await new Promise((res => setTimeout(() => res(), 3000)));
  }

  
}


async function getNearbyRoutes() {
  for (const listing of data.listings ) {
    if( nearbyRoutes[listing.slug])
      continue;


    const routes = await transitAPIPublic.get("nearby_routes", {
      lat: listing.latitude,
      lon: listing.longitude,
      include_stops_and_shapes: true,
    })

    console.log(`🚊 ${listing.slug}`);
    nearbyRoutes[listing.slug] = routes;
    fs.writeFileSync("./src/data/nearby-routes.json", JSON.stringify(nearbyRoutes, null, 2));

    await new Promise((res) => setTimeout(() => res(), 3000));
  }
}


async function getNearbyStops() {
  let i = 0;
  for (const listing of listingData.listings) {
    if (nearbyStops[listing.slug]) continue;

    const stops = await transitAPIPublic.get("nearby_stops", {
      lat: listing.latitude,
      lon: listing.longitude,
      max_distance: 1600
    });

    console.log(`🚊 ${listing.slug}`);
    nearbyStops[listing.slug] = stops;
    fs.writeFileSync("./src/data/nearby-stops.json", JSON.stringify(nearbyStops, null, 2));

    // await new Promise((res) => setTimeout(() => res(), 3000));
  }
}

async function cleanStops() {
  const entries = Object.entries(nearbyRoutes);
  const [slug, data] = entries[0];

  const processStop = (stop) => ({
    latitude: stop.closest_stop.stop_lat,
    longitude: stop.closest_stop.stop_lon,
    name: stop.closest_stop.stop_name,
    wheelchair_boarding: stop.closest_stop.wheelchair_boarding,
    itineraries: stop.itineraries?.map( itinerary => ({
      shape: itinerary.shape,
      merged_headsign: itinerary.merged_headsign
    }))
  });
  
  const processRoute = (route) => ({
    route: allRoutes.routes
      .filter((r) => r.global_route_id === route.global_route_id)
      .map((r) => ({
        global_route_id: route.global_route_id,
        real_time_route_id: r.real_time_route_id,
        mode_name: r.mode_name,
        route_color: "#" + r.route_color,
        route_text_color: "#" + r.route_text_color,
      }))
      .at(0),
    stops: route.merged_itineraries.map(processStop),
  });

  const routes = entries.map(([slug, data]) => ({
    listing_slug: slug,
    listing: listingData.listings.find((listing) => listing.slug === slug),
    routes: data.nearby_routes.map(processRoute),
  }));

  
  fs.writeFileSync("./src/data/listing-stops.json", JSON.stringify(routes, null, 2));

}


(async() => {
  await getNearbyStops();

  // await cleanStops();
})();