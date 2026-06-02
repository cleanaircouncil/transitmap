import Airtable from "airtable";
import fs from "fs";
import "dotenv/config";
import { slugify } from "./utils.js";
import { marked } from "marked";
import * as turf from "@turf/turf";


import apify from "./apify.js";


const septaAPI = apify(process.env.SEPTA_API_URL);



async function getRealTime() {
  const result = await septaAPI.get("TransitView/index.php", {})
  const stops = await septaAPI.get("Stops/index.php", {
    req1: "57"
  });


  const rez = await fetch(`${process.env.SEPTA_API_URL}/sms/index.php?req1=842&req2=57`);

  const times = await rez.text();
  console.log( times );

  fs.writeFileSync("./src/data/septa.json", JSON.stringify( result ));
  fs.writeFileSync("./src/data/septa-stops.json", JSON.stringify(stops));
}

(async() => {
  await getRealTime();
})();