# TerraTrace

Project description draft for IEEE ClimateChain 2026. This project has not been submitted. GitHub is deferred and no video is being created at the user's request.

**Tagline:** Inspect your district. Compare a climate plan. Keep the evidence.

**Primary track:** Climate Data & Environmental Monitoring.

**Supporting track:** Renewable Energy & Energy Trading (district energy planning).

**Working prototype:** Private project preview; public access is not configured.

**Code repository:** Deferred until the user supplies the intended GitHub repository.

## The problem

City sustainability teams need to connect mapped buildings, weather forecasts, intervention assumptions and evidence. A single city-wide total cannot show which roofs need a survey, what assumptions drive an estimate, or how a proposed change compares with the same baseline.

TerraTrace brings that workflow into a large, inspectable district twin. It helps teams investigate a plan and preserve the sources behind it.

## What works

The project opens on a real OpenStreetMap district with selectable buildings, an expanded workspace, pan, zoom, rotation and plan/isometric views. Eight featured cities have authentic captured geometry. Building inspection exposes footprint area, mapped tags and height provenance. Source dates and map coverage limits stay visible.

Editable reflective-roof, rooftop-PV and mature-canopy scenarios compare energy and transferred cooling sensitivities with the same weather baseline. Roof treatments share limited mapped area. Estimated PV is matched to an assumed hourly demand profile, with surplus separate. Cooling sensitivities are research-based reference assumptions, not locally calibrated predictions.

A ranked building roof survey estimates capacity under editable usable-area benchmarks. An animated sun/shade timeline illustrates flat-ground geometric shadows from footprints and heights. This shade display does not adjust the energy or cooling model and does not establish actual thermal comfort.

The Overview and Explore pages show real Open-Meteo weather and CAMS-backed air-quality forecasts, source times and hourly charts. A 64-tree seeded Isolation Forest highlights unusual combinations of temperature, humidity and PM₂.₅ within up to 72 forecast hours. It is exploratory, with no independently validated predictive accuracy.

The Research library credits nine peer-reviewed papers from 2024–2026 and eight organizer-verified winning projects. Each source explains what informed the design and what remains unvalidated. A documented roadmap proposes additional tools; those proposals are not presented as implemented capabilities.

The separate task-scheduling Solar planner has been removed. Rooftop energy remains part of the district twin.

## Evidence and blockchain

City receipts preserve the raw forecast, mapped geometry, assumptions, results and research references. Generic environmental receipts preserve raw weather/air responses and source provenance without an unrelated energy scenario. Versioned sorted-key JSON and browser SHA-256 support independent integrity verification. Existing exported receipts remain verifiable.

The local ledger uses IndexedDB. A Solidity registry accepts writes only from its publisher and rejects duplicate declared observation IDs and exact digests. Optional Sepolia anchoring uses an actual wallet and deployed registry; the interface verifies confirmation and on-chain read-back. No public-chain deployment or confirmed anchor is claimed.

A matching hash proves integrity of the saved payload. It does not validate a forecast, certify environmental impact, create carbon credits, or prevent claims across unrelated registries.

## Track alignment and practical impact

For **Climate Data & Environmental Monitoring**, the twin connects dated environmental sources and mapped geometry with inspectable scenarios and portable evidence. The workflow supports district surveys, campus planning and measurement design.

For **Renewable Energy & Energy Trading**, the district model investigates rooftop deployment, forecast generation, assumed demand match and surplus. It does not implement an electricity trading market.

The prototype reports modeled opportunities rather than observed savings. A practical pilot would survey candidate roofs and planting sites, implement a feasible intervention, and compare meter or sensor observations under comparable conditions. Annual energy, payback, pollution reductions and causal climate benefits require additional data and validation.

## Implementation

React 19, TypeScript, Vinext/Vite, Recharts, custom Canvas globe and SVG district visualization, Open-Meteo weather/CAMS air-quality APIs, OpenStreetMap geometry, Web Crypto, IndexedDB, ethers and Solidity. The app exposes units, source times, explicit assumptions, missing-data states and reduced-motion controls.

## Deferred handoff

GitHub publication, a video and submission are outside the current requested work. Public sharing and any real testnet anchor require their own actual configuration. Previously captured organizer timing notes are retained below for a later submission decision; they are not a current eligibility or deadline verification.

## Submission timing conflict

The [official organizer update](https://ieee-climatechain-hack.devpost.com/updates/46814-climatechain-hackathon-submissions-open-tomorrow-get-ready-to-submit) says submissions opened on **October 5, 2026**. The [rules page](https://ieee-climatechain-hack.devpost.com/rules) still says not to submit before **8 AM PT on October 25**. The [overview](https://ieee-climatechain-hack.devpost.com/) lists a deadline of **October 25, 2026 at 14:00 UTC**, which is **7:30 PM IST**.

On that date, Pacific Time is PDT, UTC−7, so 8 AM PT is **15:00 UTC / 8:30 PM IST**—one hour after the listed deadline. [NIST's daylight saving guidance](https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst) confirms that daylight saving continues until November 1, 2026. Preserve this discrepancy and obtain organizer confirmation before submission; do not infer a new deadline.

The overview's participation summary also says students only, while the rules lists additional categories. Check eligibility directly before submitting.

