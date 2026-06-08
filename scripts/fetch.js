import Airtable from "airtable";
import fs from "fs";
import "dotenv/config";
import { slugify } from "./utils.js";
import { marked } from "marked";
import * as turf from "@turf/turf";

import airtableAPI, { Bases, jsonify } from "./airtable.js";

const base = new Airtable({
  apiKey: process.env.AIRTABLE_TOKEN
}).base(process.env.AIRTABLE_BASE_ID)


const listings = [];
const venues = [];


async function getAll( base, ids ) {
  const results = [];
  for( const id of ids ) {
    const data = await airtableAPI.get( `${base}/${id}` )
    results.push(data);
  }

  return results;
}



async function recordToListing(record) {
  const listing = jsonify(record);

  if(listing.type == "Event") {
    console.log(`📆 ${listing.name.trim()}`);
  } else if(listing.type == "Attraction") { 
    console.log(`🎡 ${listing.name.trim()}`);
  }
  
  listing.id = record.id;
  listing.slug = slugify(listing.name + " " + listing.date?.split("T").at(0));

  return listing;
}


async function recordToVenue(record) {
  const venue = jsonify(record);

  console.log(`🏟️ ${venue.name.trim()}`);

  venue.id = record.id;
  venue.slug = slugify(venue.name);

  return venue;
}




function produceMapData( data ) {
  console.log("🗺️  Producing map data...")

  const points = turf.featureCollection( data.listings.map( listing => turf.point([ listing.longitude, listing.latitude ])));
  const bounds = turf.bbox(points);
  
  const result = {
    map: {
      bounds
    },
    listings: data.listings.map( ({latitude, longitude, slug})=> ({latitude, longitude, slug }))
  }

  return result;
}

console.log( "✈️  Querying Airtable...")


base('Listings')
  .select()
  .eachPage( async function page (records, fetchNextPage) {
    for( const record of records ) {
      const listing = await recordToListing(record);
      const arrays = ["group", "group_name", "venue", "venue_name", "latitude", "longitude"];
      arrays.forEach( key => listing[key] && (listing[key] = listing[key][0]));
      
      listings.push( listing );
    }

    fetchNextPage();
  }, async function done(error) {
    if(error) {
      console.error(error);
      return;
    }  

    listings.sort((a, b) => a.date < b.date ? -1 : 1 )
    


    console.log( "💾 Writing data.json...")
    fs.writeFileSync("./data/airtable/listings.json", JSON.stringify( listings, null, 2 ));


    // const mapData = produceMapData(data);
    // console.log( "💾 Writing map-data.json...")
    // fs.writeFileSync("./data/airtable/map-data.json", JSON.stringify( mapData ));

    console.log("✅ Done!")
  })



base("Venues")
  .select()
  .eachPage(
    async function page(records, fetchNextPage) {
      for (const record of records) {
        const venue = await recordToVenue(record);
        venues.push(venue);
      }

      fetchNextPage();
    },
    async function done(error) {
      if (error) {
        console.error(error);
        return;
      }

      console.log("💾 Writing venues.json...");
      fs.writeFileSync("./data/airtable/venues.json", JSON.stringify(venues, null, 2));

      // const mapData = produceMapData(data);
      // console.log("💾 Writing map-data.json...");
      // fs.writeFileSync("./src/data/map-data.json", JSON.stringify(mapData));

      console.log("✅ Done!");
    },
  );