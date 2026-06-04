import { atom, map } from "nanostores";
import theData from "../data/index.json";

export const data = theData;

export const currentListingSlug = atom("");
export const currentRoute = atom("");
export const currentVenue = atom("");
export const currentVenueData = map(null);
// export const attachment = map(null)
// export const resultCount = atom(data.facilities.length);
// export const totalFacilities = atom(data.facilities.length);

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
  if( slug == currentVenue.get() )
    return currentVenueData.get();

  currentVenue.set(slug);

  const result = await fetch(`/data/venues/${slug}.json`);
  const data = await result.json();
  currentVenueData.set(data);
  return data;
}
