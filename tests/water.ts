import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {ClimateData} from '../lib/climate';
import type {UrbanFeature, UrbanData} from '../lib/twin';
import {digest, makeReceipt, verifyReceipt} from '../lib/proof';
import {WATER_DEFAULTS, WATER_MODEL_VERSION, rainIntervals, waterBalance, capacitySweep, type WaterSettings} from '../lib/water';

const captured = JSON.parse(fs.readFileSync('public/reference-data.json', 'utf8').replace(/^\uFEFF/, '')) as {data: ClimateData[]};
const roof = JSON.parse(fs.readFileSync('public/urban/delhi.json', 'utf8')).features.find((f: UrbanFeature) => f.kind === 'building') as UrbanFeature;
const testRoof = {...roof, area: 1000};
const zeroDemand: WaterSettings = {...WATER_DEFAULTS, runoffCoefficient: 1, dailyDemandM3: 0};
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

// Synthetic hourly inputs are isolated to this unit test; real reference captures are left untouched.
function forecast(rain: number[] = [], showers: number[] = []): ClimateData {
  const source = structuredClone(captured.data[0]);
  source.weather!.current.time = '2026-10-08T12:00';
  source.weather!.hourly.time = Array.from({length: 72}, (_, i) => new Date(Date.UTC(2026, 9, 8, i)).toISOString().slice(0, 16));
  source.weather!.hourly.rain = Array(72).fill(0);
  source.weather!.hourly.showers = Array(72).fill(0);
  source.weather!.hourly_units.rain = 'mm';
  source.weather!.hourly_units.showers = 'mm';
  for (let i = 0; i < 24; i++) {
    source.weather!.hourly.rain[25 + i] = rain[i] ?? 0;
    source.weather!.hourly.showers[25 + i] = showers[i] ?? 0;
  }
  return source;
}

for (const source of captured.data) {
  const day = rainIntervals(source);
  assert.equal(day.available, false, 'Old captures without precipitation must remain unavailable');
  assert.ok(day.rows.every(row => row.rain === null && row.showers === null && row.rainMm === null));
  const result = waterBalance(source, testRoof, WATER_DEFAULTS);
  assert.equal(result.available, false);
  assert.equal(result.totals, null);
  assert.equal(result.residual, null);
  assert.ok(result.rows.every(row => row.storage === null && row.reuse === null));
}

const boundary = forecast([1, ...Array(22).fill(0), 2]);
boundary.weather!.hourly.rain[24] = 100; // Previous day's final interval; must be excluded.
boundary.weather!.hourly.rain[49] = 100; // Following day's first interval; must be excluded.
const day = rainIntervals(boundary);
assert.ok(day.available);
assert.equal(day.date, '2026-10-09');
assert.equal(day.rows.length, 24);
assert.equal(day.rows[0].time, '2026-10-09T01:00');
assert.equal(day.rows[0].intervalStart, '2026-10-09T00:00');
assert.equal(day.rows[0].label, '00:00');
assert.equal(day.rows[23].time, '2026-10-10T00:00');
assert.equal(day.rows[23].label, '23:00');
close(day.rows.reduce((total, row) => total + row.rainMm!, 0), 3);

const millimeter = waterBalance(forecast([1]), testRoof, zeroDemand);
assert.ok(millimeter.available);
close(millimeter.totals!.roofRunoff, 1); // 1 mm × 1,000 m² = 1 m³.
close(millimeter.totals!.storage, 1);
close(millimeter.totals!.retained, 1);
close(millimeter.totals!.afterRelease, 0);
close(millimeter.residual!, 0);

const liquidOnly = forecast([1], [.5]);
liquidOnly.weather!.hourly.precipitation = Array(72).fill(500); // Includes snow; must not be added.
close(waterBalance(liquidOnly, testRoof, zeroDemand).totals!.roofRunoff, 1.5);
const disconnected = waterBalance(forecast([1]), testRoof, {...zeroDemand, connectedFraction: 0});
close(disconnected.totals!.inflow, 0);
close(disconnected.totals!.bypass, 1);
close(disconnected.totals!.afterRelease, 1);
const noTank = waterBalance(forecast([1]), testRoof, {...zeroDemand, capacityM3: 0});
close(noTank.totals!.overflow, 1);
close(noTank.totals!.storage, 0);
close(noTank.totals!.afterRelease, 1);
const partial = waterBalance(forecast([1]), testRoof, {...zeroDemand, connectedFraction: .5, runoffCoefficient: .8});
close(partial.totals!.roofRunoff, .8);
close(partial.totals!.inflow, .4);
close(partial.totals!.bypass, .4);
close(partial.totals!.storage, .4);

const fullTank = waterBalance(forecast([1]), testRoof, {...zeroDemand, capacityM3: 1, initialStorageM3: 1, dailyDemandM3: 24});
close(fullTank.rows[0].overflow!, 1); // Spillage before reuse is explicit, rather than secretly optimizing timing.
close(fullTank.rows[0].reuse!, 1);
close(fullTank.rows[0].storage!, 0);
close(fullTank.totals!.unserved, 23);
const storedWater = waterBalance(forecast(), testRoof, {...zeroDemand, initialStorageM3: 2, dailyDemandM3: 24});
close(storedWater.totals!.roofRunoff, 0);
close(storedWater.totals!.inflow, 0);
close(storedWater.totals!.reuse, 2);
close(storedWater.totals!.retained, 0); // Initial water is not newly harvested rainfall.
close(storedWater.totals!.unserved, 22);

const varied = forecast(Array.from({length: 24}, (_, i) => ((i * 7) % 11) / 10), Array(24).fill(.05));
const settings = {...WATER_DEFAULTS, capacityM3: 1, initialStorageM3: .5, dailyDemandM3: .9, connectedFraction: .4, runoffCoefficient: .65};
const balanced = waterBalance(varied, {...testRoof, area: 1800}, settings);
assert.ok(balanced.available);
assert.ok(balanced.rows.every(row => row.storage! >= 0 && row.storage! <= settings.capacityM3 && row.reuse! >= 0 && row.unserved! >= 0));
let previous = settings.initialStorageM3;
for (const row of balanced.rows) {
  close(previous + row.inflow!, row.storage! + row.reuse! + row.overflow!);
  close(row.roofRunoff!, row.bypass! + row.inflow!);
  previous = row.storage!;
}
close(settings.initialStorageM3 + balanced.totals!.inflow, balanced.totals!.storage + balanced.totals!.reuse + balanced.totals!.overflow);
close(settings.initialStorageM3 + balanced.totals!.roofRunoff, balanced.totals!.storage + balanced.totals!.reuse + balanced.totals!.afterRelease);
close(balanced.totals!.reuse + balanced.totals!.unserved, settings.dailyDemandM3);
close(balanced.residual!, 0);

for (const mutate of [
  (source: ClimateData) => { delete source.weather!.hourly.rain; },
  (source: ClimateData) => { delete source.weather!.hourly_units.showers; },
  (source: ClimateData) => { source.weather!.hourly_units.rain = 'inch'; },
  (source: ClimateData) => { source.weather!.hourly.showers[30] = null; },
  (source: ClimateData) => { source.weather!.hourly.rain[30] = -1; },
  (source: ClimateData) => { source.weather!.hourly.rain[30] = -999; },
  (source: ClimateData) => { source.weather!.hourly.rain[30] = Number.NaN; },
  (source: ClimateData) => { source.weather!.hourly.time.splice(30, 1); },
  (source: ClimateData) => { source.weather!.hourly.time.splice(30, 0, source.weather!.hourly.time[30]); },
  (source: ClimateData) => { [source.weather!.hourly.time[30], source.weather!.hourly.time[31]] = [source.weather!.hourly.time[31], source.weather!.hourly.time[30]]; },
]) {
  const source = forecast([1]);
  mutate(source);
  assert.equal(rainIntervals(source).available, false);
  const result = waterBalance(source, testRoof, zeroDemand);
  assert.equal(result.available, false);
  assert.equal(result.totals, null, 'Incomplete/invalid data cannot produce a deceptively complete day');
  assert.ok(result.rows.every(row => row.storage === null));
}
assert.equal(rainIntervals(undefined).available, false);
assert.equal(rainIntervals(forecast(), Number.NaN).available, false);
const invalidDate = forecast();
invalidDate.weather!.current.time = '2026-02-30T12:00';
assert.equal(rainIntervals(invalidDate).available, false);
assert.equal(rainIntervals(forecast(), 2).available, false, 'The final forecast day has no following midnight endpoint');
assert.equal(waterBalance(forecast(), undefined, zeroDemand).available, false);
assert.equal(waterBalance(forecast(), {...testRoof, kind: 'green'}, zeroDemand).available, false);
assert.equal(waterBalance(forecast(), {...testRoof, area: 0}, zeroDemand).available, false);
for (const change of [
  {connectedFraction: -1}, {connectedFraction: 1.1}, {runoffCoefficient: -.1}, {runoffCoefficient: 1.1},
  {capacityM3: -1}, {initialStorageM3: -1}, {initialStorageM3: 11}, {dailyDemandM3: -1},
  {capacityM3: Infinity}, {dailyDemandM3: Number.NaN},
]) {
  const invalid = {...zeroDemand, ...change};
  assert.equal(waterBalance(forecast(), testRoof, invalid).available, false);
  assert.deepEqual(capacitySweep(forecast(), testRoof, invalid), []);
}

const initialSettings = {...zeroDemand, initialStorageM3: 5, dailyDemandM3: 24};
const copy = structuredClone(initialSettings);
const drySweep = capacitySweep(forecast(), testRoof, initialSettings);
assert.ok(drySweep.length > 3);
assert.ok(drySweep.every(candidate => candidate.available && candidate.reuse === 0 && candidate.storage === 0));
assert.deepEqual(initialSettings, copy, 'Capacity comparisons must not mutate the user assumptions');
const wetSweep = capacitySweep(forecast([1]), testRoof, zeroDemand);
assert.equal(wetSweep[0].capacityM3, 0);
assert.ok(wetSweep.every(candidate => candidate.available));
assert.ok(wetSweep.some(candidate => candidate.capacityM3 === 1), 'The practical comparison set includes a one-m³ candidate');
assert.ok(wetSweep.filter(candidate => candidate.capacityM3 >= 1).every(candidate => candidate.retained === 1 && candidate.overflow === 0));
for (let i = 1; i < wetSweep.length; i++) assert.ok(wetSweep[i].capacityM3 > wetSweep[i - 1].capacityM3);
const candidateSizes = [0, 1, 2.5, 5, 10, 25, 50, 100];
for (const capacityM3 of candidateSizes) {
  assert.deepEqual(capacitySweep(forecast([1]), testRoof, {...zeroDemand, capacityM3}).map(candidate => candidate.capacityM3), candidateSizes,
    'Selecting a candidate must not expand or move the comparison set');
}
assert.deepEqual(capacitySweep(forecast([1]), testRoof, {...zeroDemand, capacityM3: 7.5}).map(candidate => candidate.capacityM3),
  [0, 1, 2.5, 5, 7.5, 10, 25, 50, 100], 'A custom selected capacity is retained alongside the stable candidates');
assert.ok(capacitySweep(captured.data[0], testRoof, zeroDemand).every(candidate => !candidate.available && candidate.reuse === null));

console.log('PASS: original missing-rain captures remain unavailable; exact preceding-hour day boundaries; mm-to-m³ conversion; rain/showers without snow double counting; zero connectivity/capacity; explicit spill-before-reuse timing; initial-water disclosure; hourly and full-day conservation; missing/invalid data and assumptions; fair empty-tank capacity sweep.');

const freshFile = 'public/climate-reference-v2.json';
const freshRaw = fs.readFileSync(freshFile, 'utf8');
const fresh = JSON.parse(freshRaw.replace(/^\uFEFF/, '')) as {captureStartedAt: string; captureCompletedAt: string; data: ClimateData[]};
assert.equal(fresh.data.length, 8, 'Every featured city needs an authentic rainfall capture');
assert.deepEqual(fresh.data.map(source => source.city.id).sort(), captured.data.map(source => source.city.id).sort());
const captureStart = Date.parse(fresh.captureStartedAt), captureEnd = Date.parse(fresh.captureCompletedAt);
assert.ok(Number.isFinite(captureStart) && Number.isFinite(captureEnd) && captureEnd >= captureStart);
const integrationSettings: WaterSettings = {...WATER_DEFAULTS, connectedFraction: .75, capacityM3: 5, initialStorageM3: .25, dailyDemandM3: 1.2};
let wetCaptures = 0;
for (const source of fresh.data) {
  const sourceBefore = JSON.stringify(source), retrievedAt = Date.parse(source.retrievedAt);
  assert.equal(source.status, 'snapshot');
  assert.ok(retrievedAt >= captureStart && retrievedAt <= captureEnd, `${source.city.id}: retain the actual capture timing`);
  assert.ok(retrievedAt > Date.parse(captured.data.find(old => old.city.id === source.city.id)!.retrievedAt));
  const request = new URL(source.sources.weather), requestedHours = request.searchParams.get('hourly')!.split(',');
  assert.equal(request.origin, 'https://api.open-meteo.com');
  assert.equal(request.pathname, '/v1/forecast');
  assert.equal(Number(request.searchParams.get('latitude')), source.city.lat);
  assert.equal(Number(request.searchParams.get('longitude')), source.city.lon);
  assert.equal(request.searchParams.get('precipitation_unit'), 'mm');
  assert.ok(requestedHours.includes('rain') && requestedHours.includes('showers'));
  assert.equal(source.weather!.hourly_units.rain, 'mm');
  assert.equal(source.weather!.hourly_units.showers, 'mm');
  assert.equal(source.weather!.hourly.rain.length, source.weather!.hourly.time.length);
  assert.equal(source.weather!.hourly.showers.length, source.weather!.hourly.time.length);
  const currentUtc = Date.parse(source.weather!.current.time + 'Z') - source.weather!.utc_offset_seconds * 1000;
  assert.ok(currentUtc <= retrievedAt + 60000 && currentUtc >= retrievedAt - 3600000, `${source.city.id}: provider time and capture time must agree`);

  const urbanRaw = fs.readFileSync(`public/urban/${source.city.id}.json`, 'utf8');
  const urban = JSON.parse(urbanRaw) as UrbanData, urbanBefore = JSON.stringify(urban);
  assert.equal(urban.city.id, source.city.id);
  assert.equal(urban.city.lat, source.city.lat);
  assert.equal(urban.city.lon, source.city.lon);
  const largestRoof = urban.features.filter(feature => feature.kind === 'building').reduce((largest, feature) => feature.area > largest.area ? feature : largest);
  assert.ok(largestRoof.area > 0);
  const intervals = rainIntervals(source), result = waterBalance(source, largestRoof, integrationSettings);
  assert.ok(intervals.available, `${source.city.id}: ${intervals.reason}`);
  assert.ok(result.available, `${source.city.id}: ${result.reason}`);
  assert.equal(intervals.rows.length, 24);
  assert.equal(result.rows.length, 24);
  const targetDate = new Date(source.weather!.current.time.slice(0, 10) + 'T00:00:00Z');
  targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  const expectedDate = targetDate.toISOString().slice(0, 10), expectedStart = expectedDate + 'T00:00';
  targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  const expectedEnd = targetDate.toISOString().slice(0, 10) + 'T00:00';
  assert.equal(result.date, expectedDate);
  assert.equal(intervals.rows[0].time, expectedDate + 'T01:00');
  assert.equal(intervals.rows[23].time, expectedEnd);
  const rawIndices = source.weather!.hourly.time.map((time, i) => ({time, i})).filter(({time}) => time > expectedStart && time <= expectedEnd);
  assert.equal(rawIndices.length, 24);
  assert.deepEqual(intervals.rows.map(row => row.time), rawIndices.map(({time}) => time));
  const rawRainMm = rawIndices.reduce((total, {i}) => total + Number(source.weather!.hourly.rain[i]) + Number(source.weather!.hourly.showers[i]), 0);
  if (rawRainMm > 0) wetCaptures++;
  const rawRoofRunoff = rawRainMm * largestRoof.area * integrationSettings.runoffCoefficient / 1000;
  close(result.catchmentAreaM2!, largestRoof.area);
  close(result.totals!.rainMm, rawRainMm);
  close(result.totals!.baselineRelease, rawRoofRunoff);
  close(result.totals!.inflow, rawRoofRunoff * integrationSettings.connectedFraction);
  close(result.totals!.bypass, rawRoofRunoff * (1 - integrationSettings.connectedFraction));
  close(integrationSettings.initialStorageM3 + rawRoofRunoff,
    result.totals!.storage + result.totals!.reuse + result.totals!.afterRelease);
  close(integrationSettings.initialStorageM3 + rawRoofRunoff * integrationSettings.connectedFraction,
    result.totals!.storage + result.totals!.reuse + result.totals!.overflow);
  close(result.totals!.reuse + result.totals!.unserved, integrationSettings.dailyDemandM3);
  close(result.totals!.afterRelease, result.totals!.bypass + result.totals!.overflow);
  close(result.totals!.retained, rawRoofRunoff - result.totals!.afterRelease);
  close(result.residual!, 0);
  assert.ok(result.rows.every(row => row.storage! >= 0 && row.storage! <= integrationSettings.capacityM3));
  assert.equal(JSON.stringify(source), sourceBefore, 'Modeling cannot change the source response or its date');
  assert.equal(JSON.stringify(urban), urbanBefore, 'Modeling cannot change the original mapped geometry');
  assert.equal(fs.readFileSync(`public/urban/${source.city.id}.json`, 'utf8'), urbanRaw);
}
assert.equal(fs.readFileSync(freshFile, 'utf8'), freshRaw, 'Integration checks leave the authentic capture bytes intact');

const receiptSource = fresh.data.find(source => source.city.id === 'singapore')!;
const receiptUrban = JSON.parse(fs.readFileSync('public/urban/singapore.json', 'utf8')) as UrbanData;
const selectedRoof = receiptUrban.features.filter(feature => feature.kind === 'building').reduce((largest, feature) => feature.area > largest.area ? feature : largest);
const receiptResult = waterBalance(receiptSource, selectedRoof, integrationSettings);
const identity = {kind: 'rainwater', version: WATER_MODEL_VERSION, date: receiptResult.date,
  weatherDigest: await digest(receiptSource.weather), geometryDigest: await digest({city: receiptUrban.city, selectedRoof}),
  settingsDigest: await digest(integrationSettings)};
const waterReceipt = await makeReceipt({schema: 'terratrace-rainwater-v1', modelVersion: WATER_MODEL_VERSION,
  observationIdentity: identity, source: receiptSource, urban: receiptUrban, selectedRoof,
  settings: integrationSettings, results: receiptResult}, identity);
const roundtrip = JSON.parse(JSON.stringify(waterReceipt));
assert.ok((await verifyReceipt(roundtrip)).valid);
assert.equal(roundtrip.payload.modelVersion, WATER_MODEL_VERSION);
assert.equal(roundtrip.payload.source.retrievedAt, receiptSource.retrievedAt);
assert.equal(roundtrip.payload.urban.osmTime, receiptUrban.osmTime);
assert.deepEqual(roundtrip.payload.selectedRoof, selectedRoof);
assert.deepEqual(roundtrip.payload.settings, integrationSettings);
assert.deepEqual(roundtrip.payload.results, receiptResult);
for (const mutate of [
  (payload: typeof roundtrip.payload) => { payload.settings.connectedFraction = .5; },
  (payload: typeof roundtrip.payload) => { payload.selectedRoof.area += 1; },
  (payload: typeof roundtrip.payload) => { payload.source.weather.hourly.rain[25] += 1; },
  (payload: typeof roundtrip.payload) => { payload.source.retrievedAt = '2020-01-01T00:00:00Z'; },
  (payload: typeof roundtrip.payload) => { payload.modelVersion = 'unrecorded-model-version'; },
]) {
  const altered = structuredClone(waterReceipt);
  mutate(altered.payload);
  assert.equal((await verifyReceipt(altered)).valid, false, 'Changed water evidence must fail verification');
}
console.log(`PASS: 8 authentic rainfall captures (${wetCaptures} wet forecast days), real largest-roof geometry, exact full-day endpoints, source URLs/units/timing, independent mass balance, no input/file mutation, water receipt round-trip and source/geometry/assumption/version tampering.`);
