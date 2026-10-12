# TerraTrace

**Climate intelligence, with evidence.** A working IEEE ClimateChain 2026 prototype for community energy projects, campus sustainability teams, and environmental researchers.

**Source code:** [https://github.com/kammarohan55-crypto/ieee_climate](https://github.com/kammarohan55-crypto/ieee_climate)

Primary track: **Climate Data & Environmental Monitoring**. Supporting track: **Renewable Energy & Energy Trading** (energy planning, not a trading market).

## City planning twin

The project opens on one large, inspectable district map with cool roofs, rooftop solar, proposed mature trees, energy balance and transferred research cooling sensitivities. Eight featured cities have authentic OpenStreetMap geometry. Expand the map, search buildings, inspect solar survey candidates and animate geometric sun/shadow positions. The City strategy lab saves up to four plans per city against one frozen source snapshot: numeric comparisons show the reference and displayed plans, while the entire map shows the displayed plan.

The separate rainwater lab follows a selected mapped roof through 24 hours of forecast liquid rain, collection, assumed tank storage, non-potable reuse and overflow. Capacity comparisons, a roof survey queue, a manual checklist and portable receipts connect the scenario to a site visit. The Evidence lens inspects height provenance and footprint density, with a saved building survey list. The Research library credits **11 peer-reviewed papers (2024–2026)** and **10 organizer-verified winning projects**, reviewed on 8 October 2026. Read [the methodology](docs/CITY-TWIN.md) for formulas, sources and limitations.

## What works

- Interactive canvas globe from real Natural Earth land geometry: drag, zoom, pause, and select cities.
- Real Open-Meteo weather, solar irradiance, and Copernicus CAMS air forecasts for eight featured cities and worldwide geocoding.
- Forecast charts, regional comparison, and explicit local time zones.
- District roof-treatment and mature-canopy scenarios, building survey estimates, and an animated geometric shade timeline inside the city twin.
- Selected-roof rainwater scenarios using real hourly rain and showers in mm, editable collection and storage assumptions, eight fixed capacity candidates plus the custom capacity, and source-preserving exports.
- A genuine 64-tree seeded Isolation Forest, trained locally on up to 72 hourly temperature, humidity, and PM₂.₅ forecast samples. This exploratory model has no independently validated predictive accuracy.
- Portable SHA-256 evidence receipts containing raw model responses, source URLs, retrieval time, units, attribution, location, and scenario. A separate import verifier checks payload integrity and observation identity.
- A publisher-only Solidity registry that rejects repeated declared observation IDs and repeated exact digests.
- Optional Sepolia wallet anchoring: verifies chain, deployed code, publisher address, transaction confirmation, and registry read-back before marking an anchor.
- Responsive layout, keyboard navigation, modal focus trapping, reduced-motion support, and feature-detected WebMCP tools.

## Run a temporary local preview

The hosted website remains **offline**. Requires Node.js 22.13+. The explicit preview flag permits application access only through `localhost` or `127.0.0.1`:

```powershell
git clone https://github.com/kammarohan55-crypto/ieee_climate.git
cd ieee_climate
npm run install:ci
$env:TERRATRACE_LOCAL_PREVIEW = '1'
npm run dev
```

Open the exact loopback URL printed by the server. Stop the preview with Ctrl+C and clear the flag with `Remove-Item Env:TERRATRACE_LOCAL_PREVIEW`. Set this flag only for temporary local work; leave it unset in production. Production access remains the offline page. No API keys are required for the noncommercial prototype.

```powershell
npm run typecheck
npm test
npm run test:twin
npm run test:water
node node_modules/tsx/dist/cli.mjs scripts/verify-water-export.ts
npm run test:contract
npm run build
```

The water export check reproduces the bundled browser-exported example exactly from its captured forecast, selected geometry and assumptions, then checks that source tampering invalidates the receipt.

Stack: React 19, TypeScript, Vinext/Vite, Cloudflare Workers-compatible server, Recharts, Lucide, browser Canvas/Web Crypto, ethers, Solidity. `app/api/climate/route.ts` validates locations and fetches approved providers with bounded timeouts/retry. Complete responses are cached for five minutes and partial responses for 30 seconds in the current server isolate. Usable live weather remains available if air data fails; older air is never silently merged with a new forecast. This prototype cache is not durable distributed storage.

## Sources and honest interpretation

- [Open-Meteo weather and solar](https://open-meteo.com/en/docs): current conditions and hourly series are modeled values, not local sensor measurements.
- [Copernicus CAMS via Open-Meteo](https://open-meteo.com/en/docs/air-quality-api): pollution is a modeled forecast. Global grid resolution is approximately 45 km; Europe has finer regional coverage. Air quality is not carbon emissions.
- [Open-Meteo terms](https://open-meteo.com/en/terms) and [CC BY 4.0 licence](https://open-meteo.com/en/licence): attribution is visible in the app and evidence. Free hosted API access is noncommercial, with usage limits. Commercial deployment needs appropriate provider arrangements.
- [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/): public-domain land geometry, prepared by `scripts/prepare-globe.mjs`.
- `public/climate-reference-v2.json`: authentic weather and air API responses for all eight featured cities, captured **12 October 2026, 17:09:48.945–17:09:50.565 UTC**. Weather includes hourly `rain` and `showers` with explicit `precipitation_unit=mm`; individual provider retrieval times and exact requested URLs are preserved. `scripts/capture-climate.ts` records actual responses with bounded concurrency/retries and honest partial states.
- When live weather fails, the browser tries the v2 capture, then the unchanged original `public/reference-data.json` capture. Captures retain their original dates and a visible reference label. Missing rain in the older capture disables water outcomes instead of becoming zero rain.

District solar generation is `capacity kWp × tilted irradiance W/m² / 1000 × performance factor`, with capacity derived from mapped area, assigned roof fraction and assumed panel density. Hourly radiation values describe the preceding hour; the twin reindexes them to interval start times and uses the exact next midnight to complete a local day. Panels face the equator, with tilt equal to rounded absolute latitude. Solar match is capped at assumed hourly district demand; surplus is separate. Performance and grid factors are **editable scenario assumptions**, not measurements. Carbon potential is matched solar × assumed factor, not a certified offset. The geometric shade animation does not modify PV generation or cooling results. Cell temperature, inverter clipping, batteries, annual output, and causality are not modeled. Compare [a fuller PV model](https://pvpmc.sandia.gov/modeling-guide/2-dc-module-iv/point-value-models/pvwatts/).

The water lab sums `rain + showers` over 24 complete preceding-hour intervals in the weather location's time zone; snow is excluded. Runoff is `rain mm × clipped roof m² / 1000 × assumed runoff coefficient`. Connected runoff enters one assumed tank, overflow occurs before hourly reuse, and disconnected runoff bypasses the tank. The main scenario has editable starting storage. All capacity comparisons start empty at **0, 1, 2.5, 5, 10, 25, 50 and 100 m³**, plus a distinct selected custom capacity. This is a one-day comparison, not annual sizing or flood prediction. Reuse can include starting water; roof release is bypass plus overflow. Treatment, first flush, pipe capacity, structural suitability and subhour storm timing require further work.

## Evidence and blockchain

Receipts use `TerraTrace sorted-key JSON v1`: recursively sort object keys, preserve array order, use JSON number/string encoding, and UTF-8 encode before SHA-256. This is a declared versioned canonicalization scheme, not a claim of full RFC 8785 compliance. `observationIdentity` is embedded in the hashed payload and independently hashed to form `observationId`. Generic data receipts use `environmental-observation-v1`: providers, coordinates, source times, forecast interval and a digest of the raw responses and source URLs. A changed retrieval time alone retains the same identity; revised source data receives a distinct identity. City receipts preserve geometry and scenario inputs under `district-planning-v2`. Water receipts preserve the selected roof, raw weather, source dates, assumptions, all hourly balances, empty-start capacity comparisons and manual checklist under `terratrace-roof-water-v1`. Previously exported receipts remain verifiable, including legacy solar-scenario identities. Integrity does not prove source truth.

Receipts live in IndexedDB browser storage on this device, with legacy localStorage migration. Download them for portability. The independent verifier checks the payload and observation identity; envelope creation time and chain metadata are not asserted by that check. A URN in the registry identifies a digest, not a hosted downloadable evidence file. Keep and publish the exported evidence separately when independently shareable availability is needed.

### Optional real Sepolia anchor

1. Compile `contracts/ClimateEvidenceRegistry.sol` in the official [Remix editor](https://remix.ethereum.org/), compiler 0.8.24+.
2. In your wallet select **Ethereum Sepolia** and deploy from the intended publisher account. Only that deployer can write records. Use test ETH.
3. Paste the deployed address into Proof ledger, connect that publisher wallet, and choose **Anchor on Sepolia** on a local receipt.
4. Confirm in your wallet. The app marks the anchor only after successful confirmation and matching registry read-back. Inspect the actual explorer link.

No public-chain contract is predeployed and no funded wallet is bundled. `npm run test:contract` compiles and deploys the contract to a real **local in-memory EVM**, verifies an event/read-back and rejection guards, and generates `artifacts/ClimateEvidenceRegistry.json`. Local EVM tests do not constitute a public-chain deployment. Duplicate prevention is scoped to the registry's declared identity scheme, not global carbon-credit uniqueness.

## Demo and submission

Read [the project walkthrough](docs/PROJECT-WALKTHROUGH.md), [the submission draft](docs/SUBMISSION.md), and [the feature roadmap](docs/FEATURE-ROADMAP.md). The strategy lab, Evidence lens and rainwater lab are built; measured-change and shaded-route tools remain proposed. The standalone Solar planner has been removed. Saved strategies, Evidence survey lists and sealed receipts stay on this device; export them for portability. The water checklist applies to the selected scenario and travels with its export. Source code is published at [https://github.com/kammarohan55-crypto/ieee_climate](https://github.com/kammarohan55-crypto/ieee_climate). No video or hackathon submission has been made. The Sites source mirror is private, and hosted access stays offline.

**Do not submit automatically.** Previously captured organizer notes contain a timing conflict: the overview deadline is October 25, 2026 at 14:00 UTC / **7:30 PM IST**, while a rules sentence says not before 8 AM PT on October 25 (**8:30 PM IST**, after that deadline). An organizer update instead says submissions open October 5. These notes are not a fresh eligibility or deadline verification. Resolve the discrepancy with the organizers before any later submission. [Organizer update](https://ieee-climatechain-hack.devpost.com/updates/46814-climatechain-hackathon-submissions-open-tomorrow-get-ready-to-submit), [rules](https://ieee-climatechain-hack.devpost.com/rules), [overview](https://ieee-climatechain-hack.devpost.com/).

## Scope and scaling

Today: public forecasts, browser-local evidence, and optional one-publisher testnet anchoring. A production rollout needs shared durable evidence storage, provider capacity agreements, deployed registry governance, sensor calibration where sensors are used, site-specific PV modeling, independently evaluated ML, documented grid factors, and audited contract/code. Neither a short weather forecast nor a cryptographic fingerprint certifies climate impact.

Source code: MIT. Source datasets and bundled upstream starter components retain their own licences.

