# TerraTrace — four-minute demo

Recording plan for the IEEE ClimateChain Global Hackathon 2026. Aim for approximately four minutes with calm narration and short pauses for the interactions. Read actual values from the application during recording; do not add invented impact figures. The prototype URL, repository publication, recorded video, and public blockchain deployment remain handoff items.

## Before recording

- Open the final verified demo and load its environmental data successfully.
- Choose one city with complete forecast and irradiance data. Use the same city throughout the decision and proof sequence.
- Prepare a plausible task: for example, a facility with a 10 kWp solar installation, an 80% derate, and a 2 kW task that runs for two hours. These are scenario inputs, not claims about a real installation.
- Choose a baseline start time that makes the comparison easy to see. Record the actual comparison, including a zero improvement if that is what the app returns.
- Export one intact receipt and make a separate copy with one committed numeric value changed. Do not alter only a field outside the hashed payload.
- Keep the local proof demonstration ready. Only use the Sepolia replacement passage below if a real deployment and confirmed anchor exist.
- Hide unrelated tabs, personal wallet balances, and private information. Keep the application's source and limitation labels visible.

## 0:00–0:30 — the decision

**On screen:** Start on the globe. Let its motion settle, then select the demo city.

**Narration:**

"A building can have rooftop solar and still run a flexible electricity task at the least useful time. The forecast, the energy calculation, and the evidence behind the decision often sit in separate places.

This is TerraTrace: an environmental observatory that helps a campus, community building, or small business inspect the next day, choose a better energy window, and keep a verifiable record of the choice."

## 0:30–1:05 — traceable environmental context

**On screen:** Show the selected city, current cards, data source labels, and the 24-hour forecast. Move across a chart so a value and time can be read.

**Narration:**

"Selecting a city brings its weather and air quality into one workspace. These values come from live Open-Meteo requests, with CAMS supplying the air-quality model data. The charts show the next 24 hours with their units and time labels.

These are model-based conditions and forecasts, not readings from our own sensors. That distinction stays visible because a useful climate tool should make its evidence and its limits understandable."

## 1:05–2:00 — a practical energy choice

**On screen:** Enter the prepared solar and task inputs. Select the baseline. Show the recommended contiguous window and compare the two energy results. Briefly change one input to reveal the effect.

**Narration:**

"Now consider a flexible task that takes two hours. I enter the installation capacity, system derate, task power, and a baseline start time. These are editable assumptions for this scenario.

TerraTrace estimates solar output from the forecast irradiance and searches the available contiguous windows. It compares the same task at the baseline time with the recommended time, then shows the solar matched to the task and additional solar match versus the original timing.

Watch what happens when I change the capacity: the calculation updates, so the result can be questioned and reproduced. Solar coverage cannot exceed the task's demand.

The useful outcome is the actual kWh comparison shown here. This is a planning estimate, not measured generation, a guaranteed saving, or a carbon offset."

## 2:00–2:30 — exploratory machine learning

**On screen:** Open or reveal the outlier model panel. Highlight its method and limitations, then inspect a scored forecast hour.

**Narration:**

"The exploratory model adds another way to inspect the forecast. An Isolation Forest trains in this browser on up to 72 hours of temperature, humidity, and PM2.5, then highlights combinations that are unusual within that forecast.

It has not been validated against observed outcomes. An outlier score is not a diagnosis or a validated hazard prediction. The transparent solar scheduling calculation remains separate from this model."

## 2:30–3:25 — preserve and challenge the evidence

**On screen:** Create a receipt, show the real digest and local status, export it, and import the intact version. Then import the changed copy and show verification failure.

**Narration:**

"A recommendation is more useful when its evidence travels with it. I create a versioned JSON receipt containing the selected data and scenario. TerraTrace canonicalizes the payload and calculates a real SHA-256 digest in the browser.

The receipt can be exported and kept in the local ledger. When I import the original, the verifier independently recomputes the digest and confirms that the payload matches.

Now I import a copy with one committed value changed. Verification fails. That is the core trust demonstration: we can detect changes to the saved evidence.

A matching digest proves payload integrity. It does not certify that the forecast is true or that a sustainability claim has been approved."

## 3:25–3:45 — the blockchain boundary

**On screen:** Show the Solidity registry information and optional wallet settings. Keep the receipt status labeled local. Do not open a fabricated transaction page.

**Narration — default, without a confirmed public anchor:**

"The Solidity registry accepts records only from its publisher and rejects repeated observation IDs and digests. Sepolia anchoring is an optional integration using a real wallet and deployed contract. This receipt is currently local; public deployment and an actual confirmed transaction are still required."

**Replacement narration — only after a real confirmed anchor exists:**

"The Solidity registry accepts records only from its publisher and rejects repeated observation IDs and digests. Here is our actual Sepolia transaction and contract address. The successful receipt and the stored digest can be checked independently. This testnet record anchors integrity; it does not certify environmental claims."

## 3:45–4:00 — impact and next step

**On screen:** Return to the baseline-versus-recommended comparison and the intact receipt. End with the product name, primary track, and actual demo/repository links when available.

**Narration:**

"TerraTrace connects a climate question to a practical choice and the evidence behind it. Our primary track is Climate Data and Environmental Monitoring, supported by renewable energy coordination. The next step is a metered pilot to test whether these modeled opportunities deliver real reductions in grid demand."

## Recording and submission handoff

- Record a real 3–5 minute video, confirm its audio is clear, and check that its link works for a judge.
- Use only the blockchain passage that matches the demonstrated deployment state.
- Publish the actual public repository and add its real URL to the submission.
- Complete the readiness checklist in SUBMISSION.md before submitting.
- Do not submit automatically. The official organizer update says submissions opened October 5, 2026, but the rules still states October 25 at 8 AM PT. That is 8:30 PM IST, one hour after the listed October 25 deadline of 7:30 PM IST. Obtain organizer confirmation rather than inventing a submission window.

Sources: [Open-Meteo weather documentation](https://open-meteo.com/en/docs), [Open-Meteo/CAMS air-quality documentation](https://open-meteo.com/en/docs/air-quality-api), [official submission opening update](https://ieee-climatechain-hack.devpost.com/updates/46814-climatechain-hackathon-submissions-open-tomorrow-get-ready-to-submit), [official rules](https://ieee-climatechain-hack.devpost.com/rules), [official overview and deadline](https://ieee-climatechain-hack.devpost.com/).

