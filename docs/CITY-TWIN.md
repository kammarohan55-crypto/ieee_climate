# City planning twin

TerraTrace opens on one large district planning map: actual OpenStreetMap geometry, dated Open-Meteo forecasts, adjustable interventions and portable evidence. Strategy comparisons share one frozen source snapshot; the whole map shows the Displayed plan. A separate rainwater lab uses a roof selected on that map. The study window is 1.6 × 1.6 km around the selected city coordinate. It is not a complete city inventory or a calibrated urban atmospheric simulation.

The hosted website stays offline. Temporary local preview requires `TERRATRACE_LOCAL_PREVIEW=1` and a `localhost` or `127.0.0.1` URL. Leave the flag unset in production; see [README](../README.md) for PowerShell instructions.

## Baseline and timeline

Buildings, roads, parks and water are authentic mapped features. Eight dated map captures provide stable featured-city geometry; arbitrary locations and explicit refresh try VK Maps Overpass, then a bounded OSM map query if that service fails. These providers may be unavailable. The OSM map fallback reports retrieval time explicitly because it supplies no OSM base timestamp. Queries are cached for a day per server isolate, with eight locations retained. Each capture retains provider URL, query, retrieval time, OSM base time and ODbL attribution. Geometry is made from ways; relation multipolygons are omitted. Mapped parks do not establish measured tree canopy. Missing heights use 10 m; mapped floor counts use an assumed 3 m/floor. Height is capped at 150 m and used for display and schematic ground shadows, not energy or cooling. At most 700 larger buildings show extruded height; other mapped footprints remain flat.

The weather baseline is tomorrow's forecast. Intervention results are counterfactuals under that same weather. Trees represent mature, non-overlapping canopy years after planting. No city has changed because a control moved. Observe actual results with meters and locally matched environmental measurements later.

Weather and air sources can fail independently: usable live weather remains available when air fails, without mixing new weather with old air. When weather is unavailable, the browser tries the authentic eight-city `climate-reference-v2.json` capture, collected **12 October 2026, 17:09:48.945–17:09:50.565 UTC**, then the unchanged original capture if v2 is unavailable. Exact provider URLs, raw responses and actual retrieval times are preserved. Captures remain explicitly dated; the older capture's missing rain does not become zero rainfall.

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

For district energy and cooling, incomplete/truncated geometry or missing required forecast values disable outcome totals, export and receipt sealing. The source record marks `complete`; unavailable computed intermediates must not be interpreted as true zero results. The selected-roof water model separately requires a positive mapped building footprint and complete valid liquid-rain intervals.

## Selected-roof rainwater balance

The lab models one hypothetical tank connected to one selected building's clipped footprint. The footprint approximates collection area; it does not identify a usable roof, installed tank or actual plumbing. Defaults are 100% connected roof, runoff coefficient 0.85, 10 m³ tank, zero starting storage and 1 m³/day uniform non-potable demand. Every setting is an assumption and can be edited.

Open-Meteo `rain` and `showers` are preceding-hour liquid totals. Their sum supplies rain in **mm**; `precipitation` is not added because it includes these components and snow. The request explicitly sets `precipitation_unit=mm`, and the model requires both response unit fields to be `mm`. Tomorrow's complete local day uses 24 consecutive, unique interval endpoints from 01:00 through the following 00:00, displayed as interval starts 00:00–23:00 in the weather location's time zone. Missing, negative, non-finite, duplicated, out-of-order or wrong-unit values disable water results, export and sealing.

For each hour, volumes are in m³. Let `A` be clipped roof m², `r` liquid rain mm, `c` the assumed runoff coefficient, `f` the connected fraction, `K` tank capacity, `S` previous storage and `d` assumed daily demand divided by 24:

- Roof runoff `Q = r × A / 1000 × c`; connected inflow `I = Q × f`; bypass `B = Q − I`.
- Spillage before reuse: overflow `O = max(S + I − K, 0)`; available water `V = min(K, S + I)`.
- Reuse `Y = min(d, V)`; ending storage `S' = V − Y`; unserved demand `d − Y`.
- Roof release with the tank `B + O`; the no-tank baseline releases `Q`. These are volumes, not drainage peaks or flood depths.

The hourly conservation equation is `S + I = S' + Y + O`; the day residual is `initial storage + total inflow − total overflow − total reuse − ending storage`. Stored water is a state, not summed hourly volume. Reuse can include assumed starting water, so it is not all newly harvested rain. A dry day explicitly identifies that distinction.

Play or scrub the 24 hours to inspect animated rain, collection, filling, reuse and overflow. The dual-axis chart keeps forecast rain in mm and modeled storage in m³; an expandable table exposes every balance. The main scenario permits nonzero starting storage. The capacity sweep always starts empty under the same roof, rain, runoff, connection and demand inputs. Fixed candidates are **0, 1, 2.5, 5, 10, 25, 50 and 100 m³**, with a distinct selected custom capacity retained alongside them. Selecting a candidate resets the main starting fill to zero. Candidate reuse, overflow and ending storage describe one forecast day; they do not select an annual optimum or recommend an engineering tank size.

The water survey queue lists the four largest mapped footprints. Size is survey priority, not suitability. Four manual checks cover safe collection area/material, gutters/first flush/pipes, non-potable demand/treatment, and tank location/structure/overflow destination. Checks apply to the selected building and forecast context and travel with the export; they reset when that context changes. They are separate from the durable Evidence-lens survey list.

The model omits first-flush losses, treatment, pipe capacity, structural feasibility, evaporation and storm timing within the hour. One weather-model point represents the district. It makes no claim about potable-water safety, annual supply reliability, financial optimum, downstream flooding or drainage peak reduction. A pilot needs measured rain and demand, roof/plumbing/tank surveys, longer records and any necessary drainage model.

## Research used

The Research library has **11 peer-reviewed papers from 2024–2026** and **10 organizer-verified winning project examples**, reviewed on 8 October 2026. Each has an implementation and limitation note. Core numerical references:

- [Smith et al. (2025), Communications Earth & Environment](https://doi.org/10.1038/s43247-025-02462-3): Boston bulk-albedo sensitivity. [Author-hosted full text](https://sites.bu.edu/efm/files/2025/08/Smith_2025_CEE.pdf).
- [McDonald et al. (2026), Nature Communications](https://doi.org/10.1038/s41467-026-71825-x): canopy sensitivity varies with climate and impervious cover. [Coefficient table](https://www.nature.com/articles/s41467-026-71825-x/tables/1).
- [Borah et al. (2026), Nature Communications](https://doi.org/10.1038/s41467-026-72636-w): humidity-related thermal-comfort caveat; no universal penalty coefficient is added.
- [Wu et al., Sustainable Cities and Society, 1 October 2026](https://doi.org/10.1016/j.scs.2026.107784): daily rainwater storage bookkeeping combined with separate drainage and climate models. TerraTrace declares an hourly spillage-before-reuse balance, not that study's daily sizing, SWMM model or climate projections.
- [Soh et al., Resources, Conservation and Recycling, August 2025](https://doi.org/10.1016/j.resconrec.2025.108459): joint rainwater storage design and operating policy. The lab's fair one-day capacity sweep does not implement the paper's control optimizer or transfer its performance gains.

The library also credits building-level PV, analytical solar geometry, Calgary canopy targeting, London intervention tradeoffs and PV demand scheduling. Winning examples span NASA Space Apps, Chainlink, ETHGlobal, city climate AI, Hedera and CASSINI. [Viadrus AI and BasinPulse, April 2026 CASSINI winners](https://www.euspa.europa.eu/newsroom-events/news/space-water-turning-tide-satellite-tech), inform the source → survey → action workflow. Awards do not establish scientific validity. TerraTrace does not copy their code or branding.

## Evidence

A city receipt contains full map geometry, raw forecasts, sources, model version, assumptions, results and reference URLs. The observation identity incorporates weather time, OSM time, scenario digest and geometry digest. Changing a scenario produces a different identity. Verification catches changes to either source data or assumptions. IndexedDB holds larger device-local receipts; the older localStorage format migrates on the next successful save. Export portable JSON copies. Optional Sepolia anchoring remains available through the existing registry.

Water exports use schema `terratrace-roof-water-v1` and model `roof-tank-hourly-v1`. They preserve the raw weather response and URL, retrieval status/date, selected roof geometry and map provenance, settings, all hourly balances, empty-start capacity comparisons, manual checklist, references and limitations. Sealed water receipts embed a `roof-water-scenario` v1 identity with source and scenario digests, and use the same independent verifier and local ledger. A valid hash establishes payload integrity, not a completed survey or measured environmental benefit.

## Verification

`npm run test:twin` checks all eight authentic captures, clipping, inventory completeness, area allocation, energy balance, zero interventions, height provenance, reflected sunlight units, nighttime invariance, irradiance sensitivity, missing values and scenario tamper detection. The original data/proof/ML checks remain in `npm test`.

`npm run test:water` checks exact preceding-hour day boundaries, mm-to-m³ conversion, liquid-only rain/showers, zero connectivity/capacity, spillage-before-reuse timing, initial-water disclosure, hourly/day conservation, invalid inputs and a stable empty-start capacity sweep with custom sizes. Its synthetic inputs are confined to the test; the original capture remains unchanged and correctly unavailable for rainwater outcomes.

## Saved strategies and evidence inspection

The City strategy lab saves up to four alternatives per city in IndexedDB on this device. Each alternative stores reflective-roof share, solar-roof share and proposed mature-tree count. The first save freezes a complete forecast, mapped district and shared reference assumptions; daily demand, albedo, equipment factors and cooling references are identical for all alternatives. The untouched baseline sets the three interventions to zero. The working draft uses its current interventions with the same shared references while compared. Data refresh does not silently change a comparison. Recalculate all replaces the shared snapshot for every alternative together, while earlier receipts remain unchanged.

Select a Reference plan and a Displayed plan for numerical comparison. The entire map shows the Displayed plan, with roof-color transitions and new-tree animation retaining the camera and selected building. The main outcomes, building inspector and hourly chart also inspect the Displayed plan. There is no split map or divider. The tradeoff plot and exact table compare every alternative. Electricity matched to assumed demand, reflected sunlight and transferred cooling sensitivity have separate scales and units; no combined environmental score or locally validated optimum is inferred. Apply to draft restores the chosen interventions and reference assumptions to the current-data workspace. JSON export and comparison receipts preserve the shared sources, selected pair, assumptions and results. Saved plans are local; export them for portability.

Evidence mode colors the mapped height tag, mapped floors, assumed 10 m and capped 150 m categories. Counts reconcile to the full mapped building inventory, and the selected inspector exposes original height/floor/use/roof tags. Positive floor counts are used when a height tag is absent or nonpositive. The separate 8 × 8 footprint grid clips each building at cell boundaries, then sums mapped footprint area over cell area. Overlapping ways can exceed 100%; this is not union coverage, measured land occupancy, heat or ventilation. Empty cells do not establish empty land, and omitted relations and capture limits still apply.

Survey-list entries retain the selected building's captured geometry, tags, map source, source-time kind and date. A later map refresh does not rewrite that saved evidence. Entries outside the current inventory remain exportable, with focus unavailable. Checklist export includes OSM IDs, source links and questions about height, roof feasibility, shade, existing PV, permits and meter baselines. Adding an entry records an intended survey rather than a completed survey. These lists are also saved only on this device.

## Building inspection and solar survey details

The map uses the full content width, with an expandable workspace, zoom, dragging, rotation, isometric/plan views and search across every mapped building. A selected building is highlighted and can be focused. Its inspector shows OSM ID, source link, clipped footprint, height provenance, district allocation and a separate solar survey estimate.

[Kakoulaki et al., Nature Energy, 12 January 2026](https://doi.org/10.1038/s41560-025-01947-x) motivates building-level planning and editable usable-roof fractions. Defaults are 25% for residential/unknown and 40% for tagged non-residential buildings. These European benchmarks are transferred assumptions, not local suitability measurements. Classification uses explicit OSM building/use/amenity tags; names do not establish building use. Unknown use is disclosed. The article's January correction concerns author names.

Survey capacity = clipped footprint × assumed usable fraction × panel density. Tomorrow's estimated yield = capacity × sum of 24 complete tilted-irradiance intervals / 1000 × performance. Missing irradiance suppresses yield rather than substituting zero. All buildings share the location's weather-model irradiance. The queue ranks assumed capacity, with OSM ID as a deterministic tie-breaker. It does not establish structural feasibility or shading suitability. It does not modify district allocations or count additional electricity or carbon. Exported scenario records include the survey assumptions and per-building results.

[Tong et al., Communications Sustainability, 3 October 2026](https://doi.org/10.1038/s44458-026-00157-0) reinforces the separation between resource, deployable area, generation, demand matching and lifecycle effects. TerraTrace does not reuse that study's Hong Kong output, tariffs, payback or carbon totals. Tomorrow's output is not annualized.

## Animated sun and shade

[Zhuang et al., Solar Energy, July 2025](https://doi.org/10.1016/j.solener.2025.113482) motivates fast analytical geometry. The original implementation here is much simpler than its facade/occlusion solver and does not inherit the paper's validation accuracy.

The timeline uses the next forecast day's date, local hour and that weather response's UTC offset. Solar altitude and north-clockwise azimuth follow [NOAA's fractional-year approximation](https://gml.noaa.gov/grad/solcalc/solareqns.PDF), with a leap-year denominator and no atmospheric refraction. Shadow displacement is opposite the sun: length = height / tan(altitude). A convex hull of each mapped footprint and its displaced copy supplies a schematic flat-ground shadow, clipped to the study district. Below 5° altitude shadows are hidden. The visual uses all building heights, including assumed heights and the 150 m cap; extruded display remains limited to 700 larger buildings plus the selection.

Concave footprints can produce over-enveloped shadows. Overlapping envelopes draw as one filled shadow layer; no union area is computed. Terrain, outside-window occluders, roof obstructions, tree shade, roof-plane occlusion, cloud modulation and diffuse radiation are absent. No shade-area total, shaded-PV yield, street-temperature or comfort benefit is claimed. This layer does not alter energy or cooling calculations. Tests cover cardinal solar bearings, local offset handling, missing values, height/tangent displacement and a square's expected shadow area.

New organizer-verified precedents include [Polisense.AI and EcoGuardian.AI, 2025 AI × City Climate Action](https://www.innovate4cities.org/blog/winners-2025-ai-city-climate-action-hackathon-at-climate-week-nyc/), [Ecosphere Prime, Hello Future 2.0 first overall, announced February 2025](https://hedera.com/blog/these-are-the-winners-of-the-hellofuture-hackathon-2-0/), and [Chamomile, September 2026 NYC Climate × Health AI first place](https://www.healthinclimate.ai/hackathons/nyc/2026/winners). They motivate actionable energy prioritization and attributable building-level evidence. Their code, branding and asserted impact are not copied.
