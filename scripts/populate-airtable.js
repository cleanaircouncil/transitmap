import parse from "node-html-parser";
import airtableAPI, { Bases, jsonify } from "./airtable.js";

import allRoutes from "../src/data/routes.json" with { type: "json" };

async function updateTable(record) {
  const facility = jsonify(record);

  console.log(`🏭 ${facility.company_name.trim()}`);

  if (!facility.dep_link) return;

  console.log(`  🔗 Getting facility data from DEP...`);
  const depData = await fetchDEPDataForURL(facility.dep_link);

  if (!depData?.length) return;

  const records = depData.map((fields) => ({ fields: { Facility: [record.id], ...fields } }));

  console.log(`  ⬆️  Pushing ${records.length} record(s) to airtable...`);



  await new Promise((res) => setTimeout(res, Math.random() * 4000 + 1000));
}


async function upsertRoutes() {

  const validModes = [
    {
      mode: "Bike",
      names: ["Bikeshare"]
    },
    {
      mode: "Bus",
      names: ["Bus"]
    },
    {
      mode: "Metro",
      names: ["Subway", "Trolley"]
    },
    {
      mode: "Rail",
      names: ["Rail"]
    }
  ]

  const modeNameToInterface = (mode_name) => validModes.find( valid => valid.names.includes(mode_name) )?.mode;

  const records = allRoutes.routes.map( route => ({
    fields: {
      Name: route.real_time_route_id,
      Agency: route.route_network_name,
      "Global ID": route.global_route_id,
      Mode: modeNameToInterface(route.mode_name),
      Color: `#${route.route_color}`,
      "Text Color": `#${route.route_text_color}`
    }
  }));


  for(let i = 0; i < records.length; i += 25) {
    // console.log(records.slice(i, i + 25));
    await airtableAPI.patch(Bases.ROUTES, {
      performUpsert: {
        fieldsToMergeOn: ["Global ID"],
      },

      records: records.slice(i, i + 25)
    });
  }


}


async function upsertStopsForVenue(venue) {

  const stops = await transitAPIPublic.get("nearby_stops", {
    lat: venue.latitude,
    lon: venue.longitude,
    max_distance: 1600,
  });


  // for each evenue:
    // get neearby stops from transit api
    // for each nearby stop, create data shape
      // route_id -> should only be one
      // venue_id


}

(async() => {
  const venues = await airtableAPI.get(Bases.VENUES);
  for (const record of result.records) {
    try {
      await updateStops(record);
    } catch (e) {
      console.log(e);
    }
  }


  // await upsertRoutes();
})()