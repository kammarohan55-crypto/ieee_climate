import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCampusPlan} from '../lib/campus-proposals';
const json=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const study=json('public/campus/study.json'),archive=json('public/campus/rainfall.json'),ensemble=json('public/campus/forecast.json');
const plan={schema:'terratrace-campus-saved-plan-v1',id:'test-proposal',title:'Portable campus test',createdAt:'2026-10-13T10:00:00Z',study,archive,ensemble,scenario:{water:{roofs:study.defaultRoofIds.map((buildingId:string)=>({buildingId,capacityM3:10,connectedFraction:.8,runoffCoefficient:.8})),dailyDemandM3:1,startingFillFraction:0},shadeSiteIds:[],departureDate:'2026-07-15',departureHour:12,speedMps:1.2,originId:study.destinations[0].id,destinationId:study.destinations[1].id},targets:{waterCoverage:50,sunReduction:20,tankCostPerM3:null,shadeCostEach:null,budgetGBP:null}};
assert.equal(parseCampusPlan(plan),plan,'Keep the exact frozen raw sources, without stripping provenance');
for(const key of ['trees','sources','shadeSites','destinations','greenAreas']){const altered=structuredClone(plan);delete altered.study[key];assert.throws(()=>parseCampusPlan(altered),/missing or invalid/)}
const broken=structuredClone(plan);broken.study.graph.edges[0].to='missing-node';assert.throws(()=>parseCampusPlan(broken),/broken walking graph/);
const roof=structuredClone(plan);roof.scenario.water.roofs[0].buildingId='outside-study';assert.throws(()=>parseCampusPlan(roof),/outside its frozen study/);
const duplicate=structuredClone(plan);duplicate.scenario.water.roofs.push(duplicate.scenario.water.roofs[0]);assert.throws(()=>parseCampusPlan(duplicate));
const forecast=structuredClone(plan);forecast.ensemble.timesUTC[1]=forecast.ensemble.timesUTC[0];assert.throws(()=>parseCampusPlan(forecast),/inconsistent hourly/);
const ambiguous=structuredClone(plan);ambiguous.scenario.departureDate='2026-10-25';ambiguous.scenario.departureHour=1;assert.throws(()=>parseCampusPlan(ambiguous),/invalid or ambiguous/);
const url=structuredClone(plan);url.study.sources[0].url='javascript:alert(1)';assert.throws(()=>parseCampusPlan(url),/invalid fields/);
console.log('PASS: frozen proposal sources preserved; malformed imports, missing arrays, invalid graph/assets, duplicate selections, ambiguous local departure and inconsistent intervals rejected.');
