# TerraTrace

Preparation draft for the IEEE ClimateChain Global Hackathon 2026. This project has not been submitted. Replace the pending links and complete the handoff checklist before copying this draft into Devpost.

**Tagline:** See the forecast. Choose a cleaner energy window. Keep the evidence.

**Primary track:** Climate Data & Environmental Monitoring.

**Supporting track:** Renewable Energy & Energy Trading.

**Working prototype:** [Add the verified public demo URL.]

**Code repository:** [Add the actual public GitHub repository URL.]

**Demo video:** [Add the recorded 3–5 minute demo video URL.]

## The problem

A campus, community facility, or small business can have useful weather forecasts and rooftop solar while still struggling to answer a practical question: when should a flexible electricity task run? The answer often lives across separate dashboards, and a screenshot rarely preserves the assumptions or data behind the recommendation.

TerraTrace connects environmental context, a transparent energy calculation, and a portable evidence receipt. Its purpose is to help people make a decision they can inspect and explain later.

## What TerraTrace does

TerraTrace opens as a dark, animated globe observatory. Selecting a city brings its weather, air quality, and the next 24 hours into one visual workspace. Data come from live requests to the [Open-Meteo Weather API](https://open-meteo.com/en/docs) and its [CAMS-backed Air Quality API](https://open-meteo.com/en/docs/air-quality-api). These are model-based environmental data and forecasts; they are not readings from sensors installed by TerraTrace.

The solar planner turns the forecast into a concrete scheduling choice. A user enters the solar installation capacity, system derate, and a flexible task's power and duration, then chooses a baseline start time. TerraTrace searches the available contiguous time windows and compares their modeled solar coverage with that baseline. The result shows the next day suggested window, solar matched to the task, additional solar match versus the baseline, and assumption-based carbon potential.

The calculation is deliberately inspectable: estimated solar power in kW equals installed capacity in kWp multiplied by global tilted irradiance in W/m², divided by 1,000, and multiplied by the system derate. Hourly energy follows from power and interval duration. The task's solar coverage is capped by its demand. This is a simplified forecast scenario, not measured generation, a tariff guarantee, or a certified emissions reduction.

A browser-trained Isolation Forest examines up to 72 hours of forecast temperature, relative humidity, and PM2.5. Its outlier scores highlight unusual combinations within that particular forecast for exploration. The model has not been validated against observed outcomes, and the scores are not climate attribution, health advice, or a validated hazard forecast. The scheduling calculation is separate from this exploratory model.

## Trust that can be checked

TerraTrace creates a versioned JSON evidence receipt for the selected data and scenario. The browser canonicalizes its payload and calculates a real SHA-256 digest. Users can export the receipt, keep it in a local browser ledger, and import it into the verifier. Recomputing the digest detects changes to the committed payload.

This distinction matters: a matching hash establishes integrity of the saved payload. It does not establish that every forecast is accurate or that an environmental claim has been independently certified.

The project also includes a Solidity evidence registry. Only its publisher may record evidence; the registry rejects a previously recorded observation identifier and a previously recorded digest. That provides an explicit rule against duplicate entries in this registry. It does not create carbon credits or prevent duplicate claims across unrelated systems.

Optional Sepolia anchoring uses an actual browser wallet and a user-deployed registry address. A local receipt remains labeled as a local proof until a real transaction succeeds and its on-chain record can be read back. Public deployment and a confirmed Sepolia transaction are pending handoff items; this draft claims neither.

## Track alignment

For **Climate Data & Environmental Monitoring**, TerraTrace makes environmental data easier to inspect and preserves the specific dataset and assumptions behind a decision. Source attribution, time labels, exportable receipts, and repeatable verification address the track's transparency challenge.

For **Renewable Energy & Energy Trading**, the project demonstrates the energy coordination side of the track: scheduling flexible demand to better overlap modeled rooftop solar. The prototype is a planning tool; it does not implement peer-to-peer electricity trading.

## Potential environmental impact

The immediate, measurable outcome is the difference in modeled grid electricity required by the same task under the selected baseline and the recommended schedule. TerraTrace reports that difference in kWh for the displayed scenario. It does not invent a global impact total or convert it into offsets.

The intended users are campuses, community buildings, and small businesses with solar and flexible loads such as charging, pumping, or batch equipment. A practical pilot would compare the forecasts with meter data, check operational constraints, and measure how often the suggested schedule reduces grid demand. That would establish whether the prototype's modeled opportunity translates into real benefits.

## How it was built

The interface uses React, TypeScript, Tailwind CSS, Recharts, and custom globe visualization and animation. Weather and air-quality APIs supply the environmental inputs. The browser runs the exploratory Isolation Forest, scenario calculations, canonical JSON hashing, and local receipt ledger. Solidity defines the registry; ethers provides the optional wallet and contract connection.

The design keeps the reasoning close to the visuals: units and time labels accompany the charts, editable assumptions accompany the recommendation, and proof status accompanies each receipt. No proprietary dataset, production wallet key, or paid API is required for the local proof workflow.

## What comes next

The next useful step is a metered pilot. Historical validation would evaluate the solar estimate and the exploratory outlier model. Facility constraints would make the planner operationally realistic, while a shared evidence service and a deployed registry would allow organizations to maintain a common record. Any emissions estimate would require a defensible, time-specific grid factor and its own documented uncertainty.

## Handoff checklist — do not paste this section into the public description

- [ ] Confirm the final public prototype URL and verify it opens without the developer's session.
- [ ] Create or publish the actual public source repository, then replace the repository placeholder.
- [ ] Include setup instructions, source attribution, methodology, and explicit limitations in the repository.
- [ ] Run the final build and exercise city selection, forecast charts, planner inputs, outlier display, receipt export, and receipt import verification.
- [ ] Demonstrate a genuine failure when a committed value in an exported receipt is changed.
- [ ] Test the Solidity contract for successful recording, duplicate observation rejection, duplicate digest rejection, and unauthorized publisher rejection.
- [ ] If showing real anchoring, deploy the registry to Sepolia with the intended publisher wallet, configure its actual address, and verify a successful receipt and stored digest. Otherwise present it as an optional integration that is not yet deployed.
- [ ] Record a clear 3–5 minute demo using the accompanying script. Use the actual values visible during recording.
- [ ] Replace the demo video placeholder with the actual watchable video URL.
- [ ] Confirm the team's eligibility and members against the organizers' current guidance.
- [ ] Resolve the submission timing conflict with the organizers. Do not submit automatically.

## Submission timing conflict

The [official organizer update](https://ieee-climatechain-hack.devpost.com/updates/46814-climatechain-hackathon-submissions-open-tomorrow-get-ready-to-submit) says submissions opened on **October 5, 2026**. The [rules page](https://ieee-climatechain-hack.devpost.com/rules) still says not to submit before **8 AM PT on October 25**. The [overview](https://ieee-climatechain-hack.devpost.com/) lists a deadline of **October 25, 2026 at 14:00 UTC**, which is **7:30 PM IST**.

On that date, Pacific Time is PDT, UTC−7, so 8 AM PT is **15:00 UTC / 8:30 PM IST**—one hour after the listed deadline. [NIST's daylight saving guidance](https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst) confirms that daylight saving continues until November 1, 2026. Preserve this discrepancy and obtain organizer confirmation before submission; do not infer a new deadline.

The overview's participation summary also says students only, while the rules lists additional categories. Check eligibility directly before submitting.

