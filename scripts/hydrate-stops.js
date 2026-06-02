
import fs from "fs";
import "dotenv/config";

import * as turf from "@turf/turf";

import data from "../src/data/data.json" with { type: "json" };
import stops from "../src/data/stops.json" with { type: "json" };

async function hydrateStops() {
  const stopsByTransit = Object.entries(stops);
  const nearby = {}

  for (const listing of data.listings ) {
    // console.log( network );

    const listingStops = {
      networks: []
    }

    stopsByTransit.forEach(([network_id, data]) => {
      const filteredStops = data.stops.filter( stop => turf.distance( [stop.stop_lon, stop.stop_lat], [listing.longitude, listing.latitude], {units: "miles"} ) < .5) //filter stops within 0.5 miles of thing      
      const cleanedStops = filteredStops.map( ({ global_stop_id, stop_name, stop_code, stop_lat, stop_lon }) => ({global_stop_id, stop_name, stop_code, stop_lat, stop_lon}));

      if( cleanedStops.length ) {
        listingStops.networks.push({
          network_id,
          stops: cleanedStops
        })
      }
        
    })
    
    nearby[listing.slug] = listingStops;
    
  }

  fs.writeFileSync("./src/data/nearby.json", JSON.stringify(nearby, null, 2));
}

(async () => {
  await hydrateStops();
})();
