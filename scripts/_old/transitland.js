import fs from "fs";
import "dotenv/config";
import apify from "./apify.js";

import data from "../src/data/data.json" with { type: "json" };

const PHILLY_LAT = 39.952583;
const PHILLY_LON = -75.165222;

const transitLandAPI = apify(`${process.env.TRANSITLAND_API_URL}/v4/public`, { apiKey: process.env.TRANSITLAND_API_KEY });


async function getData() {
  agencies = await transitLandAPI.get("agencies", {
    agency_id: "SEPTA"
  });

  console.log( agencies );
}

(async () => {
  await getData();
})();
