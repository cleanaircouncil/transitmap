# Prototype: Tours UI/UX

**Question:** What should the "Tours" feature (evergreen, themed collections of venues) look
like, responsively, given the existing list → listing detail → venue detail flow?

**Route:** `/prototype-tours?variant=a|b|c` (run `npm run dev`)

## Variants

- **A — App shell.** Tours become a peer of the existing schedule inside the current
  map/list App shell (`app.astro`). A tour is a card in the list panel; opening it swaps
  the list to a numbered stop list and (in the real build) drops pins for every venue on
  the map. Cheapest to build, most consistent with the current app, but the map real
  estate is wasted for a tour that's mostly about reading, not real-time position.
- **B — Editorial.** Tours live outside the map app entirely, as standalone content pages
  (closer to `/about`) — hero banner, card grid index, itinerary-style detail page with
  numbered stops and inline upcoming listings per venue. No map dependency at all.
- **C — Transit line.** Leans into the site's own "car-free routes" metaphor: tours
  rendered as a subway-line stepper, each stop an accordion. Mobile-first, no map needed,
  reads well as a scannable itinerary.

## Verdict

_(fill in after review — which variant, or which pieces of each, and why)_

## Cleanup

Delete `src/pages/prototype-tours.astro` and this file once the decision is folded into
a real `/tours` implementation.
