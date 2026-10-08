# TerraTrace

**Climate intelligence, with evidence.** A working IEEE ClimateChain 2026 prototype for community energy projects, campus sustainability teams, and environmental researchers.

Primary track: **Climate Data & Environmental Monitoring**. Supporting track: **Renewable Energy & Energy Trading** (energy planning, not a trading market).

## What works

- Interactive canvas globe from real Natural Earth land geometry: drag, zoom, pause, and select cities.
- Real Open-Meteo weather, solar irradiance, and Copernicus CAMS air forecasts for eight featured cities and worldwide geocoding.
- Forecast charts, regional comparison, and explicit local time zones.
- Tomorrow's solar-load optimizer with editable capacity, performance factor, task power, duration, baseline timing, and assumed emissions factor.
- A genuine 64-tree seeded Isolation Forest, trained locally on up to 72 hourly temperature, humidity, and PM₂.₅ forecast samples. This exploratory model has no independently validated predictive accuracy.
- Portable SHA-256 evidence receipts containing raw model responses, source URLs, retrieval time, units, attribution, location, and scenario. A separate import verifier checks payload integrity and observation identity.
- A publisher-only Solidity registry that rejects repeated declared observation IDs and repeated exact digests.
- Optional Sepolia wallet anchoring: verifies chain, deployed code, publisher address, transaction confirmation, and registry read-back before marking an anchor.
- Responsive layout, keyboard navigation, modal focus trapping, reduced-motion support, and feature-detected WebMCP tools.

## Run locally

Requires Node.js 22.13+.

```sh
npm install
npm run dev
```

Open the exact local URL printed by the server. No API keys are required for the noncommercial prototype.

```sh
npm run typecheck
npm test
npm run test:contract
npm run build
```

Stack: React 19, TypeScript, Vinext/Vite, Cloudflare Workers-compatible server, Recharts, Lucide, browser Canvas/Web Crypto, ethers, Solidity. `app/api/climate/route.ts` validates locations, fetches approved providers with timeouts/retry, and caches complete results for five minutes in the current server isolate. HTTP cache headers provide a short additional cache. This is a prototype cache, not durable distributed storage.

## Sources and honest interpretation

- [Open-Meteo weather and solar](https://open-meteo.com/en/docs): current conditions and hourly series are modeled values, not local sensor measurements.
- [Copernicus CAMS via Open-Meteo](https://open-meteo.com/en/docs/air-quality-api): pollution is a modeled forecast. Global grid resolution is approximately 45 km; Europe has finer regional coverage. Air quality is not carbon emissions.
- [Open-Meteo terms](https://open-meteo.com/en/terms) and [CC BY 4.0 licence](https://open-meteo.com/en/licence): attribution is visible in the app and evidence. Free hosted API access is noncommercial, with usage limits. Commercial deployment needs appropriate provider arrangements.
- [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/): public-domain land geometry, prepared by `scripts/prepare-globe.mjs`.
- `public/reference-data.json`: authentic API responses captured on **8 October 2026**. These are used only when live providers fail, explicitly labeled as a reference capture with original dates. They are never refreshed by changing timestamps.

Solar generation is `capacity kWp × tilted irradiance W/m² / 1000 × performance factor`. Hourly radiation values describe the preceding hour; the planner reindexes them to interval start times and uses the exact next midnight to complete a local day. Panels face the equator, with tilt equal to rounded absolute latitude. Task solar match is the sum of `min(generation kW, task power kW) × 1h` across contiguous hours. The default 0.80 performance and 0.40 kg CO₂e/kWh grid factor are **scenario assumptions**, not measurements. Carbon potential is additional matched solar × assumed factor, not a certified offset. Shading, cell temperature, inverter clipping, batteries, annual output, and causality are not modeled. Compare [a fuller PV model](https://pvpmc.sandia.gov/modeling-guide/2-dc-module-iv/point-value-models/pvwatts/).

## Evidence and blockchain

Receipts use `TerraTrace sorted-key JSON v1`: recursively sort object keys, preserve array order, use JSON number/string encoding, and UTF-8 encode before SHA-256. This is a declared versioned canonicalization scheme, not a claim of full RFC 8785 compliance. `observationIdentity` is embedded in the hashed payload and independently hashed to form `observationId`. The identity contains providers, coordinates, current source times, forecast interval, and identity version. Scenario revisions within that observation require a new identity-version design rather than silently creating a duplicate observation. Integrity does not prove source truth.

Receipts live in browser storage on this device. Download them for portability. The independent verifier checks the payload and observation identity; envelope creation time and chain metadata are not asserted by that check. A URN in the registry identifies a digest, not a hosted downloadable evidence file. Keep and publish the exported evidence separately when independently shareable availability is needed.

### Optional real Sepolia anchor

1. Compile `contracts/ClimateEvidenceRegistry.sol` in the official [Remix editor](https://remix.ethereum.org/), compiler 0.8.24+.
2. In your wallet select **Ethereum Sepolia** and deploy from the intended publisher account. Only that deployer can write records. Use test ETH.
3. Paste the deployed address into Proof ledger, connect that publisher wallet, and choose **Anchor on Sepolia** on a local receipt.
4. Confirm in your wallet. The app marks the anchor only after successful confirmation and matching registry read-back. Inspect the actual explorer link.

No public-chain contract is predeployed and no funded wallet is bundled. `npm run test:contract` compiles and deploys the contract to a real **local in-memory EVM**, verifies an event/read-back and rejection guards, and generates `artifacts/ClimateEvidenceRegistry.json`. Local EVM tests do not constitute a public-chain deployment. Duplicate prevention is scoped to the registry's declared identity scheme, not global carbon-credit uniqueness.

## Demo and submission

Read [the four-minute demo script](docs/DEMO-SCRIPT.md) and [the submission draft](docs/SUBMISSION.md). The demo script is prepared; an actual 3–5 minute recorded video and a public GitHub repository URL must be added before submission. The Sites source mirror is private and is not represented as a public GitHub repository.

**Do not submit automatically.** The official overview deadline is October 25, 2026 at 14:00 UTC / **7:30 PM IST**, but a rules sentence says not before 8 AM PT on October 25 (**8:30 PM IST**, after the deadline). An organizer update instead says submissions open October 5. Resolve this discrepancy directly with the organizers before submitting. [Organizer update](https://ieee-climatechain-hack.devpost.com/updates/46814-climatechain-hackathon-submissions-open-tomorrow-get-ready-to-submit), [rules](https://ieee-climatechain-hack.devpost.com/rules), [overview](https://ieee-climatechain-hack.devpost.com/).

## Scope and scaling

Today: public forecasts, browser-local evidence, and optional one-publisher testnet anchoring. A production rollout needs shared durable evidence storage, provider capacity agreements, deployed registry governance, sensor calibration where sensors are used, site-specific PV modeling, independently evaluated ML, documented grid factors, and audited contract/code. Neither a short weather forecast nor a cryptographic fingerprint certifies climate impact.

Source code: MIT. Source datasets and bundled upstream starter components retain their own licences.
