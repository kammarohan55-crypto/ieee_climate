# TerraTrace: the next city features

Prepared 8 October 2026. These are proposed additions, not capabilities already implemented. The separate Solar planner is removed; building solar surveys and district energy scenarios remain in the city twin.

Keep the enlarged district as the main workspace. New tools should answer a decision about that place, with the evidence and assumptions visible beside the map.

## Build order

| Order | Addition | Decision it supports | Data readiness |
|---|---|---|---|
| 1 | City strategy lab | Which combination of roof treatments and mature canopy should we investigate? | Existing geometry, forecast and model suffice. |
| 2 | Evidence lens | Which parts of this plan need a site survey first? | Existing height provenance and building tags suffice. |
| 3 | Rainwater capture twin | What tank size and connected roof share are useful under this forecast? | Add hourly rain/showers; tank and demand inputs require user assumptions. |
| 4 | Measured-change workbench | Did the completed intervention produce the observed change we expected? | Requires actual meter or sensor data. |
| 5 | Shaded walking routes | How do route length and modeled sun exposure vary by hour? | Requires a connected pedestrian network and better canopy data. |

The first two form one coherent upgrade. Water adds a distinct climate problem with a strong visual model. Measurement gives the project a practical path from estimates to evidence. Routing follows after its data requirements are met.

## 1. City strategy lab

**Workflow.** Adjust the existing twin, save a named alternative, and pin two to four plans beside the unchanged baseline. Compare them using one frozen map and weather snapshot. Select a plan to inspect its buildings, then apply its settings to the working twin. Refreshing data offers an explicit recalculation of the whole comparison.

**Visual design.** Keep one large map above a compact comparison rail. Use a draggable before/after divider for the two selected plans. Crossfade roof treatments and grow proposed canopy when switching plans; preserve the camera, selected building and map scale. Three synchronized small charts show matched solar energy, reflected sunlight and cooling sensitivity in their own units. A two-axis tradeoff plot compares modeled grid electricity displaced with cooling sensitivity; selecting a point highlights its plan. Include a table so exact values remain accessible.

**Useful outputs.** Treatment area, proposed tree count and mature canopy assumptions, estimated PV generation, demand match, surplus, grid demand and transferred cooling sensitivity. No universal winner or combined environmental score. An optional sensitivity band is labeled as the range obtained from specified assumptions, never a statistical confidence interval.

**Implementation.** Reuse `lib/twin.ts` and the existing map renderer. Add typed saved strategies with names, settings, snapshot digests and results; store them locally through the existing storage layer. Export and seal the complete comparison, including each alternative and the shared source snapshot. Existing presets become starting points rather than substitutes for saved alternatives.

**Acceptance.** Identical inputs yield identical results. All alternatives share the same source digest. Cool-roof and solar shares cannot exceed available roof area. Clearing a saved alternative leaves the working plan intact. Missing weather suppresses computed energy results. A receipt preserves the exact displayed comparison. Reduced-motion mode shows immediate transitions and all values.

**Research and project grounding.** Roof/tree tradeoffs follow the decision structure in [Smith et al., 2025](https://www.nature.com/articles/s43247-025-02462-3) and [Brousse et al., 2024](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2024GL109634). Building feasibility follows [Tong et al., 3 October 2026](https://www.nature.com/articles/s44458-026-00157-0). Investment prioritization is a useful design pattern from [Polisense.AI, a 2025 track winner](https://www.innovate4cities.org/blog/winners-2025-ai-city-climate-action-hackathon-at-climate-week-nyc/). These sources do not validate TerraTrace's transferred coefficients or identify the best local plan.

## 2. Evidence lens

**Workflow.** Switch the twin to height provenance, inspect a building, and add it to a survey checklist. Filter to mapped height, floor-derived height, assumed height or values capped by the current renderer. The inspector exposes original tags and links to the source feature.

**Visual design.** A restrained violet-to-teal provenance palette replaces treatment colors while this lens is selected. A selection outline connects the building to its inspector. A stacked breakdown bar highlights the selected category; it reconciles to the inventory rather than displaying an invented quality score. A separate footprint-density grid can summarize mapped geometry, with cells exposing their counts and areas.

**Useful outputs.** Height source counts, footprint coverage within the captured district, missing building-use tags and a building survey shortlist. This identifies where LiDAR, roof inspection or better mapping would most improve the plan. Coverage describes the bounded mapped sample, not completeness of the whole city.

**Implementation.** Reuse current height provenance, building IDs, footprint areas and source timestamps. Add derived geometry summaries and a locally saved checklist. Do not infer ventilation, energy demand, measured canopy or street temperature from density alone.

**Acceptance.** Category counts sum to the inventory. Capped heights retain their original provenance. Missing tags remain missing. Density cells use area intersections so buildings crossing a cell boundary are not counted in full repeatedly. Omitted relations and capture limits remain visible. Checklist export includes source IDs and the map capture date.

**Research grounding.** [Zhuang and Tan, Energy and Buildings, 1 July 2026](https://www.sciencedirect.com/science/article/pii/S0378778826005645) connects urban morphology and topology to building modeling. This lens adopts geometric inspection; calibrated energy predictions and its learned archetype model would require additional local data. [Chamomile's September 2026 winning project](https://www.healthinclimate.ai/hackathons/nyc/2026/winners) also supports a building-level evidence workflow.

## 3. Rainwater capture twin

**Workflow.** Select mapped roofs, choose the connected share, enter tank capacity and initial fill, then specify assumed nonpotable demand. Scrub tomorrow's hours to compare roof runoff release with and without capture. Try a larger tank and see when additional capacity stops helping under the displayed rainfall.

**Visual design.** Animate rainfall only during forecast wet intervals. Selected roofs connect to schematic downpipes and a tank with a rising water surface. Flow widths and particle counts reflect the calculated interval volumes. The map stays geographically accurate; tank placement and pipes are labeled schematic. A stacked hourly balance shows bypass, stored water, reuse and overflow, with baseline/after roof-release bars below. A dry forecast displays a calm, empty-rain state.

**Inputs and calculation.** Fetch Open-Meteo hourly `rain` plus `showers` in mm and use the existing preceding-hour boundary convention. Do not add `precipitation`, which already contains those terms and snow. Missing values are unavailable, not zero. Roof area comes from mapped footprints; connectivity, runoff coefficient, tank capacity, initial storage and reuse demand are explicit assumptions.

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

**Useful outputs.** Estimated roof runoff release, potential nonpotable reuse, remaining storage and overflow under the forecast. Initial stored water is separately disclosed. This helps scope a catchment survey and tank pilot. Rainwater treatment, plumbing feasibility and actual demand still require site work. Reuse may later discharge to sewers and is not automatically removed from city drainage.

**Implementation.** Add the two weather variables, preserve units and interval semantics, and create a pure water-balance module plus a schematic SVG tank/flow overlay. Generate a new authentic reference capture when rainfall fields are added; do not alter dates in existing captures. Freeze and export rainfall, selected roofs, settings and results with the scenario.

**Acceptance.** Initial storage + total inflow equals final storage + total reuse + total overflow within numeric tolerance. Zero connected area passes all roof runoff through bypass. Storage never exceeds capacity or becomes negative. Zero rainfall, a full tank, demand larger than available water, and missing intervals each have clear results or unavailable states. Animation pauses, and hour selection works without animation.

**Research grounding.** [Wu et al., Sustainable Cities and Society, 1 October 2026](https://www.sciencedirect.com/science/article/pii/S2210670726006682) combines building storage balance with a separate drainage model. This proposed feature adapts the storage principle at hourly resolution. Flood depth, inundation and drainage peak reduction require terrain, drainage routing and calibrated hydrology; forecast rain and OSM alone do not support them. Interval semantics come from the [official Open-Meteo documentation](https://open-meteo.com/en/docs).

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
