import "dotenv/config";
import apify from "./apify.js";
import airtableAPI, { Bases, jsonify } from "./airtable.js";
import allRoutes from "../src/data/routes.json" with { type: "json" };
import { resourceLimits } from "worker_threads";

const transitAPIPublic = apify(`${process.env.TRANSIT_API_URL}/v4/public`, { apiKey: process.env.TRANSIT_API_KEY });

async function upsertRoutes() {
  const validModes = [
    {
      mode: "Bike",
      names: ["Bikeshare"],
    },
    {
      mode: "Bus",
      names: ["Bus"],
    },
    {
      mode: "Metro",
      names: ["Subway", "Trolley"],
    },
    {
      mode: "Rail",
      names: ["Rail"],
    },
  ];

  const modeNameToInterface = (mode_name) => validModes.find((valid) => valid.names.includes(mode_name))?.mode;

  const records = allRoutes.routes.map((route) => ({
    fields: {
      Name: route.real_time_route_id,
      Agency: route.route_network_name,
      "Global ID": route.global_route_id,
      Mode: modeNameToInterface(route.mode_name),
      Color: `#${route.route_color}`,
      "Text Color": `#${route.route_text_color}`,
    },
  }));

  for (let i = 0; i < records.length; i += 25) {
    // console.log(records.slice(i, i + 25));
    await airtableAPI.patch(Bases.ROUTES, {
      performUpsert: {
        fieldsToMergeOn: ["Global ID"],
      },

      records: records.slice(i, i + 25),
    });
  }
}

async function upsertStopsForVenue(venue) {
  // for each venue:
  // get nearby_routes from transit api

  const routes = await transitAPIPublic.get("nearby_routes", {
    lat: venue.fields.Latitude,
    lon: venue.fields.Longitude,
    max_distance: 1600,
  });

  const venueStops = new Set();

  
  // for each nearby_route, create data shape
  for (const route of routes.nearby_routes) {

    const routeResult = await airtableAPI.get(Bases.ROUTES, {
      filterByFormula: `FIND("${route.global_route_id}",{Global ID})`,
    });
    
    
    // merged_itineraries => [] -> closest_stop for each stop:
    const stops = route.merged_itineraries.map((itinerary) => ({
      fields: {
        "Global ID": itinerary.closest_stop.global_stop_id,
        Latitude: itinerary.closest_stop.stop_lat,
        Longitude: itinerary.closest_stop.stop_lon,
        Name: itinerary.closest_stop.stop_name,
        Direction: itinerary.direction_id,
        Accessibility: ["No Data", "Accessible", "Not Accessible"][itinerary.closest_stop.wheelchair_boarding],
        Route: routeResult.records.map( record => record.id )
      },
    }));

    // upsert stops, merged on global_stop_id

    // console.log(stops);

    const stopsResult = await airtableAPI.patch(Bases.STOPS, {
      performUpsert: {
        fieldsToMergeOn: ["Global ID"],
      },

      records: stops,
    });


    //get stop ids

    stopsResult.records.forEach((record) => venueStops.add(record.id));
    
    break;
  }

  // for the venue
  //upsert on venue id
  //set stpo id

  // const result = await airtableAPI.patch(Bases.VENUES, {
  //   performUpsert: {
  //     fieldsToMergeOn: ["id"],
  //   },

  //   records: {
  //     id: venue.id,
  //     fields: {
  //       Stops: Array.from( venueStops.keys() )
  //     },
  //   },
  // });

  console.log(Array.from(venueStops.keys()));
}

//AND( ABS(Latitude - 39.9487) < .05, ABS(Longitude - -75.2) < .05 )

(async () => {
  // const result = await airtableAPI.get(Bases.VENUES);
  // for (const record of result.records) {
  //   try {
  //     await upsertStopsForVenue(record);
  //   } catch (e) {
  //     console.log(e);
  //   }

  //   break;
  // }

  // await upsertRoutes();
})();
