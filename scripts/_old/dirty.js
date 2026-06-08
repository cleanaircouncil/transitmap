import { distance } from "@turf/turf";

import septaMetro from "../data/septa-metro.json" with { type: "json" };
import patco from "../data/patco.json" with { type: "json" };


import listingData from "../src/data/data.json" with { type: "json" };


const inRangeMiles = 500;

const stopFeatures = patco.features.filter((feature) => feature.properties.stop_id);

// console.log( stopFeatures );

listingData.listings.forEach( listing => {
  const stopsInRange = stopFeatures.filter( stop => 
    distance( stop.geometry.coordinates, [listing.longitude, listing.latitude], { units: "meters" } ) <= inRangeMiles
  )

  const stops = stopsInRange.map( stop => ({
    latitude: stop.geometry.coordinates[1],
    longitude: stop.geometry.coordinates[0],
    name: stop.properties.stop_name
  }))

  console.log( listing.name, stops );
})



