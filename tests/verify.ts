import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dayHours,nextHours,planSolar} from '../lib/climate';
import {isolationScores} from '../lib/intelligence';
import {canonical,makeReceipt,verifyReceipt} from '../lib/proof';
const {data}=JSON.parse(fs.readFileSync('public/reference-data.json','utf8').replace(/^\uFEFF/,''));
for(const d of data){const day=dayHours(d,1);assert.equal(day.length,24);assert.equal(day[0].label,'01:00');assert.equal(day[23].label,'00:00');assert.ok(day[0].time.slice(0,10)>d.weather.current.time.slice(0,10));assert.ok(nextHours(d).every(h=>h.time>=d.weather.current.time));const p=planSolar(day,5,.8,2,3,18);assert.ok(p.complete);assert.ok(p.bestMatched>=p.baselineMatched);assert.ok(p.bestMatched<=6);assert.ok(p.total>=0);assert.ok(p.bestStart<=21);}
const template=dayHours(data[0],1);const artificial=template.map((h,i)=>({...h,irradiance:i>=10&&i<13?1000:0}));const plan=planSolar(artificial,5,.8,2,3,18);assert.equal(plan.bestStart,10);assert.equal(plan.bestMatched,6);assert.equal(plan.gain,6);assert.equal(plan.total,12);
assert.equal(planSolar(artificial.map((h,i)=>i===0?{...h,irradiance:null}:h),5,.8,2,3,18).complete,false);
const missingNextMidnight={...data[0],weather:{...data[0].weather,hourly:{...data[0].weather.hourly,time:data[0].weather.hourly.time.filter((t:string)=>t!==template[23].time)}}};assert.equal(dayHours(missingNextMidnight,1).length,23);
assert.equal(canonical({b:1,a:{z:2,y:3}}),canonical({a:{y:3,z:2},b:1}));
const identity={provider:'test',location:[0,0],time:'2026-10-08T12:00'};const r=await makeReceipt({observationIdentity:identity,value:12,unit:'W/m²'},identity);assert.equal((await verifyReceipt(r)).valid,true);
for(const change of [{...r,payload:{...r.payload,value:13}},{...r,payload:{...r.payload,unit:'kW/m²'}},{...r,observationId:'0x'+'00'.repeat(32)}])assert.equal((await verifyReceipt(change)).valid,false);
const pts=Array.from({length:50},(_,i)=>[Math.sin(i)*.1,Math.cos(i)*.1]);pts.push([10,10]);const scores=isolationScores(pts);assert.ok(scores[50]>Math.max(...scores.slice(0,50)));assert.deepEqual(scores,isolationScores(pts));
console.log('PASS: 8 real-data fixtures, local-day boundaries, future intervals, solar optimization, missing values, canonical hashing, payload tamper detection, identity tamper detection, reproducible ML outliers.');
