import type {RainEnsemble,StudyArea,WaterSettings,WaterRun} from './campus-types';
import {runForecast} from './campus-water';
export type FlexibleTask={volumeM3:number;earliestHour:number;latestHour:number;baselineHour:number};
export type TimingOutcome={hour:number;timeUTC:string;medianOverflowM3:number;medianUnservedM3:number;medianReuseM3:number;noWorseInEveryMember:boolean};
export type OperationComparison={schema:'terratrace-flexible-use-v1';task:FlexibleTask;baseline:TimingOutcome|null;suggested:TimingOutcome|null;alternatives:TimingOutcome[];memberCount:number;available:boolean;reason?:string};
const median=(values:number[])=>{const sorted=values.slice().sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length?sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2:0};
/** Compare timing of the same additional, already-planned use. No water is discharged to create room. */
export function compareFlexibleUse(study:StudyArea,ensemble:RainEnsemble,settings:WaterSettings,task:FlexibleTask):OperationComparison{
 const empty:OperationComparison={schema:'terratrace-flexible-use-v1',task,baseline:null,suggested:null,alternatives:[],memberCount:0,available:false};
 if(!Number.isFinite(task.volumeM3)||task.volumeM3<0||task.volumeM3>1000)return {...empty,reason:'The planned task volume must be between 0 and 1,000 m³.'};
 for(const index of [task.earliestHour,task.latestHour,task.baselineHour])if(!Number.isInteger(index)||index<0||index>=ensemble.timesUTC.length)return {...empty,reason:'Task timings must lie within complete forecast hours.'};
 if(task.earliestHour>task.latestHour||task.baselineHour<task.earliestHour||task.baselineHour>task.latestHour)return {...empty,reason:'The existing task time must lie within its permitted rescheduling window.'};
 if(task.latestHour-task.earliestHour>48)return {...empty,reason:'Compare a permitted window of at most 48 hours.'};
 const simulate=(hour:number)=>{const demand=ensemble.timesUTC.map((_,i)=>settings.dailyDemandM3/24+(i===hour?task.volumeM3:0));return runForecast(study,ensemble,settings,demand).runs.filter(r=>r.available)};
 const baselineRuns=simulate(task.baselineHour);if(!baselineRuns.length)return {...empty,reason:'No complete forecast members can evaluate this task.'};
 const outcome=(hour:number,runs:WaterRun[]):TimingOutcome=>({hour,timeUTC:ensemble.timesUTC[hour],medianOverflowM3:median(runs.map(r=>r.overflowM3)),medianUnservedM3:median(runs.map(r=>r.demandM3-r.reuseM3)),medianReuseM3:median(runs.map(r=>r.reuseM3)),noWorseInEveryMember:runs.length===baselineRuns.length&&runs.every((r,i)=>r.reuseM3>=baselineRuns[i].reuseM3-1e-8)});
 const baseline=outcome(task.baselineHour,baselineRuns),alternatives:TimingOutcome[]=[];
 for(let hour=task.earliestHour;hour<=task.latestHour;hour++)alternatives.push(hour===task.baselineHour?baseline:outcome(hour,simulate(hour)));
 const eligible=alternatives.filter(a=>a.noWorseInEveryMember).sort((a,b)=>a.medianUnservedM3-b.medianUnservedM3||a.medianOverflowM3-b.medianOverflowM3||Math.abs(a.hour-task.baselineHour)-Math.abs(b.hour-task.baselineHour));
 return {...empty,available:true,baseline,suggested:eligible[0]??baseline,alternatives,memberCount:baselineRuns.length};
}
