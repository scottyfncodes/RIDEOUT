# RIDEOUT — Prompt Analysis & Improved Brief

> Find the ride. Know the ride. Get out there.

This document reviews the original build prompt, calls out the places where it was
ambiguous, contradictory or impossible to satisfy honestly, and records the
revised brief that v1 was actually built against.

---

## 1. What the original prompt gets right

- **One question.** "Where should I ride today?" is a sharp product thesis. Every
  feature is judged against it.
- **Honesty as a feature.** "Never turn a forecast into fake trail-condition
  certainty", "Not enough data", and "no fake AI" are the correct constraints for
  a tool people use to decide whether to drive 90 minutes.
- **Explainability.** A transparent score and a WHY for every recommendation.
- **Anti-scope.** No social features, no accounts, no leaderboards.
- **A priority list** (§34) that makes it possible to cut scope sensibly.

## 2. Problems in the original prompt, and how v1 resolves them

| # | Issue in the prompt | Why it matters | Resolution in v1 |
|---|---|---|---|
| 1 | **UNKNOWN vs. the rest of the status scale.** Trail condition is almost never observable (no public API for Front Range trail status), so a literal reading makes nearly every area ⚪ UNKNOWN. That would make the app useless. | A decision engine that always says "unknown" answers nothing. | **Two separate signals.** *RIDEOUT status* (SEND IT → SKIP IT) is a recommendation built from forecast, recent precipitation, fit and access rules. *Trail condition* is shown separately and is "Not reported" unless it has actually been observed. Status is ⚪ UNKNOWN only when we can't get the weather needed to make a recommendation. The UI always says which one you're looking at. |
| 2 | **Example numbers are invented** (Buffalo Creek "22.4 mi / 2,840′", Floyd Hill "11.8 mi / 1,950′"). | These would be copied as if they were real. | Every stat comes from a named source, with a confidence level. Anything that isn't sourced shows **Not enough data**. |
| 3 | **Areas vs. routes.** Stats like distance and gain describe one *route*. Buffalo Creek is a 40+ mile *network*. | "Distance: 22.4 mi" for an area is meaningless. | The model is **Area → Signature rides**. Areas have network facts (trail miles, managing agency, access rules). Signature rides carry distance, gain and time, each with its source. |
| 4 | **Missing the #1 Front Range gotcha: access rules by date.** Betasso is closed to bikes on Wednesdays and Saturdays. Apex runs odd/even-day designated use. Some trails are directional. | Recommending Betasso on a Saturday is the worst possible failure. | **Access rules are first-class data** and a hard gate in the engine. A closed area can never outrank an open one, and the reason is printed. |
| 5 | **Muddy-trail etiquette.** Riding wet Front Range clay causes lasting damage, and many agencies close trails when they're muddy. | Encouraging riders onto wet trails hurts the trails and the community. | Mud risk works like a ceiling: 🔴 High caps the status at SKIP IT, and the WHY says "don't ride wet trails". |
| 6 | **"Keep API keys server-side" with a GitHub Pages target.** GitHub Pages has no server. | Any keyed API (Google Routes, Places, Yelp) would leak its key. | **v1 uses only keyless public APIs**: Open-Meteo (weather), OSRM (driving), and OpenStreetMap/Overpass (shops, food, parking). There are no secrets to leak. Adapters make it easy to swap in a keyed provider behind a proxy later. |
| 7 | **Business data (hours, patio, dog-friendly).** Hand-curated lists go stale quickly. Commercial APIs need keys. | Stale hours are worse than none. | Pull live from OpenStreetMap at view time. Show only the tags that actually exist ("Hours not listed" otherwise). The OSM source link is on every place. |
| 8 | **Drive time needs a home.** The prompt never says where "home" is. | Every departure time depends on it. | Settings store a home location on the device (presets or GPS). Drive times say where they came from (OSRM, no live traffic). If routing fails, a clearly labeled straight-line estimate is shown instead. |
| 9 | **Overlapping controls.** "Ride type" (§3), "What kind of ride?" (§21), Quick Rip/Big Adventure modes (§17–18) and "Difficulty" all overlap. | Too many knobs for a one-handed phone UI. | Split into two orthogonal rows. **What are we doing?** covers *time* (Quick Rip with a 2/3/4 h budget, Half Day, Big Adventure, Bike + Brewery). **Vibe** covers the *kind of riding* (Cruise, Rip, Get Technical, Earn It, Questionable Decisions). Then two small rows: **How hard** and **How far**. Every row has a sensible default. |
| 10 | **Weather at riding elevation.** Point forecasts differ by thousands of feet across one area. | "Nearest town" weather can be 15°F off. | Forecast is requested at the trailhead coordinates. The model's grid elevation is shown so users can see what the forecast actually represents. |
| 11 | **§35 "every seeded trail area has verified data".** Can't be fully automated. Official sites change and some block automated access. | Presenting unverified data as verified breaks the core promise. | Each fact carries `source`, `sourceUrl`, `confidence` (`official` / `reported` / `editorial`) and `verified` (date). Ride-character ratings are marked **RIDEOUT editorial**, not fact. Unknowns stay null. |
| 12 | **E2E against live APIs is flaky**, and live data is non-deterministic. | CI would randomly fail. | Unit tests run on fixtures. Playwright e2e stubs network responses, including failure modes, so the primary flow is deterministic. |

## 3. Revised product brief (what v1 implements)

**Core loop (under 10 seconds, one thumb):**
Open → pick *When* (Today / Tomorrow / Sat / Sun / date) → pick *What are we doing?* →
optionally *How hard* / *How far* → **FIND MY RIDE** → ranked list with status, best
window and a one-line WHY → tap for the full profile → share card.

**Recommendation = gates + transparent score**
1. *Gates* (hard): closed to bikes that day → SKIP IT. Seasonal closure → SKIP IT.
   Weather unavailable → UNKNOWN.
2. *Score* (0–100) = weighted components, each shown with its own line in the
   breakdown:
   weather window quality · mud-risk estimate · difficulty fit · time fit
   (drive + ride within budget) · preference fit · apres fit (Bike + Brewery).
3. *Ceilings:* High mud risk caps at SKIP IT. Severe storm or wind caps at QUESTIONABLE.
4. *Explanation* is generated from the same component values, so the WHY text
   always matches the numbers.

**Ride window:** hourly classification of the forecast (temperature, precip
probability and amount, weather code/thunder, gusts). Daylight and the ride-length
budget constrain the window. The best contiguous block gets 🟢. Labeled
*WEATHER FORECAST*, never *trail condition*.

**Mud risk:** based on precipitation over the last 72h, weighted to the most recent,
plus forecast precipitation, temperature (freeze/thaw) and modeled snow.
Soil-drainage character is set per area (e.g. decomposed granite at Buffalo Creek
drains fast; Front Range clay doesn't). Always labeled as an *estimate*.

**Out of scope for v1 (deliberately):** accounts, sync, social features, Google
Routes/Places (they need a key and a server), live trail-condition feeds (no reliable
public API), turn-by-turn navigation (we hand off to Maps).

## 4. Next iterations
1. Tiny serverless proxy (Cloudflare Worker) → Google Routes with traffic, keys kept server-side.
2. Crowd-free trail-condition signal: parse official agency closure pages where permitted.
3. More areas (Fruita, Salida, Summit County, Crested Butte) as region packs.
4. GPX loops per signature ride, drawn on the map.
