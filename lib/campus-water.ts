import type {RainArchive, RainEnsemble, SourceStamp, StudyArea, WaterRun, WaterSettings, WaterStep} from './campus-types';

export const CAMPUS_WATER_MODEL_VERSION = 'campus-roof-storage-yas-v1';
const validNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const unavailable = (reason: string, year?: number): WaterRun => ({available:false,reason,modelVersion:CAMPUS_WATER_MODEL_VERSION,year,demandM3:0,reuseM3:0,overflowM3:0,bypassM3:0,inflowM3:0,endingStorageM3:0,initialStorageM3:0,coveragePercent:0,steps:[]});
type Catchment = {area:number;connected:number;runoff:number;capacity:number;storage:number};
function catchments(study: StudyArea, settings: WaterSettings): Catchment[] | string {
  if(!validNumber(settings.dailyDemandM3) || !validNumber(settings.startingFillFraction) || settings.startingFillFraction>1) return 'Demand and starting fill must be finite, nonnegative values; fill must be between zero and one.';
  if(!settings.roofs.length || settings.roofs.length>3) return 'Choose between one and three mapped roofs.';
  const ids=new Set<string>(); const result:Catchment[]=[];
  for(const choice of settings.roofs){
    if(ids.has(choice.buildingId)) return 'A mapped roof may only appear once in a proposal.';
    ids.add(choice.buildingId);const building=study.buildings.find(b=>b.id===choice.buildingId);
    if(!building || !validNumber(building.areaM2) || building.areaM2===0) return 'A selected roof has no usable mapped catchment area.';
    if(!validNumber(choice.capacityM3)||!validNumber(choice.connectedFraction)||choice.connectedFraction>1||!validNumber(choice.runoffCoefficient)||choice.runoffCoefficient>1) return 'Capacity must be nonnegative; connected fraction and runoff coefficient must be between zero and one.';
    result.push({area:building.areaM2,connected:choice.connectedFraction,runoff:choice.runoffCoefficient,capacity:choice.capacityM3,storage:choice.capacityM3*settings.startingFillFraction});
  }
  return result;
}
function replay(study:StudyArea,settings:WaterSettings,times:string[],rain:number[],demand:number[],year?:number):WaterRun{
  const roofs=catchments(study,settings);if(typeof roofs==='string')return unavailable(roofs,year);
  if(!times.length||times.length!==rain.length||times.length!==demand.length||rain.some(v=>!validNumber(v))||demand.some(v=>!validNumber(v)))return unavailable('Every replay interval needs valid rainfall and demand.',year);
  const connectedArea=roofs.reduce((sum,roof)=>sum+roof.area*roof.connected,0);
  const initialStorageM3=roofs.reduce((sum,roof)=>sum+roof.storage,0);
  const steps:WaterStep[]=[];
  for(let i=0;i<times.length;i++){
    let inflowM3=0,bypassM3=0,overflowM3=0,reuseM3=0,storageM3=0;
    for(const roof of roofs){
      const runoffM3=rain[i]/1000*roof.area*roof.runoff;
      const inflow=runoffM3*roof.connected;const overflow=Math.max(0,roof.storage+inflow-roof.capacity);
      roof.storage=Math.min(roof.capacity,roof.storage+inflow);
      // The whole-proposal demand is allocated once by connected area. Disconnected tanks cannot serve it.
      const share=connectedArea>0?demand[i]*roof.area*roof.connected/connectedArea:0;
      const reuse=Math.min(share,roof.storage);roof.storage-=reuse;
      inflowM3+=inflow;bypassM3+=runoffM3-inflow;overflowM3+=overflow;reuseM3+=reuse;storageM3+=roof.storage;
    }
    steps.push({time:times[i],rainMm:rain[i],inflowM3,bypassM3,overflowM3,reuseM3,unservedM3:Math.max(0,demand[i]-reuseM3),storageM3});
  }
  const sum=(key:'inflowM3'|'bypassM3'|'overflowM3'|'reuseM3')=>steps.reduce((total,row)=>total+row[key],0);
  const demandM3=demand.reduce((a,b)=>a+b,0),reuseM3=sum('reuseM3');
  return {available:true,modelVersion:CAMPUS_WATER_MODEL_VERSION,year,demandM3,reuseM3,overflowM3:sum('overflowM3'),bypassM3:sum('bypassM3'),inflowM3:sum('inflowM3'),endingStorageM3:steps.at(-1)!.storageM3,initialStorageM3,coveragePercent:demandM3>0?100*reuseM3/demandM3:0,steps};
}

export function runAnnual(study:StudyArea,archive:RainArchive,settings:WaterSettings,year:number):WaterRun{
  if(!Number.isInteger(year)||!archive.acceptedYears.includes(year))return unavailable('This year is not accepted for headline reliability: complete, Good daily observations are required.',year);
  if(archive.unit!=='mm'||archive.periodSeconds!==86400)return unavailable('Rainfall must be daily totals in millimetres.',year);
  const selected=archive.readings.filter(row=>row.date.startsWith(`${year}-`)).sort((a,b)=>a.date.localeCompare(b.date));
  const count=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
  if(selected.length!==count)return unavailable('This year contains missing or duplicate daily records.',year);
  for(let i=0;i<count;i++){
    const expected=new Date(Date.UTC(year,0,1+i)).toISOString().slice(0,10),row=selected[i];
    if(row.date!==expected||row.quality!=='Good'||row.completeness!=='Complete'||!validNumber(row.valueMm))return unavailable('Missing, incomplete, or rejected-quality rainfall is never filled with zeros.',year);
  }
  return replay(study,settings,selected.map(row=>row.date),selected.map(row=>row.valueMm!),selected.map(()=>settings.dailyDemandM3),year);
}

function percentile(values:number[],p:number){const a=[...values].sort((x,y)=>x-y),position=(a.length-1)*p,index=Math.floor(position),fraction=position-index;return a[index]+fraction*((a[index+1]??a[index])-a[index]);}
export function runForecast(study:StudyArea,ensemble:RainEnsemble,settings:WaterSettings,demandProfileM3?:number[]):{runs:WaterRun[];median:WaterRun|null;spread:{time:string;p10:number;p50:number;p90:number}[];rejected:number}{
  const demand=demandProfileM3??ensemble.timesUTC.map(()=>settings.dailyDemandM3/24);
  if(demand.length!==ensemble.timesUTC.length||demand.some(value=>!validNumber(value)))return {runs:[],median:null,spread:[],rejected:ensemble.members.length};
  const times=ensemble.timesUTC,validTimes=times.every((time,index)=>Number.isFinite(Date.parse(time))&&(index===0||Date.parse(time)-Date.parse(times[index-1])===3600000));
  if(!validTimes||!times.length)return {runs:[],median:null,spread:[],rejected:ensemble.members.length};
  const entries=ensemble.members.filter(member=>member.rainMm.length===times.length&&member.rainMm.every(validNumber)).map(member=>({member,run:replay(study,settings,times,member.rainMm as number[],demand)})).filter(entry=>entry.run.available);
  if(!entries.length)return {runs:[],median:null,spread:[],rejected:ensemble.members.length};
  const totalRain=(rain:(number|null)[])=>rain.reduce<number>((sum,value)=>sum+(value??0),0),middle=percentile(entries.map(entry=>totalRain(entry.member.rainMm)),.5);
  // This representative is a real forecast member; its internally balanced totals are not pointwise medians.
  const representative=[...entries].sort((a,b)=>Math.abs(totalRain(a.member.rainMm)-middle)-Math.abs(totalRain(b.member.rainMm)-middle))[0];
  const spread=times.map((time,index)=>{const stores=entries.map(entry=>entry.run.steps[index].storageM3);return {time,p10:percentile(stores,.1),p50:percentile(stores,.5),p90:percentile(stores,.9)};});
  return {runs:entries.map(entry=>entry.run),median:representative.run,spread,rejected:ensemble.members.length-entries.length};
}

/** Capacity is a total portfolio capacity, allocated by connected roof area; all alternatives start empty. */
export function capacitySweep(study:StudyArea,archive:RainArchive,settings:WaterSettings):{capacityM3:number;worstCoverage:number;reuseM3:number;overflowM3:number}[]{
  const roofs=catchments(study,settings);if(typeof roofs==='string')return [];
  const connected=roofs.reduce((sum,roof)=>sum+roof.area*roof.connected,0);
  const capacities=[...new Set([0,1,2.5,5,10,25,50,100,settings.roofs.reduce((sum,roof)=>sum+roof.capacityM3,0)])].sort((a,b)=>a-b);
  return capacities.flatMap(capacityM3=>{
    const variant={...settings,startingFillFraction:0,roofs:settings.roofs.map((roof,index)=>({...roof,capacityM3:connected>0?capacityM3*roofs[index].area*roofs[index].connected/connected:capacityM3/settings.roofs.length}))};
    const runs=archive.acceptedYears.map(year=>runAnnual(study,archive,variant,year));if(!runs.length||runs.some(run=>!run.available))return [];
    return [{capacityM3,worstCoverage:Math.min(...runs.map(run=>run.coveragePercent)),reuseM3:runs.reduce((sum,run)=>sum+run.reuseM3,0)/runs.length,overflowM3:runs.reduce((sum,run)=>sum+run.overflowM3,0)/runs.length}];
  });
}

/** Accept only hourly liquid precipitation in UTC. Provider values describe the preceding hour. */
export function validateRainEnsemble(raw:unknown,retrievedAt=new Date().toISOString(),url='https://ensemble-api.open-meteo.com/v1/ensemble',status:'live'|'capture'='live'):RainEnsemble{
  if(!raw||typeof raw!=='object')throw new Error('The ensemble response is not an object.');
  const data=raw as Record<string,unknown>,hourly=data.hourly as Record<string,unknown>|undefined,units=data.hourly_units as Record<string,unknown>|undefined;
  if(!hourly||!Array.isArray(hourly.time)||hourly.time.length<2||hourly.time.length>168||data.utc_offset_seconds!==0)throw new Error('An hourly UTC ensemble response is required.');
  const timesUTC=hourly.time.map(time=>{if(typeof time!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z?$/.test(time))throw new Error('Invalid ensemble time.');const normalized=/Z$/.test(time)?time:`${time}Z`;if(!Number.isFinite(Date.parse(normalized)))throw new Error('Invalid ensemble time.');return new Date(normalized).toISOString();});
  if(timesUTC.some((time,index)=>index>0&&Date.parse(time)-Date.parse(timesUTC[index-1])!==3600000))throw new Error('Ensemble intervals must be consecutive hours.');
  const rainKeys=Object.keys(hourly).filter(key=>/^rain(?:_member\d+)?$/.test(key));
  const members=rainKeys.map(key=>{const suffix=key.slice(4),showersKey=`showers${suffix}`,rain=hourly[key],showers=hourly[showersKey];
    if(units?.[key]!=='mm'||units?.[showersKey]!=='mm'||!Array.isArray(rain)||!Array.isArray(showers)||rain.length!==timesUTC.length||showers.length!==timesUTC.length)return null;
    return {id:suffix||'control',rainMm:rain.map((value,index)=>validNumber(value)&&validNumber(showers[index])?value+showers[index]:null)};
  }).filter((member):member is NonNullable<typeof member>=>member!==null);
  if(!members.length||members.length>64)throw new Error('No supported liquid-rain ensemble members were returned.');
  const latitude=Number(data.latitude),longitude=Number(data.longitude);if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw new Error('Invalid ensemble coordinates.');
  const source:SourceStamp={id:'gfs-ensemble',title:'Open-Meteo GFS ensemble liquid precipitation',url,license:'CC BY 4.0',attribution:'Open-Meteo; NOAA GFS',retrievedAt,kind:'forecast',notes:['Each value is the preceding one-hour rain + showers total in mm. Snowfall is excluded.','The member spread is not a calibrated confidence interval.','Forecast grid coordinates differ slightly from the study center.']};
  return {schema:'terratrace-rain-ensemble-v1',source,status,latitude,longitude,timesUTC,members,raw};
}
