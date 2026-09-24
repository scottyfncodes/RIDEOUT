# RIDEOUT

> Find the ride. Know the ride. Get out there.

A mobile-first PWA that answers one question: **“Where should I ride today?”**
It combines Colorado Front Range riding areas with the forecast, recent precipitation, access rules,
drive time and apres, then turns them into an explainable recommendation.

**Live:** https://scottyfncodes.github.io/RIDEOUT/

For personal use by a small group of riders. No accounts, no social features, no API keys.

## What it does

- **Find my ride:** pick when, what you're doing (Quick Rip / Half Day / Big Adventure / Bike + Brewery), a vibe, difficulty and max drive. RIDEOUT ranks the areas as 🟢 SEND IT / 🟡 WORTH IT / 🟠 QUESTIONABLE / 🔴 SKIP IT / ⚪ UNKNOWN, each with a WHY.
- **Ride window:** the best daylight block from the hourly forecast, labeled as *weather*, not trail condition.
- **Mud risk (estimate):** from 72 h of precipitation, rain before your start, soil drainage per area, temperature, freeze/thaw and modeled snow.
- **Access rules by date:** e.g. Betasso is closed to bikes on Wed/Sat, and Apex uses odd/even designated-use days.
- **Getting there:** drive time from your home, then leave → trailhead → ride → apres → home.
- **Area profile:** quick stats, multidimensional ride character, weather, parking, trail-map links, bike shops, apres, and a shareable ride card.
- **Map:** status markers for every area.
- **Garage:** *RIDEOUT knows where you're riding. Garage knows what you're riding.*
  - **My bike:** one saved bike. Only a name is needed, and everything else is optional. Edit it from Garage or Setup; both change the same stored bike.
  - **Pre-ride check:** a quick tick-list that adapts to the bike (sealant only for tubeless, battery only for e-MTB). Ticks clear each day, so no history is kept.
  - **Service log:** optional last-service dates for suspension, brakes, drivetrain and tires, plus notes. It does no scheduling and tracks no mileage.
  - **Bike shops:** the same OpenStreetMap shop list the area profile uses, near home or any riding area, filtered by tagged services.
  - **Trailside help:** short fixes for common mechanicals, each ending with an escalation point.
- **Bike Prep** (area profile): a short list of prep checks, shown only when the ride calls for it. Triggers are technical terrain, a long ride, big climbing, wet or cold forecast, or heat. It is tailored to the saved bike and never recommends a tire pressure.
- **Data sources:** every number shows where it came from. Missing data shows “Not enough data”.

See [`docs/PRODUCT_BRIEF.md`](docs/PRODUCT_BRIEF.md) for the prompt analysis and the design decisions behind it.

## Architecture

```
src/
  content/     static riding-area content + source metadata; garage.ts = checklist, prep checks, trailside help
  data/        regions, home presets
  engine/      pure decision logic: weather, rideWindow, mudRisk, access, fit, planner, apres, recommend,
               garage (bike/service/checklist persistence), bikePrep (ride-aware prep rules)
  services/    adapters for external data (Open-Meteo, OSRM, Overpass) + cache — never throw into UI
  hooks/       data loading + routing
  screens/     Home, Area, Map, Garage, BikeEditor, Settings, Sources
  components/  UI building blocks and area-profile panels
  utils/       time, geo, formatting, opening-hours parser
tests/
  unit/        Vitest: engine, adapters, content integrity
  e2e/         Playwright: primary flow + failure modes, network fully mocked
```

The engine is a pure function of content, forecast, drive times, preferences and search parameters.
Every score component is shown in the UI, and the WHY text is generated from the same values.

## Data sources (all keyless)

| Data | Source | Notes |
|---|---|---|
| Weather, past precip, sunrise/sunset | [Open-Meteo](https://open-meteo.com) | One multi-location request, cached 30 min |
| Drive times | [OSRM](https://project-osrm.org) public server | No live traffic. Falls back to a labeled straight-line estimate |
| Shops, food, breweries, parking | OpenStreetMap via Overpass | Only tagged attributes are shown |
| Map tiles | OpenStreetMap | Attribution shown |
| Trail content | Agency pages, MTB Project, Trailforks, AllTrails, COMBA | Per-fact source + confidence in `src/content/areas` |

Google Routes/Places would need a key, and GitHub Pages has no server to keep one secret. To add a
keyed provider, put a small proxy (e.g. a Cloudflare Worker) in front of it and swap the adapter in
`src/services/`.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests
npm run test:e2e     # Playwright (builds + previews)
npm run build        # → dist/
npm run icons        # regenerate apple-touch-icon, manifest and favicon PNGs from public/icon.svg
```

## Adding an area

Add a `RidingArea` to `src/content/areas/frontRange.ts` (or add a new region file to `src/content/areas/index.ts`).
Rules: use `null` for anything you can't source, attach a `Source` to every number, and label ride-character
ratings as editorial. `tests/unit/content.test.ts` enforces this.

## Deploy

`.github/workflows/deploy.yml` tests and builds on every push, and deploys `dist/` to GitHub Pages
from the default branch. One-time setup: **Settings → Pages → Source: GitHub Actions**.
