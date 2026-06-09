---
layout: ../layouts/md-layout.astro
title: About the Tracker
slug: about
---

# About
During large sporting events and celebrations, the Greater Philadelphia region experiences increased traffic congestion. Being stuck in traffic wastes time and increases air pollution. To help residents and visitors get around more sustainably, Clean Air Council developed this map to highlight event locations, offering ways to get around without driving. This easy-to-use map can help you plan your car-free route using available public transportation with SEPTA, PATCO, New Jersey Transit, Indego bike share, or finding park-and-ride locations.

During the summer of 2026, this map will highlight sustainable ways to get to event locations, providing alternative routes to travel to FIFA games and A250 events instead of further congesting major highways and thoroughfares like I-95, I-76, and  I-676. 

**How To Use GoPhillyGo: Car-Free Routes Map**

As part of its commitment to protect everyone’s right to a healthy environment, Clean Air Council promotes transitioning away from using single-occupancy vehicles to more sustainable options that reduce air emissions and increase the overall health of Pennsylvanians. This map highlights scheduled events along with local parks and trails to visit car-free.

**Each event listed on the map has:**
1. Name of the event
2. Date and time
3. Location

**Users are be able to:**
* Browse map
* Select events
* Filter by event type
* Identify transit stops within a specified radius of each event
* Link out to Google Maps to map their trip


---

*Made possible thanks to a generous contribution from the [Delaware Valley Regional Planning Commission](https://dvrpc.org).*

<div class="grid">
  <a href="https://cleanair.org"><img src="/assets/img/cac-logo-square.png"/></a>
  <a href="https://dvrpc.org"><img src="/assets/img/dvrpc-logo.png"/></a>
</div>

<style>
  .eyebrow {
    text-transform: uppercase;
    color: var(--color-white);
    background: var(--color-accent);
    font-weight: bold;q
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    border-radius: 0.25rem;
  }

  .eyebrow[data-type='alert'] {
    background: var(--color-danger);
  }

  .grid {
    display: flex;
    padding-block: 2rem;
    margin-inline: auto;
    max-width: 300px;
    gap: 1rem;
    justify-content: center;
    
    a {
      display: block;
      place-content: center;
    }

    img {
      width: 100%;
      display: block;
    }
  }


</style>
