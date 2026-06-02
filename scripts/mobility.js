import fs from "fs";
import "dotenv/config";
import apify from "./apify.js";
import token from "../.mobility.json" with {type: "json"};

const mobilityAPI = apify(process.env.MOBILITY_API_URL);

async function getToken() {
  if (token && token.expiration_datetime_utc > new Date().toISOString()) {
    console.log("✅ Token still valid, using!");
    return token;
  }

  console.log("⏳ Token not found or no longer valid, fetching...");
  token = await mobilityAPI.post("tokens", {
    refresh_token: process.env.MOBILITY_API_REFRESH_TOKEN
  });
  
  console.log("✅ Fresh token cached, using!");
  fs.writeFileSync("./.mobility.json", JSON.stringify(token, null, 2));

  return token;
}





(async() => {
  await getToken();
})();