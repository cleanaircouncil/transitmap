import { atom, map } from "nanostores";
import theData from "../data/index.json";

export const data = theData;

export const currentListingSlug = atom("");
export const currentRoute = atom("");
export const currentVenue = atom("");
// export const attachment = map(null)
// export const resultCount = atom(data.facilities.length);
// export const totalFacilities = atom(data.facilities.length);


const cachedVenueData = {}

export function getListingBySlug(slug) {
  return data.listings.find( listing => listing.slug === slug );
}

export function toggleRouteDisplay(key) {
  if( currentRoute.get() == key )
    currentRoute.set("");
  else
    currentRoute.set(key);
}



export async function fetchVenueData(slug) {
  if( cachedVenueData[slug] ) {
    const cachedData = cachedVenueData[slug];
    return cachedData;
  }

  const result = await fetch(`/data/venues/${slug}.json`);
  const data = await result.json();

  cachedVenueData[slug] = data;
  return data;
}


const INDEGO_URL = import.meta.env.DEV
  ? `/data/indego-test.json`
  : `https://www.rideindego.com/stations/json/`;

let cachedIndegoData = null;

export async function fetchIndegoData(stop_id) {
  if (!cachedIndegoData) {
    const response = await fetch(INDEGO_URL);
    cachedIndegoData = await response.json();
  }

  const station = cachedIndegoData.features.find(f => f.properties.id == stop_id);
  return station?.properties;
}
