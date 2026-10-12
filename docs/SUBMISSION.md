# TerraTrace

Project description draft for IEEE ClimateChain 2026. This project has not been submitted. The source code is available at [https://github.com/kammarohan55-crypto/ieee_climate](https://github.com/kammarohan55-crypto/ieee_climate). No video is being created at the user's request.

**Tagline:** Inspect your district. Compare a climate plan. Keep the evidence.

**Primary track:** Climate Data & Environmental Monitoring.

**Supporting track:** Renewable Energy & Energy Trading (district energy planning).

**Working prototype:** Hosted website remains offline. Temporary local access is restricted to loopback with the explicit `TERRATRACE_LOCAL_PREVIEW=1` flag; leave it unset in production.

**Code repository:** [https://github.com/kammarohan55-crypto/ieee_climate](https://github.com/kammarohan55-crypto/ieee_climate).

## The problem

City sustainability teams need to connect mapped buildings, weather and rain forecasts, intervention assumptions and evidence. A single city-wide total cannot show which roofs need a survey, what assumptions drive an estimate, or how a proposed change compares with the same baseline.

TerraTrace brings that workflow into a large, inspectable district twin. It helps teams investigate a plan and preserve the sources behind it.

## What works

The project opens on a real OpenStreetMap district with selectable buildings, an expanded workspace, pan, zoom, rotation and plan/isometric views. Eight featured cities have authentic captured geometry. Building inspection exposes footprint area, mapped tags and height provenance. Source dates and map coverage limits stay visible.

Editable reflective-roof, rooftop-PV and mature-canopy scenarios compare energy and transferred cooling sensitivities with the same weather baseline. Roof treatments share limited mapped area. Estimated PV is matched to an assumed hourly demand profile, with surplus separate. Cooling sensitivities are research-based reference assumptions, not locally calibrated predictions.

A ranked building roof survey estimates capacity under editable usable-area benchmarks. An animated sun/shade timeline illustrates flat-ground geometric shadows from footprints and heights. This shade display does not adjust the energy or cooling model and does not establish actual thermal comfort.

The City strategy lab saves up to four alternatives per city and exposes tradeoffs in separate unit scales and an exact table. A Reference plan and a Displayed plan are compared numerically; one large map, its inspector and hourly results show the Displayed plan. Every alternative uses one frozen map, forecast and reference-assumption snapshot; an explicit recalculation refreshes all alternatives together. Comparison exports and receipts preserve the entire decision.

The Evidence lens colors buildings by mapped, floor-derived, assumed or capped height. It exposes original tags, counts provenance categories and clips mapped footprints into 200 m density cells. A locally saved survey checklist preserves each building's captured geometry and source date for export. Density is a mapped-geometry summary, not a heat or ventilation prediction; checklist entries do not claim a completed survey.

The separate Rainwater lab follows one selected mapped roof through 24 complete hours of real forecast rain and showers, explicitly in mm. An animated roof-to-tank diagram and chart expose connected runoff, assumed storage, non-potable reuse, overflow and roof release versus a no-tank baseline. Tank capacity, starting fill, connected roof share, runoff coefficient and uniform demand are editable assumptions. The capacity sweep uses eight fixed options—0, 1, 2.5, 5, 10, 25, 50 and 100 m³—plus a distinct custom capacity, all starting empty under identical inputs. Selecting a candidate also starts the main scenario empty. A four-roof survey queue and manual collection/plumbing/treatment/location checklist support a site visit. Exports and receipts preserve sources, settings, hourly balances, candidate results and checks.

This hourly storage model spills before reuse. It excludes snow, first-flush losses, treatment, pipe capacity, structural feasibility and subhour storm timing. Reuse can include starting storage. It makes no flood-depth, drainage-peak, drinking-water safety, annual reliability or optimal-sizing claim. Missing or invalid rain data disables results rather than becoming zero rainfall.

The Overview and Explore pages show real Open-Meteo weather and CAMS-backed air-quality forecasts, source times and hourly charts. Usable weather survives an air-provider failure without silently mixing old air with new weather. An authentic eight-city reference capture from **12 October 2026, 17:09:48.945–17:09:50.565 UTC** supplies explicitly dated fallback data, including rain and showers. The unchanged older capture is a second fallback; its missing rain remains unavailable. A 64-tree seeded Isolation Forest highlights unusual combinations of temperature, humidity and PM₂.₅ within up to 72 forecast hours. It is exploratory, with no independently validated predictive accuracy.

The Research library credits **11 peer-reviewed papers from 2024–2026** and **10 organizer-verified winning projects**, reviewed on 8 October 2026. Sources include rainwater design/operation research from August 2025 and 1 October 2026, and rooftop deployment research published 3 October 2026. Each explains what informed the design and what remains unvalidated. The strategy lab, Evidence lens and rainwater lab are implemented; measured-change and shaded-route tools remain proposed.

The separate task-scheduling Solar planner has been removed. Rooftop energy remains part of the district twin.

## Evidence and blockchain

City receipts preserve the raw forecast, mapped geometry, assumptions, results and research references. Water receipts preserve the selected catchment, complete forecast response, source dates, hourly storage balance, empty-start comparisons and manual checklist. Generic environmental receipts preserve raw weather/air responses and source provenance. Versioned sorted-key JSON and browser SHA-256 support independent integrity verification. Existing exported receipts remain verifiable.

The local ledger uses IndexedDB. A Solidity registry accepts writes only from its publisher and rejects duplicate declared observation IDs and exact digests. Optional Sepolia anchoring uses an actual wallet and deployed registry; the interface verifies confirmation and on-chain read-back. No public-chain deployment or confirmed anchor is claimed.

A matching hash proves integrity of the saved payload. It does not validate a forecast, certify environmental impact, create carbon credits, or prevent claims across unrelated registries.

## Track alignment and practical impact

For **Climate Data & Environmental Monitoring**, the twin and rainwater lab connect dated environmental sources and mapped geometry with inspectable scenarios and portable evidence. The workflow supports district roof surveys, campus energy and rainwater planning, and measurement design.

For **Renewable Energy & Energy Trading**, the district model investigates rooftop deployment, forecast generation, assumed demand match and surplus. It does not implement an electricity trading market.

The prototype reports modeled opportunities rather than observed savings. A practical pilot would survey candidate roofs and planting sites, implement a feasible intervention, and compare meter or sensor observations under comparable conditions. Annual energy, payback, pollution reductions and causal climate benefits require additional data and validation.

## Implementation

React 19, TypeScript, Vinext/Vite, Recharts, custom Canvas globe and SVG district/water visualizations, Open-Meteo weather/CAMS air-quality APIs, OpenStreetMap geometry, Web Crypto, IndexedDB, ethers and Solidity. The app exposes units, source times, explicit assumptions, missing-data states and reduced-motion controls. `npm run test:water` checks interval boundaries, rain units, spill/reuse timing, conservation, invalid inputs and fair capacity comparisons, alongside existing data, twin and local-contract checks.

## Deferred handoff

Source code is published to the linked GitHub repository. A video and hackathon submission remain outside the current requested work. Hosted access stays offline; the explicit preview flag is only for temporary local work. Any real testnet anchor requires actual configuration. Previously captured organizer timing notes are retained below for a later submission decision; they are not a current eligibility or deadline verification.

## Submission timing conflict

The [official organizer update](https://ieee-climatechain-hack.devpost.com/updates/46814-climatechain-hackathon-submissions-open-tomorrow-get-ready-to-submit) says submissions opened on **October 5, 2026**. The [rules page](https://ieee-climatechain-hack.devpost.com/rules) still says not to submit before **8 AM PT on October 25**. The [overview](https://ieee-climatechain-hack.devpost.com/) lists a deadline of **October 25, 2026 at 14:00 UTC**, which is **7:30 PM IST**.

On that date, Pacific Time is PDT, UTC−7, so 8 AM PT is **15:00 UTC / 8:30 PM IST**—one hour after the listed deadline. [NIST's daylight saving guidance](https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst) confirms that daylight saving continues until November 1, 2026. Preserve this discrepancy and obtain organizer confirmation before submission; do not infer a new deadline.

The overview's participation summary also says students only, while the rules lists additional categories. Check eligibility directly before submitting.

