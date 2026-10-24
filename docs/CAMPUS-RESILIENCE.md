# Campus Resilience workspace

Campus Resilience is an **additional TerraTrace feature**, opened from its own main-navigation item. Existing City digital twin, Strategy lab, Evidence lens, Rainwater lab, Research library, Overview, Explore, Proof ledger, and Methodology remain available. Existing city settings, captures, saved strategies, and legacy evidence formats are preserved.

The checked-in study contains 2,867 building components, 4,265 real mapped tree positions, and 9,321 connected-source walking nodes. Original courtyard rings are retained; parent/member footprint duplicates are removed before catchment calculations.

The public-data study covers London Southwark around the London South Bank University campus. It does not imply a university partnership, land ownership, field validation, permission to install projects, or a completed pilot.

## A practical walkthrough

1. Open **Campus Resilience**. Inspect buildings in the large scene. Expand, orbit, pan, zoom, or use the accessible 2D fallback. Collapse the inspector for more space; expanded mobile controls open as a bottom sheet.
2. Select a mapped building and add it to a water proposal. Up to three roofs can be compared.
3. Open **Water reliability**. Enter connected roof fractions, runoff assumptions, tank capacities, and whole-proposal non-potable demand.
4. Compare the accepted observed-year replays and marginal benefit from additional storage. Starting-fill sensitivity belongs to the displayed replay; capacity comparisons start empty.
5. Switch to **Forecast members** to inspect storage spread from real weather-model members. A capture retains its original source time. Refresh explicitly when needed.
6. Compare a flexible, already-planned additional task inside its permitted window. Task volume is unchanged across alternatives; no water is pre-released. Captured intervals are explicitly dated replays; live forecasts offer future intervals only. Times identify the end of the preceding one-hour interval. Suggestions require operator review.
7. Open **Shade & journeys**. Select endpoints, a design date, London departure time, walking speed, and conceptual shade interventions. Compare duration, distance, and modeled direct-sun time.
8. Open **Action planner**. Set water and shade targets. Cost comparisons require user-supplied estimates. Inspect the nondominated options and apply one to the scene.
9. Save a campus proposal with its frozen source snapshots, or export/import it. Campus proposals use a separate IndexedDB key from city strategies.
10. Open **Evidence & AI**. Record survey evidence, seal an Action Passport, independently verify it, inspect the measured-demand benchmark, and export a portable bundle. Ledger integration and optional Sepolia anchoring use the existing infrastructure.

## Sources and public-data preparation

The capture pipeline prepares small static study bundles under `public/campus/`. Source URLs, attribution, licence, retrieval time, data time where supplied, raw responses, and missing coverage accompany the prepared data. Local coordinates are metres east (`x`) and south (`z`) of the study center.

- OpenStreetMap supplies building footprints, mapped heights/floors, public walking geometry, and destination context. Source ODbL terms remain attached.
- Public tree records are incomplete inventories. Missing dimensions are labeled assumptions; absent inventory coverage is not proof that trees are absent.
- LiDAR-derived heights are only claimed when actual source data was obtained and processed. Otherwise the study explicitly reports unavailable LiDAR coverage and uses mapped/floor/assumed heights.
- Environment Agency Mitcham rainfall records retain daily quality and completeness flags. The gauge is approximately 10 km from the study area, not a campus sensor.
- GFS ensemble forecasts use complete `rain + showers` series in millimetres. Snowfall is excluded, and the provider’s preceding-hour convention is retained.

Inspect all captured years, including rejected days, in the rainfall quality calendar. Historic headline replays use the complete `Good`/`Complete` years 2018, 2020, and 2025. Suspect, unchecked, incomplete, missing, negative, or invalid records are not converted to zero. Provider-day labels are preserved; daily values do not reconstruct subdaily rainfall timing.

## Water model

Each roof has an idealized independent tank. Connected catchment is mapped footprint area multiplied by the assumed connected fraction. Total proposal demand is allocated by connected area once, so selecting multiple roofs does not multiply demand.

For each daily or hourly interval:

```text
runoff = rainfall_mm × mapped_area_m² × runoff_coefficient / 1000
inflow = runoff × connected_fraction
bypass = runoff − inflow
overflow = max(0, previous_storage + inflow − capacity)
available_storage = min(capacity, previous_storage + inflow)
reuse = min(available_storage, allocated_eligible_demand)
ending_storage = available_storage − reuse
```

Initial storage plus inflow must equal reuse plus overflow plus final storage within numerical tolerance. Demand coverage is supplied eligible demand divided by total eligible demand, under the declared assumptions.

Observed years are independent replays, each beginning empty for reliability/capacity comparisons. Headline reliability always starts empty. A nonzero starting-fill assumption changes the displayed replay and its sealed outputs separately. They are not a seamless multi-year meter record or future climate projection. Capacity alternatives use consistent inputs and total portfolio capacities of 0, 1, 2.5, 5, 10, 25, 50, and 100 m³, plus the selected custom total.

Forecast-member percentiles describe model spread, not calibrated probabilities. The animated representative run is one actual member, selected near median rainfall; it is not a synthetic sequence assembled from per-hour medians. Missing members are rejected explicitly.

Treatment, first flush, pump and pipe limits, freezing, structural safety, hydraulic drainage routing, and installation feasibility need further engineering. Roof overflow is not flood depth or a certified drainage-peak reduction. Reused water can later enter a sewer.

## Shade and journeys

The graph uses mapped public-access connections. No fabricated connector or unverified indoor shortcut is inserted to make a journey succeed. A disconnected graph produces an unavailable result.

The model compares the shortest eligible path with up to 20 candidate alternatives bounded by a 20% distance detour. It samples geometric shade along the journey at the traveler's modeled arrival time. Overlapping shadows count once.

London wall-clock input is converted using the study time zone, including daylight saving. Building and canopy shadow calculations are independent of WebGL shadow textures. Source coverage and assumptions accompany the metrics.

The result is the least sun among evaluated alternatives, not a proof of a global optimum. Direct-sun minutes are geometric estimates, not street air temperatures, humidity-adjusted heat stress, medical safety, measured footfall, or verified accessibility. Proposed structures and future tree crowns are conceptual and require site surveys. The six sail and two future-tree concepts are derived from exposed samples on the default modeled journey, with source way/edge IDs, a raw-geometry digest, and before/after results in `public/campus/shade-siting.json`. Rerun `scripts/derive-campus-shade-sites.ts` to inspect that selection; it does not establish installation access or consent.

## Portfolio comparisons

The bounded planner enumerates eight capacity choices for each of up to three roofs and subsets of up to two shade structures from at most six candidate sites. Water and shade evaluations are cached before combining outcomes. Background workers keep scenario calculations, bounded comparisons, passport hashing, and independent evidence replay out of the main interaction thread.

The frontier minimizes storage, intervention count, and modeled direct-sun time while maximizing worst-year demand coverage. Supplied costs add a further comparison/budget constraint. Unknown prices remain unknown. The suggested qualifying portfolio prioritizes fewest actions, then least storage; it is not an engineering installation recommendation.

## Measured-demand AI benchmark

The additional AI workbench uses three anonymized education-building water-meter series from **Building Data Genome 2**. It retains the public source context and does not relabel those buildings as London campus measurements. Whole-building water usage is not automatically non-potable demand.

Training is January–September 2016; validation is October–December 2016; the frozen test period is 2017. Daily features use past readings and calendar terms available at prediction time. Eligible dates are common across the learned model and baselines. Missing target days and unavailable lag features are excluded explicitly.

The workbench reports MAE, aggregate error, interval coverage, source coverage, and sample count, comparing with previous-week and historical weekday baselines. A trained model is not called superior unless the measured holdout supports that conclusion. Compact artifacts reproduce Python inference in the browser; Python is only used for offline preparation.

Reference data, derived benchmark artifacts, and their attribution/share-alike terms retain the upstream licence separately from TerraTrace application code. Newer candidate datasets with unresolved units, filtering ambiguity, or inaccessible releases were not substituted merely because they were newer.

## Action Passports and compatibility

Passports preserve source snapshots, assumptions, model versions, outcomes, alternatives where supplied, survey declarations, and attachment digests. They use the existing TerraTrace sorted-key JSON v1 and SHA-256 scheme with a new versioned campus identity. Wallet signatures and testnet anchors are optional and user-initiated.

An independent check distinguishes payload integrity, attachment integrity, signatures, and replayed model calculations. It does not establish provider authenticity, professional review, installation completion, or causal environmental impact. Survey declarations remain human assertions.

Legacy receipts remain supported. Existing ledger transaction handling claims an anchor only after confirmation and matching registry read-back. No funded wallet, automatic chain transaction, token issuance, or carbon-credit certification is added.

## Preview and hosting

Hosted access remains offline. For a temporary loopback preview use the existing `TERRATRACE_LOCAL_PREVIEW=1` procedure documented in the README, and stop the owned preview afterward. No video or hackathon submission is generated by this feature build.

## Reproducible example

`npm run example:campus` prepares a public-data example with 50% worst-year water coverage and 5% direct-sun reduction goals. The bounded set selects one 5 m³ tank and two conceptual shelters: approximately 58.9% modeled worst-year demand coverage and 5.0% less modeled sun at the declared departure. The default 20% sun-reduction goal remains unattainable in the current six-shelter candidate set and is reported honestly.

The output proposal is independently shape-validated; the passport reproduces annual water, forecast-member storage, route shade, and the full planner frontier before export. Outputs are stored under `outputs/deliverables/`, including JSON, source ZIP and a printable HTML brief. All sites remain unsurveyed and prices unknown.

## Simulate all features

The sidebar and campus header both provide **Simulate all features**. Its eleven chapters inspect the district, replay existing runoff and proposed water reuse, compare forecast members and flexible demand timing, animate the existing and sheltered walk, evaluate and apply a bounded portfolio, replay three measured-demand benchmarks, then seal and independently verify an Action Passport.

The chapter clock waits for the current scenario, planner, operating comparison or evidence verifier. Pause freezes the clock and moving scene; Previous, Next, chapter selection and Restart remain available. Reduced-motion preferences start the sequence paused.

The walkthrough uses a temporary empty-start campus scenario, a frozen forecast replay, explicit demand assumptions and unknown installation prices. Finishing or pressing Escape restores the prior proposal settings. It creates no automatic ledger entry, signature or chain transaction. The final verified passport can be exported or kept in Proof ledger through its own buttons.

`npm run test:showcase` checks waiting, pausing, bounded chapter timing, missing forecasts and graceful calculation errors.
