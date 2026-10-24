/** Browser inference for the frozen, public-building demand benchmark.
 * This module has no Python dependency and does not transplant US demand to London.
 */
export type DemandDay = {date:string;valueM3:number|null;validHours:number;expectedHours:number;status:'complete'|'incomplete'};
export type DemandPrediction = {medianM3:number;lowerM3:number;upperM3:number};
export type DemandRow = DemandPrediction & {date:string;actualM3:number;previousWeekM3:number;historicalWeekdayM3:number};
export type DemandError = {maeM3:number;wapePercent:number|null;biasM3:number};
export type DemandMetrics = {count:number;actualTotalM3:number;model:DemandError;previousWeek:DemandError;historicalWeekday:DemandError;intervalCoveragePercent:number;nominalIntervalPercent:number;beatsBestBaseline:boolean};
export type DemandTree = {left:number[];right:number[];feature:number[];threshold:number[];value:number[]};
export type DemandModel = {initial:number;learningRate:number;trees:DemandTree[]};
export type DemandBuilding = {
 id:string;alias:string;metadata:Record<string,string>;daily:DemandDay[];
 dataQuality:{completeDays2016:number;completeDays2017:number;excludedTestDays:number;exclusionPolicy:string};
 trainCount:number;weekdayMeansM3:number[];models:{lower:DemandModel;median:DemandModel;upper:DemandModel};
 validation:{metrics:DemandMetrics;rows:DemandRow[]};test:{metrics:DemandMetrics;rows:DemandRow[]};
 parityFixtures:{date:string;features:number[];expected:DemandPrediction}[];
};
export type DemandBenchmark = {
 schema:'terratrace-demand-benchmark-v1';modelVersion:string;
 source:{title:string;url:string;metadataUrl:string;commit:string;paper:string;unitReference:string;license:string;attribution:string;rawSourceSha256:string;clippedSourceSha256:string;metadataSourceSha256:string;retrievedAt:string;rawUnit:string;displayUnit:string;locationNote:string;notes:string[]};
 featureNames:string[];split:{trainStart:string;trainEnd:string;validationStart:string;validationEnd:string;testStart:string;testEnd:string;policy:string};
 parameters:{nEstimators:number;maxDepth:number;minSamplesLeaf:number;learningRate:number;randomSeed:number;quantiles:number[]};
 runtime:Record<string,string>;buildings:DemandBuilding[];
};
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
export function assertDemandBenchmark(value:unknown):asserts value is DemandBenchmark {
 if(!value||typeof value!=='object')throw Error('The demand benchmark is unavailable.');
 const data=value as DemandBenchmark;
 if(data.schema!=='terratrace-demand-benchmark-v1'||!Array.isArray(data.buildings)||data.buildings.length!==3||data.featureNames?.length!==11||!data.source?.clippedSourceSha256||data.split?.testStart!=='2017-01-01')throw Error('Unsupported demand benchmark format.');
 for(const building of data.buildings){
  if(!Array.isArray(building.daily)||!Array.isArray(building.test?.rows)||!building.test.rows.length)throw Error('Measured demand rows are missing.');
  for(const day of building.daily)if(!/^\d{4}-\d{2}-\d{2}$/.test(day.date)||(day.valueM3!==null&&(!finite(day.valueM3)||day.valueM3<0)))throw Error('A measured day is invalid.');
  if(!building.models?.lower||!building.models.median||!building.models.upper)throw Error('All three quantile models are required.');
  for(const model of Object.values(building.models)){
   if(!finite(model.initial)||!finite(model.learningRate)||!Array.isArray(model.trees)||model.trees.length!==data.parameters.nEstimators)throw Error('Model trees are incomplete.');
   for(const tree of model.trees)if(!tree.value.length||![tree.left,tree.right,tree.feature,tree.threshold].every(a=>a.length===tree.value.length)||tree.value.some(x=>!finite(x)))throw Error('A model tree is invalid.');
  }
 }
}
export async function loadDemandBenchmark(signal?:AbortSignal):Promise<DemandBenchmark>{
 const response=await fetch('/campus-demand/benchmark.json',{signal});
 if(!response.ok)throw Error('The measured-demand reference could not be loaded. Try again.');
 const data:unknown=await response.json();assertDemandBenchmark(data);return data;
}
export function demandFeatures(building:Pick<DemandBuilding,'daily'>,date:string):number[]|null{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 const timestamp=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==date)return null;
 const lookup=new Map(building.daily.map(day=>[day.date,day.valueM3]));
 const past=Array.from({length:7},(_,index)=>lookup.get(new Date(timestamp-(index+1)*86400000).toISOString().slice(0,10)));
 if(past.some(value=>value==null||!Number.isFinite(value)))return null;
 const values=past as number[],mean=values.reduce((a,b)=>a+b,0)/7,std=Math.sqrt(values.reduce((total,value)=>total+(value-mean)**2,0)/7);
 const d=new Date(timestamp),weekday=(d.getUTCDay()+6)%7,year=d.getUTCFullYear(),dayOfYear=(timestamp-Date.UTC(year,0,1))/86400000,days=year%4===0&&(year%100!==0||year%400===0)?366:365;
 return [values[0],values[1],values[6],mean,Math.min(...values),Math.max(...values),std,Math.sin(2*Math.PI*weekday/7),Math.cos(2*Math.PI*weekday/7),Math.sin(2*Math.PI*dayOfYear/days),Math.cos(2*Math.PI*dayOfYear/days)];
}
export function predictDemandTree(tree:DemandTree,features:number[]):number{
 let index=0;
 // sklearn's tree input is float32. Match its thresholds without rounding model leaves.
 for(let visited=0;visited<=tree.value.length;visited++){
  if(tree.left[index]===-1&&tree.right[index]===-1)return tree.value[index];
  const feature=tree.feature[index];if(feature<0||feature>=features.length)throw Error('Unsupported model feature.');
  index=Math.fround(features[feature])<=tree.threshold[index]?tree.left[index]:tree.right[index];
  if(!Number.isInteger(index)||index<0||index>=tree.value.length)throw Error('Invalid model branch.');
 }
 throw Error('Model tree does not terminate.');
}
export function predictDemandModel(model:DemandModel,features:number[]):number{
 if(features.length!==11||features.some(value=>!Number.isFinite(value)))throw Error('Seven complete preceding days are required.');
 return model.initial+model.learningRate*model.trees.reduce((sum,tree)=>sum+predictDemandTree(tree,features),0);
}
export function predictDemand(building:Pick<DemandBuilding,'models'>,features:number[]):DemandPrediction{
 const lower=predictDemandModel(building.models.lower,features),median=Math.max(0,predictDemandModel(building.models.median,features)),upper=predictDemandModel(building.models.upper,features);
 // Independently fit quantiles can cross. Use the same enclosing correction as Python.
 return {medianM3:median,lowerM3:Math.max(0,Math.min(lower,median,upper)),upperM3:Math.max(lower,median,upper)};
}
export function evaluateDemandRows(rows:DemandRow[]):DemandMetrics{
 if(!rows.length)throw Error('No common eligible dates exist.');
 const total=rows.reduce((sum,row)=>sum+row.actualM3,0);
 const error=(key:'medianM3'|'previousWeekM3'|'historicalWeekdayM3'):DemandError=>{const absolute=rows.reduce((sum,row)=>sum+Math.abs(row[key]-row.actualM3),0);return {maeM3:absolute/rows.length,wapePercent:total?absolute/total*100:null,biasM3:rows.reduce((sum,row)=>sum+row[key]-row.actualM3,0)/rows.length}};
 const model=error('medianM3'),previousWeek=error('previousWeekM3'),historicalWeekday=error('historicalWeekdayM3');
 return {count:rows.length,actualTotalM3:total,model,previousWeek,historicalWeekday,intervalCoveragePercent:rows.filter(row=>row.actualM3>=row.lowerM3&&row.actualM3<=row.upperM3).length/rows.length*100,nominalIntervalPercent:80,beatsBestBaseline:model.maeM3<Math.min(previousWeek.maeM3,historicalWeekday.maeM3)};
}
export type ImportedDemand = {schema:'terratrace-imported-daily-demand-v1';filename:string;unit:'m3/day';rows:{date:string;volumeM3:number|null}[];validDays:number;missingDays:number;notes:string[]};
/** Daily imports are inspected as measured readings; no intervention savings or imported-site model accuracy is inferred. */
export function parseDailyDemandCsv(text:string,filename='daily-demand.csv'):ImportedDemand{
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);if(lines.length<2||lines.length>10001)throw Error('Include a header and 1–10,000 daily rows.');
 if(lines[0].trim()!=='date,volume_m3')throw Error('Use the exact header date,volume_m3.');
 const seen=new Set<string>(),rows:{date:string;volumeM3:number|null}[]=[];
 for(let i=1;i<lines.length;i++){
  const fields=lines[i].split(',');if(fields.length!==2)throw Error(`Row ${i+1} needs exactly two columns.`);
  const date=fields[0].trim(),raw=fields[1].trim(),time=Date.parse(date+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==date)throw Error(`Row ${i+1} needs a valid ISO date.`);
  if(seen.has(date))throw Error(`Duplicate date ${date}.`);seen.add(date);
  const value=raw===''?null:Number(raw);if(value!==null&&(!Number.isFinite(value)||value<0))throw Error(`Row ${i+1} needs nonnegative m³ or a blank missing reading.`);
  rows.push({date,volumeM3:value});
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date));const span=Math.round((Date.parse(rows.at(-1)!.date)-Date.parse(rows[0].date))/86400000)+1,validDays=rows.filter(row=>row.volumeM3!==null).length;
 return {schema:'terratrace-imported-daily-demand-v1',filename,unit:'m3/day',rows,validDays,missingDays:span-validDays,notes:['User-supplied readings, inspected locally without interpolation.','No baseline intervention or eligible non-potable fraction is assumed.','Public reference model accuracy does not establish accuracy at this imported site.']};
}
