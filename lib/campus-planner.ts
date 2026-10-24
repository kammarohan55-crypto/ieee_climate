import type {CampusScenario,RainArchive,StudyArea,WaterSettings} from './campus-types';
import {runAnnual} from './campus-water';
import {compareRoutes} from './campus-shade';

export const PLANNER_VERSION='bounded-campus-portfolios-v1';
export const CAPACITIES=[0,1,2.5,5,10,25,50,100];
export type PlanTargets={waterCoverage:number;sunReduction:number;tankCostPerM3:number|null;shadeCostEach:number|null;budgetGBP:number|null};
export type CampusCandidate={id:string;capacities:number[];shadeSiteIds:string[];worstCoverage:number;meanReuseM3:number;meanOverflowM3:number;sunMinutes:number|null;sunReductionPercent:number|null;totalCapacityM3:number;interventions:number;costGBP:number|null;meetsTargets:boolean};
export type PlannerResult={version:string;candidates:CampusCandidate[];recommended:CampusCandidate|null;evaluated:number;waterOptions:number;shadeOptions:number;baselineSunMinutes:number|null;reason?:string};

export function capacityCombinations(count:number):number[][]{
 if(!Number.isInteger(count)||count<0||count>3)throw Error('Automatic comparison supports one to three roofs.');
 let result:number[][]=[[]];for(let i=0;i<count;i++)result=result.flatMap(row=>CAPACITIES.map(n=>[...row,n]));return result;
}
export function shadeCombinations(ids:string[]):string[][]{const sites=[...new Set(ids)].slice(0,6),result:string[][]=[[]];for(let i=0;i<sites.length;i++){result.push([sites[i]]);for(let j=i+1;j<sites.length;j++)result.push([sites[i],sites[j]])}return result}
function dominates(a:CampusCandidate,b:CampusCandidate){const checks=[a.worstCoverage>=b.worstCoverage-1e-8,(a.sunMinutes??Infinity)<=(b.sunMinutes??Infinity)+1e-8,a.totalCapacityM3<=b.totalCapacityM3,a.interventions<=b.interventions];if(a.costGBP!==null&&b.costGBP!==null)checks.push(a.costGBP<=b.costGBP);return checks.every(Boolean)&&(a.worstCoverage>b.worstCoverage+1e-8||(a.sunMinutes??Infinity)<(b.sunMinutes??Infinity)-1e-8||a.totalCapacityM3<b.totalCapacityM3||a.interventions<b.interventions||(a.costGBP!==null&&b.costGBP!==null&&a.costGBP<b.costGBP))}
export function paretoCandidates(input:CampusCandidate[]){const frontier:CampusCandidate[]=[];for(const candidate of input){if(frontier.some(p=>dominates(p,candidate)))continue;for(let i=frontier.length-1;i>=0;i--)if(dominates(candidate,frontier[i]))frontier.splice(i,1);const equivalent=frontier.some(p=>Math.abs(p.worstCoverage-candidate.worstCoverage)<1e-8&&Math.abs((p.sunMinutes??0)-(candidate.sunMinutes??0))<1e-8&&p.totalCapacityM3===candidate.totalCapacityM3&&p.interventions===candidate.interventions&&p.costGBP===candidate.costGBP);if(!equivalent)frontier.push(candidate)}return frontier.sort((a,b)=>a.interventions-b.interventions||a.totalCapacityM3-b.totalCapacityM3||b.worstCoverage-a.worstCoverage)}

/** Exact enumeration of the declared bounded candidate set, not a global installation optimum. */
export function planPortfolios(study:StudyArea,archive:RainArchive,scenario:CampusScenario,targets:PlanTargets,progress?:(value:number)=>void):PlannerResult{
 if(!scenario.water.roofs.length||scenario.water.roofs.length>3)return {version:PLANNER_VERSION,candidates:[],recommended:null,evaluated:0,waterOptions:0,shadeOptions:0,baselineSunMinutes:null,reason:'Select one to three roofs before comparing projects.'};
 for(const n of [targets.waterCoverage,targets.sunReduction])if(!Number.isFinite(n)||n<0||n>100)throw Error('Targets must be between 0 and 100%.');
 for(const n of [targets.tankCostPerM3,targets.shadeCostEach,targets.budgetGBP])if(n!==null&&(!Number.isFinite(n)||n<0))throw Error('Cost estimates cannot be negative.');
 const baseline=compareRoutes(study,{...scenario,shadeSiteIds:[]},false),baselineSunMinutes=baseline.shadiest?.sunMinutes??null;
 const combinations=capacityCombinations(scenario.water.roofs.length);
 const waterOptions=combinations.map((capacities,index)=>{const settings:WaterSettings={...scenario.water,startingFillFraction:0,roofs:scenario.water.roofs.map((r,i)=>({...r,capacityM3:capacities[i]}))};const runs=archive.acceptedYears.map(year=>runAnnual(study,archive,settings,year));if(index%32===0)progress?.(Math.round(index/combinations.length*45));return {capacities,runs,totalCapacityM3:capacities.reduce((a,b)=>a+b,0),count:capacities.filter(n=>n>0).length}}).filter(option=>option.runs.length>0&&option.runs.every(r=>r.available));
 if(!waterOptions.length)return {version:PLANNER_VERSION,candidates:[],recommended:null,evaluated:0,waterOptions:0,shadeOptions:0,baselineSunMinutes,reason:'No complete accepted rainfall years are available.'};
 const sites=shadeCombinations(study.shadeSites.filter(s=>s.type==='sail').map(s=>s.id));
 const shadeOptions=sites.map((ids,index)=>{progress?.(45+Math.round(index/sites.length*45));const route=ids.length?compareRoutes(study,{...scenario,shadeSiteIds:ids},true):baseline;const sunMinutes=route.shadiest?.sunMinutes??null;return {ids,sunMinutes,reduction:baselineSunMinutes!==null&&sunMinutes!==null?baselineSunMinutes>1e-8?Math.max(0,(baselineSunMinutes-sunMinutes)/baselineSunMinutes*100):0:null}});
 const all:CampusCandidate[]=[];let evaluated=0;
 for(const w of waterOptions)for(const s of shadeOptions){evaluated++;const worstCoverage=Math.min(...w.runs.map(r=>r.coveragePercent));const waterCost=w.totalCapacityM3===0?0:targets.tankCostPerM3===null?null:w.totalCapacityM3*targets.tankCostPerM3,shadeCost=!s.ids.length?0:targets.shadeCostEach===null?null:s.ids.length*targets.shadeCostEach,costGBP=waterCost===null||shadeCost===null?null:waterCost+shadeCost;
  if(targets.budgetGBP!==null&&(costGBP===null||costGBP>targets.budgetGBP))continue;
  all.push({id:`portfolio-${w.capacities.join('-')}-${s.ids.join('-')||'none'}`,capacities:w.capacities,shadeSiteIds:s.ids,worstCoverage,meanReuseM3:w.runs.reduce((a,r)=>a+r.reuseM3,0)/w.runs.length,meanOverflowM3:w.runs.reduce((a,r)=>a+r.overflowM3,0)/w.runs.length,sunMinutes:s.sunMinutes,sunReductionPercent:s.reduction,totalCapacityM3:w.totalCapacityM3,interventions:w.count+s.ids.length,costGBP,meetsTargets:worstCoverage>=targets.waterCoverage&&(targets.sunReduction===0||(s.reduction!==null&&s.reduction>=targets.sunReduction))});
 }
 const frontier=paretoCandidates(all),qualifying=frontier.filter(c=>c.meetsTargets).sort((a,b)=>a.interventions-b.interventions||a.totalCapacityM3-b.totalCapacityM3||b.worstCoverage-a.worstCoverage);progress?.(100);
 return {version:PLANNER_VERSION,candidates:frontier,recommended:qualifying[0]??null,evaluated,waterOptions:waterOptions.length,shadeOptions:shadeOptions.length,baselineSunMinutes,reason:qualifying.length?undefined:all.length?'No evaluated portfolio meets both targets. The frontier shows the remaining tradeoffs.':'No portfolio fits the supplied budget and cost evidence.'};
}
