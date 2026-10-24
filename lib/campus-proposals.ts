import {z} from 'zod';
import type {CampusScenario,RainArchive,RainEnsemble,StudyArea} from './campus-types';
import type {PlanTargets,PlannerResult} from './campus-planner';
import {localDepartureToUTC} from './campus-shade';

export type CampusCostEvidence={source:string;kind:'assumed'|'quoted'};
export type CampusPlanningEvidence={schema:'terratrace-campus-planning-evidence-v1';scenario:CampusScenario;targets:PlanTargets;result:PlannerResult;selectedCandidateId:string;costEvidence:CampusCostEvidence};
export type CampusPlanningDecision={scenario:CampusScenario;evidence:CampusPlanningEvidence};
export type SavedCampusPlan={schema:'terratrace-campus-saved-plan-v1';id:string;title:string;createdAt:string;study:StudyArea;archive:RainArchive;ensemble:RainEnsemble|null;scenario:CampusScenario;targets:PlanTargets;costEvidence?:CampusCostEvidence;planningDecision?:CampusPlanningDecision|null};
const text=z.string().max(4000),id=z.string().min(1).max(200),finite=z.number().finite();
const positive=finite.positive(),nonnegative=finite.nonnegative(),fraction=finite.min(0).max(1);
const date=z.string().refine(s=>Number.isFinite(Date.parse(s)),'Invalid date');
const point=z.object({x:finite.min(-10000).max(10000),z:finite.min(-10000).max(10000)});
const polygon=z.array(point).min(3).max(10000);
const source=z.object({id,title:text,url:z.string().url().refine(s=>/^https?:\/\//.test(s)),license:text,attribution:text,retrievedAt:date,observedAt:text.optional(),kind:z.enum(['observed','mapped','derived','forecast','assumed']),notes:z.array(text).max(200)});
const studySchema=z.object({schema:z.literal('terratrace-campus-study-v1'),id,name:text,subtitle:text,center:z.object({lat:finite.min(-90).max(90),lon:finite.min(-180).max(180)}),timezone:text,radiusM:positive.max(10000),bounds:z.tuple([finite,finite,finite,finite]),retrievedAt:date,sources:z.array(source).min(1).max(100),
 buildings:z.array(z.object({id,osmId:finite,name:text,polygon,holes:z.array(polygon).max(100).optional(),areaM2:positive.max(1e8),heightM:positive.max(1000),heightSource:z.enum(['mapped','floors','assumed','lidar']),tags:z.record(text)})).min(1).max(10000),
 trees:z.array(z.object({id,x:finite,z:finite,heightM:positive.max(200),crownRadiusM:positive.max(100),dimensionsSource:z.enum(['recorded','lidar','assumed']),sourceId:id})).max(30000),
 greenAreas:z.array(z.object({id,polygon,name:text})).max(10000),
 graph:z.object({sourceId:id,nodes:z.array(z.object({id,x:finite,z:finite})).min(1).max(100000),edges:z.array(z.object({id,from:id,to:id,lengthM:positive,wayId:finite,steps:z.boolean(),name:text.optional()})).max(200000)}),
 destinations:z.array(z.object({id,name:text,nodeId:id,x:finite,z:finite,kind:z.enum(['campus','transit','community'])})).min(2).max(100),
 shadeSites:z.array(z.object({id,label:text,type:z.enum(['sail','tree']),x:finite,z:finite,widthM:positive.max(100),depthM:positive.max(100),heightM:positive.max(100),crownRadiusM:nonnegative.max(100),rotation:finite,surveyed:z.boolean()})).max(100),
 defaultRoofIds:z.array(id).max(3),coverage:z.object({lidar:z.boolean(),trees:z.enum(['partial','unavailable']),notes:z.array(text).max(200)})});
const archiveSchema=z.object({schema:z.literal('terratrace-rain-archive-v1'),source,station:z.object({id,name:text,lat:finite,lon:finite,distanceKm:nonnegative}),unit:z.literal('mm'),periodSeconds:z.literal(86400),readings:z.array(z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),valueMm:nonnegative.nullable(),quality:text,completeness:text.nullable()})).max(50000),acceptedYears:z.array(z.number().int().min(1900).max(2100)).max(100)});
const ensembleSchema=z.object({schema:z.literal('terratrace-rain-ensemble-v1'),source,status:z.enum(['live','capture']),latitude:finite,longitude:finite,timesUTC:z.array(date).min(1).max(384),members:z.array(z.object({id,rainMm:z.array(nonnegative.nullable()).max(384)})).min(1).max(100)});
const scenarioSchema=z.object({water:z.object({roofs:z.array(z.object({buildingId:id,capacityM3:nonnegative.max(10000),connectedFraction:fraction,runoffCoefficient:fraction})).max(3),dailyDemandM3:nonnegative.max(1000),startingFillFraction:fraction}),shadeSiteIds:z.array(id).max(100),departureDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),departureHour:finite.int().min(0).max(23),speedMps:finite.min(.3).max(2.5),originId:id,destinationId:id});
const price=nonnegative.max(1e12).nullable();
const targetsSchema=z.object({waterCoverage:finite.min(0).max(100),sunReduction:finite.min(0).max(100),tankCostPerM3:price,shadeCostEach:price,budgetGBP:price});
const costSchema=z.object({source:text,kind:z.enum(['assumed','quoted'])});
const decisionSchema=z.object({scenario:scenarioSchema,evidence:z.object({schema:z.literal('terratrace-campus-planning-evidence-v1'),scenario:scenarioSchema,targets:targetsSchema,selectedCandidateId:id,costEvidence:costSchema,result:z.object({version:id,candidates:z.array(z.object({id})).max(20000),recommended:z.object({id}).nullable(),evaluated:nonnegative,waterOptions:nonnegative,shadeOptions:nonnegative,baselineSunMinutes:nonnegative.nullable()})})});
const planSchema=z.object({schema:z.literal('terratrace-campus-saved-plan-v1'),id,title:z.string().max(100),createdAt:date,study:studySchema,archive:archiveSchema,ensemble:ensembleSchema.nullable(),scenario:scenarioSchema,targets:targetsSchema,costEvidence:costSchema.optional(),planningDecision:decisionSchema.nullable().optional()});

/** Validate the bounded, portable proposal before rendering; retain its original raw snapshots. */
export function parseCampusPlan(value:unknown):SavedCampusPlan{
 const result=planSchema.safeParse(value);
 if(!result.success)throw Error('This campus proposal has missing or invalid fields. Use a complete proposal export; sealed evidence belongs in the passport verifier.');
 const plan=value as SavedCampusPlan,{study,scenario,ensemble}=plan;
 const unique=(values:string[])=>new Set(values).size===values.length;
 for(const items of [study.buildings,study.trees,study.graph.nodes,study.graph.edges,study.destinations,study.shadeSites])if(!unique(items.map(item=>item.id)))throw Error('The proposal contains duplicate mapped identifiers.');
 const nodes=new Set(study.graph.nodes.map(n=>n.id)),buildings=new Set(study.buildings.map(b=>b.id)),destinations=new Set(study.destinations.map(d=>d.id)),sites=new Set(study.shadeSites.map(s=>s.id));
 if(study.graph.edges.some(e=>!nodes.has(e.from)||!nodes.has(e.to))||study.destinations.some(d=>!nodes.has(d.nodeId)))throw Error('The proposal has a broken walking graph.');
 if(!destinations.has(scenario.originId)||!destinations.has(scenario.destinationId)||scenario.water.roofs.some(r=>!buildings.has(r.buildingId))||study.defaultRoofIds.some(id=>!buildings.has(id))||scenario.shadeSiteIds.some(id=>!sites.has(id)))throw Error('The proposal references assets outside its frozen study.');
 if(!unique(scenario.water.roofs.map(r=>r.buildingId))||!unique(scenario.shadeSiteIds)||new Set(plan.archive.acceptedYears).size!==plan.archive.acceptedYears.length)throw Error('The proposal contains duplicated selections.');
 if(study.buildings.reduce((n,b)=>n+b.polygon.length+(b.holes??[]).reduce((n,h)=>n+h.length,0),0)>500000)throw Error('The proposal exceeds the supported geometry size.');
 if(!localDepartureToUTC(scenario.departureDate,scenario.departureHour,study.timezone))throw Error('The proposal departure time is invalid or ambiguous in its time zone.');
 if(ensemble&&(!unique(ensemble.members.map(m=>m.id))||ensemble.members.some(m=>m.rainMm.length!==ensemble.timesUTC.length)||ensemble.timesUTC.some((t,i)=>i>0&&Date.parse(t)-Date.parse(ensemble.timesUTC[i-1])!==3600000)))throw Error('The proposal forecast has incomplete or inconsistent hourly intervals.');
 return plan;
}
