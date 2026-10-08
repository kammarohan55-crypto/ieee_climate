# City planning twin

TerraTrace now opens on a district planning twin: actual OpenStreetMap geometry, live Open-Meteo forecasts, adjustable interventions, a before/after comparison, and portable evidence. The study window is 1.6 × 1.6 km around the selected city coordinate. It is not a complete city inventory or a calibrated urban atmospheric simulation.

## Baseline and timeline

Buildings, roads, parks and water are authentic mapped features. Eight dated map captures provide stable featured-city geometry; arbitrary locations and explicit refresh try VK Maps Overpass, then a bounded OSM map query if that service fails. These providers may be unavailable. The OSM map fallback reports retrieval time explicitly because it supplies no OSM base timestamp. Queries are cached for a day per server isolate, with eight locations retained. Each capture retains provider URL, query, retrieval time, OSM base time and ODbL attribution. Geometry is made from ways; relation multipolygons are omitted. Mapped parks do not establish measured tree canopy. Missing heights use 10 m; mapped floor counts use an assumed 3 m/floor. Height is capped at 150 m and used for display and schematic ground shadows, not energy or cooling. At most 700 larger buildings show extruded height; other mapped footprints remain flat.

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

The app's Research library has nine peer-reviewed sources and a precise implementation/limitation note for each. Core numerical references:

- [Smith et al. (2025), Communications Earth & Environment](https://doi.org/10.1038/s43247-025-02462-3): Boston bulk-albedo sensitivity. [Author-hosted full text](https://sites.bu.edu/efm/files/2025/08/Smith_2025_CEE.pdf).
- [McDonald et al. (2026), Nature Communications](https://doi.org/10.1038/s41467-026-71825-x): canopy sensitivity varies with climate and impervious cover. [Coefficient table](https://www.nature.com/articles/s41467-026-71825-x/tables/1).
- [Borah et al. (2026), Nature Communications](https://doi.org/10.1038/s41467-026-72636-w): humidity-related thermal-comfort caveat; no universal penalty coefficient is added.

The library also credits Calgary canopy targeting, London intervention tradeoffs, and PV demand scheduling research. NASA Eco-Metropolis and SkySense, Chainlink DREx, and ETHGlobal Skywood inspired the workflow. Awards are verified on organizer pages, and do not establish scientific validity. TerraTrace does not copy their code or branding.

## Evidence

A city receipt contains full map geometry, raw forecasts, sources, model version, assumptions, results and reference URLs. The observation identity incorporates weather time, OSM time, scenario digest and geometry digest. Changing a scenario produces a different identity. Verification catches changes to either source data or assumptions. IndexedDB holds larger device-local receipts; the older localStorage format migrates on the next successful save. Export portable JSON copies. Optional Sepolia anchoring remains available through the existing registry.

## Verification

`npm run test:twin` checks all eight authentic captures, clipping, inventory completeness, area allocation, energy balance, zero interventions, height provenance, reflected sunlight units, nighttime invariance, irradiance sensitivity, missing values and scenario tamper detection. The original data/proof/ML checks remain in `npm test`.

## Building inspection and solar survey (planning v2)

The map uses the full content width, with an expandable workspace, zoom, dragging, rotation, isometric/plan views and search across every mapped building. A selected building is highlighted and can be focused. Its inspector shows OSM ID, source link, clipped footprint, height provenance, district allocation and a separate solar survey estimate.

[Kakoulaki et al., Nature Energy, 12 January 2026](https://doi.org/10.1038/s41560-025-01947-x) motivates building-level planning and editable usable-roof fractions. Defaults are 25% for residential/unknown and 40% for tagged non-residential buildings. These European benchmarks are transferred assumptions, not local suitability measurements. Classification uses explicit OSM building/use/amenity tags; names do not establish building use. Unknown use is disclosed. The article's January correction concerns author names.

Survey capacity = clipped footprint × assumed usable fraction × panel density. Tomorrow's estimated yield = capacity × sum of 24 complete tilted-irradiance intervals / 1000 × performance. Missing irradiance suppresses yield rather than substituting zero. All buildings share the location's weather-model irradiance. The queue ranks assumed capacity, with OSM ID as a deterministic tie-breaker. It does not establish structural feasibility or shading suitability. It does not modify district allocations or count additional electricity or carbon. Exported scenario records include the survey assumptions and per-building results.

[Tong et al., Communications Sustainability, 3 October 2026](https://doi.org/10.1038/s44458-026-00157-0) reinforces the separation between resource, deployable area, generation, demand matching and lifecycle effects. TerraTrace does not reuse that study's Hong Kong output, tariffs, payback or carbon totals. Tomorrow's output is not annualized.

## Animated sun and shade

[Zhuang et al., Solar Energy, July 2025](https://doi.org/10.1016/j.solener.2025.113482) motivates fast analytical geometry. The original implementation here is much simpler than its facade/occlusion solver and does not inherit the paper's validation accuracy.

The timeline uses the next forecast day's date, local hour and that weather response's UTC offset. Solar altitude and north-clockwise azimuth follow [NOAA's fractional-year approximation](https://gml.noaa.gov/grad/solcalc/solareqns.PDF), with a leap-year denominator and no atmospheric refraction. Shadow displacement is opposite the sun: length = height / tan(altitude). A convex hull of each mapped footprint and its displaced copy supplies a schematic flat-ground shadow, clipped to the study district. Below 5° altitude shadows are hidden. The visual uses all building heights, including assumed heights and the 150 m cap; extruded display remains limited to 700 larger buildings plus the selection.

Concave footprints can produce over-enveloped shadows. Overlapping envelopes draw as one filled shadow layer; no union area is computed. Terrain, outside-window occluders, roof obstructions, tree shade, roof-plane occlusion, cloud modulation and diffuse radiation are absent. No shade-area total, shaded-PV yield, street-temperature or comfort benefit is claimed. This layer does not alter energy or cooling calculations. Tests cover cardinal solar bearings, local offset handling, missing values, height/tangent displacement and a square's expected shadow area.

New organizer-verified precedents include [Polisense.AI and EcoGuardian.AI, 2025 AI × City Climate Action](https://www.innovate4cities.org/blog/winners-2025-ai-city-climate-action-hackathon-at-climate-week-nyc/), [Ecosphere Prime, Hello Future 2.0 first overall, announced February 2025](https://hedera.com/blog/these-are-the-winners-of-the-hellofuture-hackathon-2-0/), and [Chamomile, September 2026 NYC Climate × Health AI first place](https://www.healthinclimate.ai/hackathons/nyc/2026/winners). They motivate actionable energy prioritization and attributable building-level evidence. Their code, branding and asserted impact are not copied.
