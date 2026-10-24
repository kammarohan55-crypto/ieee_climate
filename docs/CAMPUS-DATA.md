# Campus study data and water accounting

The campus workspace is a separate public-data study around London South Bank University in Southwark. It does not claim university partnership, installed equipment, measured campus demand, or achieved environmental benefits. Existing TerraTrace city captures are unchanged.

## Sources

- **OpenStreetMap:** footprints, mapped tags, paths, public street centerlines, and POIs; ODbL 1.0, © OpenStreetMap contributors. The full raw Overpass response and query are retained in `public/campus/study.json`. Building heights preserve `mapped`, `floors`, or `assumed` provenance; levels are converted using an assumed 3 m per level, and absent heights use an assumed 10 m. No LiDAR heights are claimed.
- **OpenStreetMap mapped trees:** actual `natural=tree` nodes in the study square, ODbL 1.0. Original tags and raw response are bundled. Missing geometric dimensions use explicit assumptions of 10 m height and 6 m crown diameter. The separate source identifies this as a partial inventory, without claiming absence of canopy elsewhere. The intended [GLA November 2025 public tree CSV](https://data.london.gov.uk/dataset/london-public-realm-trees-2r45m) is OGL v3, but its 199 MB bulk download did not finish within the bounded capture timeout. The current study therefore uses the explicitly identified mapped OSM fallback.
- **Environment Agency Mitcham qualified daily rainfall, 2018–2025:** OGL v3. All 2,922 original daily records and quality/completeness fields are preserved. The gauge is approximately 10.03 km from the campus center. Headline reliability accepts only 2018, 2020, and 2025, each with every daily record marked `Good` and `Complete`. Other years remain available for inspection. The provider's daily records have a 09:00 boundary in raw `dateTime`; their totals are never converted into invented hourly storms. [API documentation](https://environment.data.gov.uk/hydrology/doc/reference).
- **Open-Meteo/NOAA GFS ensemble:** CC BY 4.0. The capture includes 31 members and 72 one-hour UTC intervals. Each value is the preceding-hour `rain + showers` total; snowfall is excluded. Full provider arrays, capture time, forecast coordinates, and source URL are retained. Grid coordinates need not match the exact campus center. The member spread is not a calibrated confidence interval. [Ensemble documentation](https://open-meteo.com/en/docs/ensemble-api).

No restricted London canopy-cover tiles are redistributed. The national LiDAR program is a relevant open source, but a verified local clip is not included in this delivery.

## Geometry and walk graph limitations

Coordinates use metres east (`x`) and south (`z`) around 51.4977025, -0.1018199. The boundary is a 1.6 km square. Pedestrian routes share exact original OSM node IDs; private/no-access ways and explicit foot restrictions are excluded. No synthetic connectors are added across roads.

Building components preserve 15 original courtyard inner rings across 14 relations. Their projected area is deducted from roof catchments, and holes remain available to the scene and geometric shadow model. Where a separately tagged outer way is also represented by its building relation, the relation component is retained once. This removes the duplicated Southwark station footprint. The three default campus catchments have no inner rings and remain unchanged. Unclosed source rings are never silently completed with invented edges.

Public street centerlines are pedestrian-access proxies and do not prove sidewalk continuity, safe crossings, accessibility, or entrance opening hours. Destinations attach to their nearest mapped graph node; final access requires inspection. Proposed shade sails are unsurveyed concepts near mapped routes. Their placement does not establish landowner permission, foundations, clearances, or feasibility.

## Water model

`campus-roof-storage-yas-v1` uses overflow-before-reuse accounting independently for each selected roof and tank:

1. Roof runoff = rainfall mm / 1,000 × mapped plan area × assumed runoff coefficient.
2. Connected runoff = roof runoff × connected fraction; remaining runoff is bypass.
3. Add connected runoff to storage, then spill above tank capacity.
4. Serve that roof's share of whole-proposal eligible non-potable demand.
5. Carry ending storage to the next interval.

Whole-proposal demand is allocated once, by connected catchment area. It is never multiplied by the number of roofs. A disconnected catchment receives no demand share; if all catchments are disconnected, demand remains unmet. Roof plan area is not a measured gutter-connected catchment. Starting fill, demand, connection, runoff, and capacity are assumptions until surveyed.

Each observed year is replayed independently. The current selected scenario may use a declared starting fill; capacity alternatives always begin empty. `capacitySweep` compares total portfolio storage capacity, divided among roofs by connected area, and reports worst accepted-year coverage plus mean annual reuse and overflow. It does not optimize drainage networks or predict flood depths.

Forecast runs preserve complete individual member trajectories. Storage-band percentiles are calculated per interval. The representative run is one actual member nearest the median cumulative rainfall, retaining internally consistent mass balance; its totals are not medians of other members. A flexible-task override changes timing of the same already planned demand volume. It does not open valves, discharge water, or establish suitability for irrigation or other reuse.

## Refresh and verification

Run `npx tsx scripts/capture-campus.ts` to recapture the three campus source bundles. Environment Agency requests run one at a time. Live forecast refresh uses a bounded timeout and returns an explicit unavailable response on failure; the UI may then explicitly display the dated saved capture. Sources from different refreshes are never merged.

Run `npx tsx tests/campus-water.ts` to verify daily quality gates, leap days, whole-proposal demand allocation, interval/whole-run mass balance, rejected forecast members, real-member representation, and checked-in observation coverage.
