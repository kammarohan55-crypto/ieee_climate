import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {assertDemandBenchmark,demandFeatures,evaluateDemandRows,parseDailyDemandCsv,predictDemand,type DemandBenchmark} from '../lib/campus-demand';

const artifact=JSON.parse(fs.readFileSync('public/campus-demand/benchmark.json','utf8')) as DemandBenchmark;
assertDemandBenchmark(artifact);
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-9*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
assert.equal(artifact.source.clippedSourceSha256,'0x'+createHash('sha256').update(fs.readFileSync('public/campus-demand/water-three-buildings.csv')).digest('hex'));
assert.equal(artifact.split.trainEnd,'2016-09-30');assert.equal(artifact.split.validationEnd,'2016-12-31');assert.equal(artifact.split.testStart,'2017-01-01');
assert.equal(artifact.parameters.randomSeed,42);assert.equal(artifact.source.license.includes('BY-SA'),true);
const dates=artifact.buildings[0].test.rows.map(row=>row.date);
for(const building of artifact.buildings){
 assert.equal(building.dataQuality.completeDays2016,366);assert.equal(building.dataQuality.completeDays2017,357);assert.equal(building.test.rows.length,331);
 assert.deepEqual(building.test.rows.map(row=>row.date),dates,'All declared reference buildings use the common eligible source dates');
 assert.ok(building.validation.rows.every(row=>row.date>artifact.split.trainEnd&&row.date<=artifact.split.validationEnd));
 assert.ok(building.test.rows.every(row=>row.date>=artifact.split.testStart));
 for(const fixture of building.parityFixtures){const features=demandFeatures(building,fixture.date)!;assert.ok(features);features.forEach((value,index)=>close(value,fixture.features[index]));const prediction=predictDemand(building,features);close(prediction.medianM3,fixture.expected.medianM3);close(prediction.lowerM3,fixture.expected.lowerM3);close(prediction.upperM3,fixture.expected.upperM3);}
 // Every stored test forecast must replay from the same tree artifacts, not just a few showcased dates.
 for(const row of building.test.rows){const prediction=predictDemand(building,demandFeatures(building,row.date)!);close(prediction.medianM3,row.medianM3);close(prediction.lowerM3,row.lowerM3);close(prediction.upperM3,row.upperM3);}
 const recomputed=evaluateDemandRows(building.test.rows);close(recomputed.model.maeM3,building.test.metrics.model.maeM3);close(recomputed.model.wapePercent!,building.test.metrics.model.wapePercent!);close(recomputed.intervalCoveragePercent,building.test.metrics.intervalCoveragePercent);assert.equal(recomputed.beatsBestBaseline,building.test.metrics.beatsBestBaseline);
 const date=building.test.rows[100].date,features=demandFeatures(building,date)!;
 const future=structuredClone(building);for(const day of future.daily)if(day.date>=date)day.valueM3=999999;
 assert.deepEqual(demandFeatures(future,date),features,'The target and future readings cannot enter the features');
 const missing=structuredClone(building),previous=new Date(Date.parse(date)-86400000).toISOString().slice(0,10);missing.daily.find(row=>row.date===previous)!.valueM3=null;
 assert.equal(demandFeatures(missing,date),null,'A missing preceding day must invalidate the lag window');
 assert.equal(demandFeatures(building,'2017-02-30'),null);
}
assert.equal(artifact.buildings.find(b=>b.alias==='Quintin')!.test.metrics.beatsBestBaseline,false,'A failing model must not be labeled superior');
const inspected=parseDailyDemandCsv('date,volume_m3\n2026-10-01,1.2\n2026-10-02,\n2026-10-04,0\n');assert.equal(inspected.validDays,2);assert.equal(inspected.missingDays,2);assert.equal(inspected.rows[1].volumeM3,null);
assert.throws(()=>parseDailyDemandCsv('date,volume_m3\n2026-02-30,1'),/valid ISO/);
assert.throws(()=>parseDailyDemandCsv('date,volume_m3\n2026-01-01,1\n2026-01-01,2'),/Duplicate/);
assert.throws(()=>parseDailyDemandCsv('date,volume_m3\n2026-01-01,-1'),/nonnegative/);
assert.throws(()=>parseDailyDemandCsv('date,kwh\n2026-01-01,1'),/exact header/);
console.log('Campus demand: source hash, chronological splits, common samples, all browser/Python prediction parity, leakage, coverage, and CSV quality checks passed.');
