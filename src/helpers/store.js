import { atom, map } from "nanostores";
import theData from "../data/index.json";

export const data = theData;

export const currentListingSlug = atom("");
// export const search = atom("");
// export const attachment = map(null)
// export const resultCount = atom(data.facilities.length);
// export const totalFacilities = atom(data.facilities.length);

export function getListingBySlug(slug) {
  return data.listings.find( listing => listing.slug === slug );
}