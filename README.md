# GoPhillyGo: Car-Free Routes

A project by the [Clean Air Council](https://cleanair.org) that maps car-free ways to get to major events in Greater Philadelphia — starting with the summer of 2026's FIFA World Cup games and America250 celebrations.

Big events bring big traffic. Sitting in that traffic wastes time and adds to air pollution. This site gives residents and visitors an easy way to plan a car-free trip to an event using SEPTA, PATCO, and NJ TRANSIT, Indego bike share, or a park-and-ride.

## What You Get

- A map of event locations, plus nearby parks and trails worth a car-free visit
- Each event listed with its name, date/time, and location
- Transit stops within a half-mile radius of each event
- Links out to [Transit](https://transitapp.com) to build a trip

## How It's Built

- [Astro](https://astro.build) static site
- Event and venue data pulled from Airtable (`scripts/fetch.js`) and built into static JSON (`scripts/build-data.js`)
- Transit stop data pulled via the Mobility Data API (`scripts/mobility.js`, `scripts/fetch-transit-geojson.js`)
- Deployed on Netlify, with a function (`netlify/functions/rebuild-site.mjs`) to trigger rebuilds when data changes

## Development

```bash
npm install
npm run fetch   # pull latest data from Airtable + build static JSON
npm run dev      # start local dev server
```

Other scripts:

```bash
npm run build     # build for production
npm run preview   # preview the production build
```

You'll need a `.env` file with:

```
AIRTABLE_TOKEN=
AIRTABLE_BASE_ID=
MOBILITY_API_URL=
MOBILITY_API_REFRESH_TOKEN=
```

## Who's Behind It?

Built and maintained by the [Clean Air Council](https://cleanair.org), a nonprofit working for everyone's right to breathe clean air, made possible thanks to a generous contribution from the [Delaware Valley Regional Planning Commission](https://dvrpc.org).

---

Questions or feedback?
📬 info@cleanair.org
