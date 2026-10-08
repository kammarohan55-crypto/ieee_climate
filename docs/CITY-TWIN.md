# City planning twin

TerraTrace now opens on a district planning twin: actual OpenStreetMap geometry, live Open-Meteo forecasts, adjustable interventions, a before/after comparison, and portable evidence. The study window is 1.6 × 1.6 km around the selected city coordinate. It is not a complete city inventory or a calibrated urban atmospheric simulation.

## Baseline and timeline

Buildings, roads, parks and water are authentic mapped features. Eight dated map captures provide stable featured-city geometry; arbitrary locations and explicit refresh try VK Maps Overpass, then a bounded OSM map query if that service fails. These providers may be unavailable. The OSM map fallback reports retrieval time explicitly because it supplies no OSM base timestamp. Queries are cached for a day per server isolate, with eight locations retained. Each capture retains provider URL, query, retrieval time, OSM base time and ODbL attribution. Geometry is made from ways; relation multipolygons are omitted. Mapped parks do not establish measured tree canopy. Missing heights use 10 m; mapped floor counts use an assumed 3 m/floor. Height is visual only and capped at 150 m. At most 700 larger buildings show extruded height; other mapped footprints remain flat.

The weather baseline is tomorrow's forecast. “After” means a counterfactual with interventions fully implemented under that same weather. Trees represent mature, non-overlapping canopy years after planting. No city has changed because a control moved. Observe actual results with meters and locally matched environmental measurements later.

## Reproducible calculations

- Roof area: locally projected, clipped 2D OSM building footprints in m². Completeness, structural suitability, shading, existing PV and accessible roof area are unknown.
- Cool roofs and PV: non-overlapping percentages of mapped footprint area. Controls enforce a total at most 100%. Stable OSM ID order assigns treatment for visualization, not a suitability ranking. Partial roof color bands are schematic; model area allocations are exact.
- Additional reflected solar energy: cool-roof area × positive albedo difference × horizontal shortwave W/m² / 1000 × 1 h. This is solar energy reflected, not electricity saved.
- PV capacity: assigned footprint area × assumed panel density (default 0.20 kWp/m²).
- PV output: capacity × tilted irradiance / 1000 × performance (default 0.80). Latitude-based tilt and equator-facing panels match the weather API request. No batteries, site shading, clipping or cell-temperature model.
- Demand: editable daily demand (default 25,000 kWh, an assumption) and an explicitly illustrative weighted hourly profile. Baseline assumes no existing PV. Matched solar = min(PV, assumed demand), per hour. Surplus is excluded from the matched-electricity carbon calculation.
- Carbon potential: matched electricity × editable grid factor (default 0.40 kg CO₂e/kWh). No certified offsets or measured avoided emissions.
- Cooling reference: `6.1 × cool roof area / district area × albedo change` plus `selected canopy coefficient × added canopy fraction / 0.1`, multiplied by the editable sensitivity factor. The canopy default is 0.10°C per +10pp, an assumed reference. These transferred coefficients are not fitted to the selected city.
- Daylight profile: cooling reference × min(1, horizontal shortwave / assumed reference irradiance). The default 800 W/m² reference is a heuristic assumption, not a paper result. Nighttime solar-zero intervals have no modeled cooling.
- Exploration lines use 0.5× and 1.5× cooling; they are not confidence intervals. Roof and canopy effects are assumed additive; interactions, humidity and airflow are not simulated.
- Temperature degree-hours use hourly endpoint samples above an editable threshold. This approximation is not a health-risk estimate.

Incomplete/truncated geometry or missing required forecast values disable outcome totals, export and receipt sealing. The source record marks `complete`; unavailable computed intermediates must not be interpreted as true zero results.

## Research used

The app's Research library has six peer-reviewed sources and a precise implementation/limitation note for each. Core numerical references:

- [Smith et al. (2025), Communications Earth & Environment](https://doi.org/10.1038/s43247-025-02462-3): Boston bulk-albedo sensitivity. [Author-hosted full text](https://sites.bu.edu/efm/files/2025/08/Smith_2025_CEE.pdf).
- [McDonald et al. (2026), Nature Communications](https://doi.org/10.1038/s41467-026-71825-x): canopy sensitivity varies with climate and impervious cover. [Coefficient table](https://www.nature.com/articles/s41467-026-71825-x/tables/1).
- [Borah et al. (2026), Nature Communications](https://doi.org/10.1038/s41467-026-72636-w): humidity-related thermal-comfort caveat; no universal penalty coefficient is added.

The library also credits Calgary canopy targeting, London intervention tradeoffs, and PV demand scheduling research. NASA Eco-Metropolis and SkySense, Chainlink DREx, and ETHGlobal Skywood inspired the workflow. Awards are verified on organizer pages, and do not establish scientific validity. TerraTrace does not copy their code or branding.

## Evidence

A city receipt contains full map geometry, raw forecasts, sources, model version, assumptions, results and reference URLs. The observation identity incorporates weather time, OSM time, scenario digest and geometry digest. Changing a scenario produces a different identity. Verification catches changes to either source data or assumptions. IndexedDB holds larger device-local receipts; the older localStorage format migrates on the next successful save. Export portable JSON copies. Optional Sepolia anchoring remains available through the existing registry.

## Verification

`npm run test:twin` checks all eight authentic captures, clipping, inventory completeness, area allocation, energy balance, zero interventions, height provenance, reflected sunlight units, nighttime invariance, irradiance sensitivity, missing values and scenario tamper detection. The original data/proof/ML checks remain in `npm test`.
