# TerraTrace: the next city features

Updated 8 October 2026. The City strategy lab, Evidence lens and Rainwater lab are implemented around one shared city map. The new map replaces the earlier district view; there is no separate water map. Measured change and shaded routes remain proposals with explicit data requirements. The separate Solar planner is removed; building solar surveys and district energy scenarios remain in the city twin.

Keep the enlarged district as the main workspace. New tools should answer a decision about that place, with the evidence and assumptions visible beside the map.

## Build order

| Order | Addition | Status | Decision it supports | Data readiness |
|---|---|---|---|---|
| 1 | City strategy lab | Built | Which combination of roof treatments and mature canopy should we investigate? | Existing geometry, forecast and model. |
| 2 | Evidence lens | Built | Which parts of this plan need a site survey first? | Existing height provenance and building tags. |
| 3 | Rainwater lab | Built | How do connected roof share and tank capacity change reuse and overflow under this forecast? | One selected mapped roof and 24 hourly rain/showers forecasts; runoff, connectivity and demand are user assumptions. |
| 4 | Measured-change workbench | Proposed | Did the completed intervention produce the observed change we expected? | Requires actual meter or sensor data. |
| 5 | Shaded walking routes | Proposed | How do route length and modeled sun exposure vary by hour? | Requires a connected pedestrian network and better canopy data. |

The first three form one coherent upgrade: compare a district strategy, inspect its evidence, then investigate water collection at a selected roof. Measurement gives the project a practical path from estimates to evidence. Routing follows after its data requirements are met.

## 1. City strategy lab

**Implemented workflow.** Adjust the existing twin and save up to four named alternatives beside an untreated baseline and working draft. Select a reference and displayed plan for numeric differences, and compare all alternatives using one frozen map, weather snapshot and shared reference assumptions. Select a plan to inspect its buildings, then apply its settings to the working twin. An explicit recalculation replaces the comparison snapshot for every alternative together. Saved plans and the selected pair persist on this device; comparison mode starts in the current working plan after reload.

**Visual design.** One large map shows the displayed plan across the entire district, preserving the camera, shared building selection and map scale. The former split divider is removed. Three charts show matched solar energy, reflected sunlight and cooling sensitivity in their own units. A two-axis tradeoff plot compares modeled grid electricity displaced with cooling sensitivity; selecting a point displays its plan. The table preserves exact quantities for all alternatives.

**Useful outputs.** Treatment area, proposed tree count and mature canopy assumptions, estimated PV generation, demand match, surplus, grid demand and transferred cooling sensitivity. No universal winner or combined environmental score. The existing temperature chart retains its labeled sensitivity range; the strategy tradeoff plot shows point estimates, not confidence intervals.

**Implementation.** `lib/planning.ts` reuses `lib/twin.ts` and the existing map renderer. Typed strategies retain their three interventions; one shared snapshot stores all source data and reference assumptions. IndexedDB holds at most four saved plans per city. Comparison JSON and receipts contain every alternative, the selected pair, computed results and the shared source snapshot. Existing presets are starting points for saved alternatives.

**Acceptance.** Identical inputs yield identical results. All alternatives share the same source digest. Cool-roof and solar shares cannot exceed available roof area. Clearing a saved alternative leaves the working plan intact. Missing weather suppresses computed energy results. A receipt preserves the exact displayed comparison. Reduced-motion mode shows immediate transitions and all values.

**Research and project grounding.** Roof/tree tradeoffs follow the decision structure in [Smith et al., 2025](https://www.nature.com/articles/s43247-025-02462-3) and [Brousse et al., 2024](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2024GL109634). Building feasibility follows [Tong et al., 3 October 2026](https://www.nature.com/articles/s44458-026-00157-0). Investment prioritization is a useful design pattern from [Polisense.AI, a 2025 track winner](https://www.innovate4cities.org/blog/winners-2025-ai-city-climate-action-hackathon-at-climate-week-nyc/). These sources do not validate TerraTrace's transferred coefficients or identify the best local plan.

## 2. Evidence lens

**Implemented workflow.** Switch the twin to Evidence, inspect a building, and add it to a locally saved survey checklist. Filter to mapped height, floor-derived height, assumed height or values capped by the current renderer. Search spans every mapped building. The inspector exposes original tags and links to the source feature. Export a checklist with captured geometry, source dates and survey questions.

**Visual design.** A restrained violet-to-teal provenance palette replaces treatment colors while this lens is selected. A selection outline connects the building to its inspector. A stacked breakdown bar highlights the selected category; it reconciles to the inventory rather than displaying an invented quality score. A separate footprint-density grid can summarize mapped geometry, with cells exposing their counts and areas.

**Useful outputs.** Height source counts, summed mapped footprint ratios within 200 m cells, missing building-use and roof-shape tags, and a building survey shortlist. Cell totals clip each footprint at its boundary; overlapping mapped ways can exceed 100%. This identifies where LiDAR, roof inspection or better mapping would improve the plan. It does not establish completeness of the whole city or infer ventilation and heat from density.

**Implementation.** `lib/evidence.ts` derives provenance counts and clipped geometry summaries from current building IDs, tags and source timestamps. Checklist entries retain their captured feature rather than silently adopting later map changes. IndexedDB stores the list per city; JSON export includes source IDs, dates, tags, geometry and survey questions. No survey is marked complete by adding an entry.

**Acceptance.** Category counts sum to the inventory. Capped heights retain their original provenance. Missing tags remain missing. Density cells use area intersections so buildings crossing a cell boundary are not counted in full repeatedly. Omitted relations and capture limits remain visible. Checklist export includes source IDs and the map capture date.

**Research grounding.** [Zhuang and Tan, Energy and Buildings, 1 July 2026](https://www.sciencedirect.com/science/article/pii/S0378778826005645) connects urban morphology and topology to building modeling. This lens adopts geometric inspection; calibrated energy predictions and its learned archetype model would require additional local data. [Chamomile's September 2026 winning project](https://www.healthinclimate.ai/hackathons/nyc/2026/winners) also supports a building-level evidence workflow.

## 3. Rainwater lab

**Implemented workflow.** Select one mapped building in the shared city map and open Rainwater lab. Choose the connected roof share, runoff coefficient, tank capacity and assumed nonpotable demand. Scrub or play tomorrow's 24 one-hour intervals to inspect collection, tank storage, reuse, bypass and overflow. Compare candidate capacities under the same forecast and assumptions, all starting with an empty tank. The comparison is a forecast scenario, not an engineering tank recommendation.

**Visual design.** The selected roof remains anchored to the single city map; a schematic roof-to-tank flow explains the water balance beside it. Forecast wet intervals drive rainfall animation and the displayed tank level. Scrub controls connect the current hour to the storage, reuse and overflow values. A capacity comparison makes additional storage's marginal benefit visible. The tank and pipes are schematic, not mapped assets. A dry forecast shows zero collection; any reuse comes from explicitly assumed starting storage.

**Inputs and calculation.** Open-Meteo hourly `rain` plus `showers` in mm follow the existing preceding-hour boundary convention. Do not add `precipitation`, which already contains those terms and snow. Missing values are unavailable, not zero. Catchment area is the selected building's mapped footprint, clipped to the district, not a surveyed roof or connected gutter area. Connectivity, runoff coefficient, tank capacity and reuse demand are explicit assumptions. The main scenario defaults to empty, with an editable assumed starting fill. Capacity comparisons always start empty; no existing tank or stored water is inferred.

For each one-hour interval, use this declared, simplified spillage-before-reuse balance, in m³:

```text
baseline roof runoff = (rain + showers) × roof area × runoff coefficient / 1000
inflow = baseline roof runoff × connected fraction
bypass = baseline roof runoff − inflow
overflow = max(previous storage + inflow − capacity, 0)
available = min(capacity, previous storage + inflow)
reuse = min(assumed demand, available)
next storage = available − reuse
after roof release = bypass + overflow
```

**Useful outputs.** Estimated roof runoff release, potential nonpotable reuse, remaining storage and overflow under the forecast, with the assumed starting state disclosed. This helps scope a catchment survey and tank pilot. Rainwater treatment, plumbing feasibility and actual demand still require site work. Reuse may later discharge to sewers and is not automatically removed from city drainage.

**Implementation.** A pure water-balance module calculates the 24-hour selected-roof scenario and capacity sweep. The lab reuses the city selection and forecast, with a schematic SVG tank/flow view. Rainfall source dates and interval semantics stay visible. JSON evidence export preserves the selected source ID, captured footprint and tags, rainfall snapshot, explicit assumptions, starting state, hourly results, capacity alternatives, research links and limitations. Forecast snapshots retain their original dates.

**Acceptance.** Initial storage + total inflow equals final storage + total reuse + total overflow within numeric tolerance, including nonzero assumed initial storage. Zero connected area passes all roof runoff through bypass. Storage never exceeds capacity or becomes negative. Zero rainfall, tank saturation, demand larger than available water, and missing intervals each have clear results or unavailable states. Capacity alternatives use identical roofs, rainfall, demand and empty starts. Animation pauses, and hour selection works without animation. Export includes the exact displayed source data, assumptions and results.

**Research grounding.** Junhao Wu, Ling Ma, Dongfang Liang, Limao Zhang and Liz Varga's [“Spatiotemporal synergy of rooftop rainwater harvesting: Dual benefits in flood mitigation and multi-purpose supply under climate change,” Sustainable Cities and Society 149, 107784, 1 October 2026](https://doi.org/10.1016/j.scs.2026.107784) combines a daily Yield-After-Spillage storage balance with separate SWMM drainage and CMIP6 climate models. TerraTrace adapts the storage principle at hourly resolution; it does not reproduce those models or transfer the Wuhan case-study results. Flood depth, inundation and drainage peak reduction require terrain, drainage routing and calibrated hydrology; forecast rain and OSM alone do not support them.

Qiao Yan Soh, Salvador Acha, Nilay Shah and Edward O'Dwyer's [“Simultaneous design and control optimisation of combined rainwater harvesting and flood mitigation systems,” Resources, Conservation and Recycling 222, 108459, August 2025](https://doi.org/10.1016/j.resconrec.2025.108459) studies joint storage design and operational control under historical rainfall. The [open publisher PDF retained by Imperial College London](https://spiral.imperial.ac.uk/server/api/core/bitstreams/206b572f-c6b9-4371-a18f-50d2ca2462f2/content) verifies the full author list and notes online availability from 5 July 2025. The lab adopts fair comparison of capacity and use assumptions; it does not implement the paper's multi-tank optimizer or apply its reported yield gains. A one-day forecast cannot establish annual supply reliability or an optimum installation size. Interval semantics come from the [official Open-Meteo documentation](https://open-meteo.com/en/docs).

**Winning-project design patterns.** [EUSPA confirms Viadrus AI as first overall (€5,000) and BasinPulse as third overall (€1,000) in the 11th CASSINI “Space for Water” Hackathon](https://www.euspa.europa.eu/newsroom-events/news/space-water-turning-tide-satellite-tech), held 24–26 April 2026. The [official participant playbook, page 42](https://www.cassini.eu/hackathons/sites/default/files/2026-02/Participant%20Playbook_11th%20CASSINI%20Hackathon.pdf) scheduled the overall awards for 29 April; EUSPA's confirmation article is dated 16 July 2026. [Viadrus AI's project entry](https://taikai.network/cassinihackathons/hackathons/space-for-water/projects/cmlwprgvd02j7fj8e5y5kcw08/idea) contributes an evidence → inspection → action workflow, reflected in the building survey queue. [BasinPulse's project entry](https://taikai.network/cassinihackathons/hackathons/space-for-water/projects/cmo218nf903po1axacg33hoya/idea) contributes dated baseline and change inspection, reflected in explicit starting conditions and evidence exports. TerraTrace's code and visuals are original. These awards do not validate its water balance or establish achieved impact. The lab performs no leak detection, flood prediction, satellite basin scoring or observed impact attribution.

## 4. Measured-change workbench

**Workflow.** Turn a saved plan into a pilot. Select the buildings and intervention date, record implementation status, and import actual meter or temperature readings. Compare descriptive before/after periods alongside the original modeled scenario, then export a reproducible record.

**Visual design.** An animated timeline connects proposed, surveyed, implemented and measured stages to selected buildings. A vertical intervention marker divides observed timelines; brushing a period zooms both the data chart and coverage strip. Observed readings, modeled forecasts and scenario estimates use different marks and labels. Missing intervals remain gaps. Hover identifies the source, timestamp, unit and instrument.

**Data required.** Real timestamped observations with explicit time zone, units, reading type, sensor or meter identity, and intervention dates. Electricity interval energy and cumulative meter readings must be distinguished; resets and missing samples require explicit handling. Temperature comparisons need comparable locations, hours and weather context.

**Useful outputs.** Measurement coverage, descriptive period totals or averages and departures from the preserved scenario. Raw before/after differences are not attributed to an intervention automatically. Weather normalization or causal analysis is a later method with independent validation and adequate baseline data.

**Implementation.** Local CSV import with a preview/mapping step, explicit unit conversion and timestamp validation. Store source files and normalized records locally, linked to a plan by its digest. Keep hashes, source metadata and the transformation history in an exported receipt. No invented sensor stream or silently generated measurements.

**Acceptance.** Reject ambiguous timestamps and mixed units. Report duplicates, irregular intervals, resets and missing data before comparison. Energy totals use actual covered intervals. Empty projects show a measurement protocol. Reimporting the same file does not duplicate observations. Altered observations fail receipt verification. Existing receipts remain verifiable.

**Research and project grounding.** [Zaerpour et al., 2025](https://www.nature.com/articles/s42949-025-00277-x) illustrates sensor-calibrated urban analysis. Evidence collection patterns also come from [Chamomile](https://www.healthinclimate.ai/hackathons/nyc/2026/winners) and [Ecosphere Prime](https://hedera.com/blog/these-are-the-winners-of-the-hellofuture-hackathon-2-0/). Their awards do not establish the accuracy of this workbench. A valid checksum establishes integrity of saved data, not sensor calibration or causal climate impact.

## 5. Shaded walking routes

**Workflow.** Pick two reachable places and a departure time. Compare the shortest candidate walk with a route trading extra distance for more modeled geometric shade. Scrub time to see the route's exposure change.

**Visual design.** Draw two distinct route ribbons on the large district map. An optional moving marker follows the selected route, with sunlit/shaded segments linked to a distance profile. A ghost marker makes detour distance apparent. Keep numerical length, modeled shade coverage and assumptions visible beside the animation.

**Data gate.** Current road polylines are insufficient for routing. Obtain connected pedestrian nodes/edges, access restrictions, crossings and entrances. Validate building heights and acquire tree positions, crown dimensions and seasonal assumptions before including tree shade. The present illustrative trees cannot become a measured shade layer.

**Implementation.** Build and verify a walking graph; sample the route against the union of modeled shadow geometry so overlaps are not double-counted. Label the spatial and time sampling resolution. Model travel duration explicitly if reporting exposure across a journey; a single-hour spatial shade ratio is not a timed personal exposure estimate.

**Acceptance.** Disconnected endpoints fail clearly. A small known graph verifies shortest-path distance and route tradeoffs. Shadow overlaps count once. Route changes preserve endpoint selection. Missing access/canopy data remain disclosed. No claims of safe travel, accessibility, measured comfort or predicted street temperature.

**Research grounding.** [Zhuang et al., Solar Energy, 2025](https://doi.org/10.1016/j.solener.2025.113482) supports geometric solar-vector methods; [Shirinyan et al., ISPRS, 2025](https://isprs-archives.copernicus.org/articles/XLVIII-G-2025/1339/2025/) addresses district streets and tree shade. Neither validates the current simplified shadow view as an operational route planner.

## Shared visual and evidence rules

- Preserve the enlarged twin, camera and selected building across tool changes.
- Use motion to reveal a changed quantity, route or process. Include pause/scrub controls and reduced-motion behavior; no ambient particles that imply nonexistent data.
- Keep forecasts, mapped geometry, user assumptions and actual observations distinguishable. Missing data never becomes a fabricated zero.
- Use separate scales for electricity, reflected sunlight, cooling sensitivity and water. Avoid arbitrary combined scores and unsupported monetary savings.
- Freeze the displayed source snapshot for comparisons, retain original capture dates, and include all assumptions in exports and receipts.
- Build original interactions. Credit research methods and winning-project design patterns without copying branding, code or unverified impact claims.
