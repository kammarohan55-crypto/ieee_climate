import assert from 'node:assert/strict';
import fs from 'node:fs';
import {capacitySweep,runAnnual,runForecast,validateRainEnsemble} from '../lib/campus-water';
import type {RainArchive,RainEnsemble,StudyArea,WaterRun,WaterSettings} from '../lib/campus-types';
import {normalizeCampusBuildings,polygonArea,type OsmBuildingElement} from '../scripts/capture-campus-geometry';

const study:StudyArea={schema:'terratrace-campus-study-v1',id:'unit-test',name:'Synthetic unit-test study',subtitle:'Only for tests',center:{lat:0,lon:0},timezone:'UTC',radiusM:800,bounds:[-1,-1,1,1],retrievedAt:'2026-10-13T00:00:00Z',sources:[],buildings:[{id:'one',osmId:1,name:'Test roof',polygon:[{x:0,z:0},{x:10,z:0},{x:10,z:100},{x:0,z:100}],areaM2:1000,heightM:10,heightSource:'assumed',tags:{}},{id:'two',osmId:2,name:'Test roof 2',polygon:[],areaM2:2000,heightM:10,heightSource:'assumed',tags:{}}],trees:[],greenAreas:[],graph:{nodes:[],edges:[],sourceId:'test'},destinations:[],shadeSites:[],defaultRoofIds:['one'],coverage:{lidar:false,trees:'unavailable',notes:[]}};
const source={id:'test',title:'Synthetic test inputs',url:'https://example.test',license:'test',attribution:'test',retrievedAt:'2026-10-13T00:00:00Z',kind:'observed' as const,notes:[]};
const settings:WaterSettings={roofs:[{buildingId:'one',capacityM3:5,connectedFraction:1,runoffCoefficient:1}],dailyDemandM3:1,startingFillFraction:0};
const archive=(year:number,rain=1):RainArchive=>({schema:'terratrace-rain-archive-v1',source,station:{id:'test',name:'Test',lat:0,lon:0,distanceKm:0},unit:'mm',periodSeconds:86400,readings:Array.from({length:(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000},(_,i)=>({date:new Date(Date.UTC(year,0,1+i)).toISOString().slice(0,10),valueMm:rain,quality:'Good',completeness:'Complete'})),acceptedYears:[year],raw:{}});
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const balance=(run:WaterRun)=>{assert.ok(run.available,run.reason);near(run.initialStorageM3+run.inflowM3,run.endingStorageM3+run.overflowM3+run.reuseM3);let previous=run.initialStorageM3;for(const step of run.steps){near(previous+step.inflowM3,step.storageM3+step.reuseM3+step.overflowM3);assert.ok(step.storageM3>=0);previous=step.storageM3;}near(run.demandM3,run.reuseM3+run.steps.reduce((s,row)=>s+row.unservedM3,0));};

// Source-normalization fixture: one relation, two disjoint outer roofs, and one actual courtyard.
const rectangle=(x:number,z:number,width:number,depth:number)=>[{lat:z,lon:x},{lat:z,lon:x+width},{lat:z+depth,lon:x+width},{lat:z+depth,lon:x},{lat:z,lon:x}];
const geometryFixture:OsmBuildingElement[]=[{type:'way',id:100,tags:{building:'yes',height:'12'},geometry:rectangle(0,0,10,10)},{type:'relation',id:200,tags:{building:'yes',name:'Courtyard test building'},members:[{type:'way',ref:100,role:'outer',geometry:rectangle(0,0,10,10)},{type:'way',ref:101,role:'inner',geometry:rectangle(1,1,2,3).reverse()},{type:'way',ref:102,role:'outer',geometry:rectangle(20,0,5,5)}]},{type:'way',id:300,tags:{building:'yes'},geometry:rectangle(40,0,5,5).slice(0,-1)}];
const normalized=normalizeCampusBuildings(geometryFixture,(lat,lon)=>({x:lon,z:lat}));assert.equal(normalized.buildings.length,2);assert.equal(normalized.removedDuplicates,1);assert.equal(normalized.unclosedOuterRings,1);assert.equal(normalized.courtyardCount,1);near(normalized.courtyardAreaM2,6);
const courtyard=normalized.buildings.find(building=>building.id==='osm-relation-200-outer-100')!;near(courtyard.areaM2,94);assert.equal(courtyard.holes?.length,1);assert.equal(courtyard.heightSource,'mapped');near(courtyard.heightM,12);assert.equal(courtyard.tags['terratrace:inner_ways'],'101');near(normalized.buildings.find(building=>building.id==='osm-relation-200-outer-102')!.areaM2,25);
const courtyardStudy={...study,buildings:[courtyard]};const courtyardRun=runAnnual(courtyardStudy,archive(2025,1),{...settings,roofs:[{...settings.roofs[0],buildingId:courtyard.id}]},2025);balance(courtyardRun);near(courtyardRun.inflowM3,365*.094);

const daily=runAnnual(study,archive(2025),settings,2025);balance(daily);near(daily.inflowM3,365);near(daily.reuseM3,365);near(daily.coveragePercent,100);
assert.equal(runAnnual(study,archive(2020),settings,2020).steps.length,366);
const empty=runAnnual(study,archive(2025,0),settings,2025);balance(empty);near(empty.reuseM3,0);near(empty.coveragePercent,0);
const full={...settings,startingFillFraction:1,roofs:[{...settings.roofs[0],capacityM3:1}]};
const overflow=runAnnual(study,archive(2025),full,2025);balance(overflow);near(overflow.steps[0].overflowM3,1);near(overflow.steps[0].reuseM3,1);
const disconnected=runAnnual(study,archive(2025),{...settings,roofs:[{...settings.roofs[0],connectedFraction:0}]},2025);balance(disconnected);near(disconnected.inflowM3,0);near(disconnected.bypassM3,365);near(disconnected.reuseM3,0);
const portfolio=runAnnual(study,archive(2025),{...settings,roofs:[settings.roofs[0],{...settings.roofs[0],buildingId:'two'}]},2025);balance(portfolio);near(portfolio.demandM3,365);near(portfolio.inflowM3,1095);
const invalid=archive(2025);invalid.readings[90].quality='Suspect';assert.equal(runAnnual(study,invalid,settings,2025).available,false);
const missing=archive(2025);missing.readings[0].valueMm=null;assert.equal(runAnnual(study,missing,settings,2025).available,false);
const gap=archive(2025);gap.readings.splice(50,1);assert.equal(runAnnual(study,gap,settings,2025).available,false);
const duplicate=archive(2025);duplicate.readings[1]=duplicate.readings[0];assert.equal(runAnnual(study,duplicate,settings,2025).available,false);
assert.equal(runAnnual(study,archive(2025),settings,2024).available,false);
assert.equal(runAnnual(study,archive(2025),{...settings,roofs:[settings.roofs[0],settings.roofs[0]]},2025).available,false);
assert.equal(runAnnual(study,archive(2025),{...settings,dailyDemandM3:NaN},2025).available,false);

const times=Array.from({length:72},(_,i)=>new Date(Date.UTC(2026,9,24,i)).toISOString().slice(0,16));
const raw={latitude:51.5,longitude:-.1,utc_offset_seconds:0,hourly_units:{time:'iso8601',rain:'mm',showers:'mm',rain_member01:'mm',showers_member01:'mm',rain_member02:'mm',showers_member02:'mm'},hourly:{time:times,rain:Array(72).fill(1),showers:Array(72).fill(.5),rain_member01:Array(72).fill(0),showers_member01:Array(72).fill(0),rain_member02:Array(72).fill(3),showers_member02:Array(72).fill(0),snowfall:Array(72).fill(200)}};
const ensemble=validateRainEnsemble(raw,'2026-10-24T00:00:00Z');assert.equal(ensemble.members.length,3);near(ensemble.members[0].rainMm[0]!,1.5);assert.ok(ensemble.timesUTC.every(time=>time.endsWith('Z')));
const forecast=runForecast(study,ensemble,settings);assert.equal(forecast.runs.length,3);forecast.runs.forEach(balance);assert.ok(forecast.runs.includes(forecast.median!));near(forecast.median!.inflowM3,108);near(forecast.median!.demandM3,3);assert.ok(forecast.spread.every(point=>point.p10<=point.p50&&point.p50<=point.p90));
const nullMember=structuredClone(ensemble);nullMember.members[1].rainMm[0]=null;assert.equal(runForecast(study,nullMember,settings).rejected,1);
const profile=Array(72).fill(0);profile[24]=2;const changed=runForecast(study,ensemble,settings,profile);changed.runs.forEach(balance);near(changed.median!.demandM3,2);
assert.equal(runForecast(study,ensemble,settings,[1]).runs.length,0);
assert.equal(runForecast(study,ensemble,settings,Array(72).fill(-1)).runs.length,0);
const badHours=structuredClone(ensemble);badHours.timesUTC[1]=badHours.timesUTC[0];assert.equal(runForecast(study,badHours,settings).runs.length,0);
assert.throws(()=>validateRainEnsemble({...raw,utc_offset_seconds:3600}));
const badUnits=structuredClone(raw);badUnits.hourly_units.rain='inch';const unitsResult=validateRainEnsemble(badUnits);assert.equal(unitsResult.members.length,2);

const sweep=capacitySweep(study,archive(2025),{...settings,startingFillFraction:1});assert.equal(sweep[0].capacityM3,0);near(sweep[0].reuseM3,0);assert.equal(sweep.find(row=>row.capacityM3===5)!.worstCoverage,100);
for(let i=1;i<sweep.length;i++)assert.ok(sweep[i].reuseM3>=sweep[i-1].reuseM3-1e-8);

// Verify checked-in observations, not just synthetic fixtures.
const saved=JSON.parse(fs.readFileSync('public/campus/rainfall.json','utf8')) as RainArchive;
assert.deepEqual(saved.acceptedYears,[2018,2020,2025]);assert.equal(saved.readings.length,2922);assert.ok(Number.isFinite(saved.station.distanceKm));
for(const year of saved.acceptedYears)balance(runAnnual(study,saved,settings,year));
const savedForecast=JSON.parse(fs.readFileSync('public/campus/forecast.json','utf8')) as RainEnsemble;
assert.equal(savedForecast.members.length,31);assert.equal(savedForecast.timesUTC.length,72);runForecast(study,savedForecast,settings).runs.forEach(balance);
const savedStudy=JSON.parse(fs.readFileSync('public/campus/study.json','utf8')) as StudyArea;
assert.equal(savedStudy.coverage.lidar,false);assert.equal(new Set(savedStudy.buildings.map(b=>b.id)).size,savedStudy.buildings.length);assert.equal(savedStudy.defaultRoofIds.length,3);
assert.ok(savedStudy.defaultRoofIds.every(id=>savedStudy.buildings.some(b=>b.id===id&&(b.tags.building==='university'||['university','college'].includes(b.tags.amenity)))));
const rawGeometry=savedStudy.rawGeometry as {elements:(OsmBuildingElement&{nodes?:number[]})[]};const ways=new Map(rawGeometry.elements.filter(row=>row.type==='way').map(row=>[row.id,row]));
assert.equal(savedStudy.buildings.length,2867);assert.equal(savedStudy.buildings.reduce((sum,building)=>sum+(building.holes?.length??0),0),15);assert.ok(!savedStudy.buildings.some(building=>building.id==='osm-way-33756621'));
const innerSources=new Set(rawGeometry.elements.flatMap(element=>(element.members??[]).filter(member=>element.tags?.building&&member.role==='inner').map(member=>String(member.ref))));
const preservedInnerSources=new Set(savedStudy.buildings.flatMap(building=>building.tags['terratrace:inner_ways']?.split(',')??[]));assert.deepEqual([...preservedInnerSources].sort(),[...innerSources].sort());
for(const building of savedStudy.buildings){const netArea=polygonArea(building.polygon)-(building.holes??[]).reduce((sum,hole)=>sum+polygonArea(hole),0);assert.ok(Math.abs(building.areaM2-netArea)<=.005001,'Roof catchment excludes source courtyard holes.');}
const graphNodes=new Set(savedStudy.graph.nodes.map(node=>node.id)),adjacency=new Map<string,string[]>();
for(const edge of savedStudy.graph.edges){assert.ok(graphNodes.has(edge.from)&&graphNodes.has(edge.to));const way=ways.get(edge.wayId);assert.ok(way);assert.ok(way.nodes!.some((node,i)=>String(node)===edge.from&&String(way.nodes![i+1])===edge.to),'Edges preserve adjacent original nodes, without synthetic crossings.');assert.ok(!['private','no','destination'].includes(way.tags?.access??''));assert.ok(!['private','no','destination','use_sidepath'].includes(way.tags?.foot??''));for(const [a,b]of [[edge.from,edge.to],[edge.to,edge.from]]){if(!adjacency.has(a))adjacency.set(a,[]);adjacency.get(a)!.push(b);}}
const queue=[savedStudy.destinations[0].nodeId],visited=new Set(queue);for(let i=0;i<queue.length;i++)for(const node of adjacency.get(queue[i])??[])if(!visited.has(node)){visited.add(node);queue.push(node)}assert.ok(savedStudy.destinations.every(destination=>visited.has(destination.nodeId)),'Default destinations must share a real mapped graph component.');
assert.ok(savedStudy.shadeSites.every(site=>!site.surveyed));
assert.ok(savedStudy.trees.length>0);assert.equal(savedStudy.coverage.trees,'partial');const rawTrees=savedStudy.rawTreeRecords as {elements:{id:number;tags?:Record<string,string>}[]};const treeRecords=new Map(rawTrees.elements.map(row=>[`osm-tree-${row.id}`,row]));assert.ok(savedStudy.trees.every(tree=>treeRecords.get(tree.id)?.tags?.natural==='tree'));
console.log('Campus water and data verified: observed quality/coverage, mass balance, distributed demand, ensemble task timing, actual mapped geometry/trees, and connected source-only paths.');
