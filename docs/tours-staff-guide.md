# Tours — Staff Guide

How to create and manage **Tours** on the GoPhillyGo: Car-Free Routes map. No code required — everything is done in Airtable.

---

## What a Tour is

A Tour is an evergreen, themed collection of venues — "Philly Music Halls," "Historic Waterfront," "Car-Free Museum Day." Unlike the event calendar (which is date-bound), a Tour stays up until you hide it.

On the site, Tours live under the **Tours** tab (`/tours`). Each Tour has its own page showing a photo, a description, and a numbered list of stops. Tapping a stop opens that venue's page with all the nearby transit.

---

## Before you start: every stop must be a Venue

A Tour is built out of **Venues**, so each place on your tour has to exist in the **Venues** table first.

Check the Venues table for the place you want. If it's not there, add a row:

| Field | What to enter |
|---|---|
| **Name** | The venue's public name (e.g. "World Cafe Live") |
| **Address** | Full street address |
| **Latitude** / **Longitude** | Decimal coordinates. Get them by right-clicking the spot in Google Maps and clicking the numbers to copy. |

A venue with no coordinates is skipped entirely — it won't show up on the map or in a tour.

> A venue only appears on the public site if it's used by a current event **or** a visible tour. Adding a venue to the table alone does nothing until something references it.

---

## Creating a Tour

Go to the **Tours** table and add a row.

| Field | Required? | What it does |
|---|---|---|
| **Name** | Yes | The tour title. Also becomes the page's web address, so keep it clean (e.g. "Philly Music Halls" → `/tours/philly-music-halls`). |
| **Short Description** | Recommended | One line, shown on the tour card in the list. |
| **Long Description** | Recommended | The full write-up on the tour's own page. Supports basic formatting (bold, links, lists) using Markdown. |
| **Image** | Optional | One photo for the top of the tour page. Attach a landscape image; if you attach several, the first is used. Leave it empty and no image shows (no broken placeholder). |
| **Venues** | Yes | Link the venues that make up this tour — these are the stops. **The order you arrange them here is the order they appear on the site.** |
| **Is Ordered** | Optional | Checkbox. Meant to indicate whether the stops are a strict sequence vs. a loose collection. (Stops currently always display as a numbered list regardless.) |
| **Status** | Yes | The publish switch. See below. |

### Ordering the stops

In the **Venues** field, drag the linked records into the order you want. Stop 1 at the top. The site renders them as a numbered list in exactly that order.

---

## Publishing a Tour

**The `Status` field controls whether a tour is live.**

- Set **Status → `Visible`** to publish it.
- Any other value (or blank) keeps it hidden from the public site.

Use this to draft a tour over several days and flip it live when it's ready, or to retire a seasonal tour without deleting it.

### When changes go live

The site rebuilds itself from Airtable **once a day, automatically.** Any change you make — a new tour, a reworded description, a reordered stop, a Status flip — appears on the public site within 24 hours.

**To push a change immediately** (e.g. a tour needs to be up for an event this afternoon):

1. Log in to Netlify.
2. Open the GoPhillyGo site.
3. Go to **Deploys** and click **Trigger deploy → Deploy site**.
4. Wait ~2 minutes for the build to finish, then check the live site.

If you don't have Netlify access and need something up now, contact Dain.

---

## What it looks like on the site

- **`/tours`** — the index. Each tour is a card: image, name, short description.
- **`/tours/{name}`** — the tour page: image, name, long description, "N stops," and the numbered list of venues. Each venue links to its detail page with nearby SEPTA / PATCO / NJ Transit / Indego options.

---

## Common gotchas

| Problem | Cause / fix |
|---|---|
| Tour isn't showing up | `Status` isn't set to exactly `Visible`. Or you're looking before the daily rebuild ran — trigger a deploy or wait. |
| A stop is missing from the tour | That venue has no Latitude/Longitude, or the linked Venue record was deleted. |
| Tour page has a broken/missing image | The attachment was removed, or it's a file type that isn't an image. Re-attach a JPG or PNG. |
| Description formatting looks wrong | Long Description uses Markdown. `**bold**`, `[link text](https://…)`, and `- ` bullet lists work; raw HTML does not. |
| Changed something, site looks the same | The daily rebuild hasn't run yet. Trigger a Netlify deploy for an immediate update. |
| Renamed a tour and the old link broke | The web address is derived from the Name. Renaming changes the URL. Avoid renaming a tour that's been shared publicly. |

---

## Quick reference

**To add a tour:** Venues exist → new row in Tours table → Name, descriptions, image, link + order the Venues → Status = `Visible` → wait for daily rebuild or trigger a Netlify deploy.

**To hide a tour:** change its `Status` away from `Visible`.

**To reorder stops:** drag the linked records in the `Venues` field.
