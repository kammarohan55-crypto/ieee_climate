import {dayHours, finite, type City, type ClimateData} from './climate';

export type Point = {lat:number;lon:number};
export type UrbanFeature = {id:number;kind:'building'|'road'|'green'|'water';name:string;points:Point[];area:number;height:number;heightSource:'mapped'|'floors'|'assumed'|'capped';tags:Record<string,string>};
export type UrbanData = {city:City;radius:number;bounds:[number,number,number,number];features:UrbanFeature[];retrievedAt:string;osmTime:string;timeKind?:'osm-base'|'retrieved';source:string;query:string;status:'live'|'capture';attribution:string;truncated:boolean};
export function osmMapGeometry(input:unknown){
 const raw=input as {elements?:{type:string;id:number;lat?:number;lon?:number;tags?:Record<string,string>;nodes?:number[]}[]};if(!Array.isArray(raw?.elements)||raw.elements.length>100000)throw Error('Invalid or oversized map response.');
 const nodes=new Map(raw.elements.filter(e=>e.type==='node'&&finite(e.lat)&&finite(e.lon)).map(e=>[e.id,{lat:e.lat!,lon:e.lon!}]));
 const elements=raw.elements.filter(e=>e.type==='way'&&e.tags&&(e.tags.building||e.tags.highway||e.tags.leisure==='park'||/^(forest|grass|recreation_ground)$/.test(e.tags.landuse??'')||/^(wood|water)$/.test(e.tags.natural??''))).map(e=>{const geometry=(e.nodes??[]).map(id=>nodes.get(id));if(geometry.some(p=>!p))throw Error('Map response is missing referenced nodes.');return {...e,geometry}});
 return {elements};
}
export type TwinSettings = {coolRoofs:number;solarRoofs:number;trees:number;canopyPerTree:number;treeCooling:number;oldAlbedo:number;newAlbedo:number;panelDensity:number;performance:number;dailyDemand:number;gridFactor:number;heatThreshold:number;coolingScale:number;referenceRadiation:number;surveyResidential:number;surveyNonResidential:number};
export const TWIN_DEFAULTS:TwinSettings={coolRoofs:40,solarRoofs:20,trees:120,canopyPerTree:30,treeCooling:.10,oldAlbedo:.2,newAlbedo:.7,panelDensity:.2,performance:.8,dailyDemand:25000,gridFactor:.4,heatThreshold:30,coolingScale:1,referenceRadiation:800,surveyResidential:25,surveyNonResidential:40};
export function boundsFor(city:City,radius=800):UrbanData['bounds'] {const dy=radius/111320,dx=dy/Math.max(.15,Math.cos(city.lat*Math.PI/180));return [city.lat-dy,city.lon-dx,city.lat+dy,city.lon+dx]}
export function localPoint(p:Point,city:City) {return {x:(p.lon-city.lon)*111320*Math.cos(city.lat*Math.PI/180),y:(p.lat-city.lat)*111320}}
export function clipPolygon(points:Point[],bounds:UrbanData['bounds']):Point[]{
 let out=points.slice();const [s,w,n,e]=bounds;
 const edges:[(p:Point)=>boolean,(a:Point,b:Point)=>Point][]=[
  [p=>p.lon>=w,(a,b)=>({lon:w,lat:a.lat+(b.lat-a.lat)*(w-a.lon)/(b.lon-a.lon)})],
  [p=>p.lon<=e,(a,b)=>({lon:e,lat:a.lat+(b.lat-a.lat)*(e-a.lon)/(b.lon-a.lon)})],
  [p=>p.lat>=s,(a,b)=>({lat:s,lon:a.lon+(b.lon-a.lon)*(s-a.lat)/(b.lat-a.lat)})],
  [p=>p.lat<=n,(a,b)=>({lat:n,lon:a.lon+(b.lon-a.lon)*(n-a.lat)/(b.lat-a.lat)})],
 ];
 for(const [inside,intersect] of edges){const input=out;out=[];for(let i=0;i<input.length;i++){const a=input[i],b=input[(i+1)%input.length];if(inside(a))out.push(a);if(inside(a)!==inside(b))out.push(intersect(a,b))}}
 return out.filter(p=>finite(p.lat)&&finite(p.lon));
}
export function polygonArea(points:Point[],city:City){const pts=points.map(p=>localPoint(p,city));return Math.abs(pts.reduce((s,a,i)=>{const b=pts[(i+1)%pts.length];return s+a.x*b.y-b.x*a.y},0))/2}
type OSMElement={type:string;id:number;tags?:Record<string,string>;geometry?:Point[]};
export function normalizeUrban(input:unknown,city:City,source:string,query:string):UrbanData{
 if(!input||typeof input!=='object')throw Error('Invalid map response.');
 const raw=input as {elements?:OSMElement[];osm3s?:{timestamp_osm_base?:string};remark?:string};
 if(!Array.isArray(raw.elements)||raw.remark)throw Error('The map provider returned incomplete geometry.');
 const bounds=boundsFor(city);const features:UrbanFeature[]=[];
 for(const f of raw.elements){const tags=f.tags??{};if(f.type!=='way'||!f.geometry?.length)continue;
  const kind:UrbanFeature['kind']=tags.building&&tags.building!=='no'?'building':tags.highway?'road':tags.natural==='water'||tags.waterway?'water':'green';
  const points=kind==='road'?f.geometry:clipPolygon(f.geometry,bounds);if(points.length<(kind==='road'?2:3))continue;
  const area=kind==='road'?0:polygonArea(points,city);if(kind!=='road'&&area<4)continue;
  const rawHeight=parseFloat(tags.height??''),feet=/feet|ft|'/i.test(tags.height??''),mapped=(finite(rawHeight)?rawHeight*(feet ? .3048 : 1):0)||parseFloat(tags['building:levels']??'')*3;
  features.push({id:f.id,kind,name:tags.name??(kind==='building'?'Mapped building':kind==='road'?'Mapped street':kind==='green'?'Mapped green space':'Mapped water'),points,area,height:finite(mapped)&&mapped>0?Math.min(150,mapped):10,heightSource:finite(mapped)&&mapped>150?'capped':finite(mapped)&&mapped>0?finite(rawHeight)?'mapped':'floors':'assumed',tags});
 }
 return {city,radius:800,bounds,features,retrievedAt:new Date().toISOString(),osmTime:raw.osm3s?.timestamp_osm_base??'Unavailable',source,query,status:'live',attribution:'© OpenStreetMap contributors · ODbL 1.0',truncated:false};
}
export function twinModel(data:ClimateData|undefined,urban:UrbanData|undefined,s:TwinSettings){
 const day=dayHours(data,1),roofArea=urban?.features.filter(f=>f.kind==='building').reduce((a,f)=>a+f.area,0)??0;
 const districtArea=urban?4*urban.radius**2:0;
 const roofFraction=Math.min(1,Math.max(0,s.coolRoofs/100)),solarFraction=Math.min(1-roofFraction,Math.max(0,s.solarRoofs/100));
 const coolArea=roofArea*roofFraction,solarArea=roofArea*solarFraction,newCanopy=Math.min(districtArea,s.trees*s.canopyPerTree);
 const albedoDelta=Math.max(0,s.newAlbedo-s.oldAlbedo);
 // Boston (2025) bulk albedo sensitivity + editable global canopy benchmark (2026). Not fitted for this city.
 const analogyCooling=districtArea?((6.1*coolArea/districtArea*albedoDelta)+(s.treeCooling*newCanopy/districtArea/.1))*s.coolingScale:0;
 const weights=day.map((_,i)=>i>=8&&i<18?1.3:i>=18&&i<23?1.6:.7),totalWeight=weights.reduce((a,b)=>a+b,0);
 const complete=!!urban&&!urban.truncated&&roofArea>0&&day.length===24&&day.every(h=>finite(h.irradiance)&&finite(h.temperature)&&finite(data?.weather?.hourly.shortwave_radiation?.[data.weather.hourly.time.indexOf(h.time)]));
 const rows=day.map((h,i)=>{const wi=data?.weather?.hourly.time.indexOf(h.time)??-1,shortwave=data?.weather?.hourly.shortwave_radiation?.[wi],rad=finite(shortwave)?Math.max(0,shortwave):null;
  const power=h.irradiance===null?null:Math.max(0,h.irradiance)/1000*solarArea*s.panelDensity*s.performance;
  const load=s.dailyDemand*weights[i]/totalWeight,matched=power===null?null:Math.min(load,power),cooling=rad===null?null:analogyCooling*Math.min(1,rad/Math.max(1,s.referenceRadiation));
  return {time:h.time,label:h.label,energyLabel:`${String(i).padStart(2,'0')}:00`,baseline:h.temperature,scenario:h.temperature===null||cooling===null?null:h.temperature-cooling,low:h.temperature===null||cooling===null?null:h.temperature-1.5*cooling,high:h.temperature===null||cooling===null?null:h.temperature-.5*cooling,power,load,grid:matched===null?null:load-matched,matched,reflected:rad===null?null:rad/1000*coolArea*albedoDelta};
 });
 const sum=(key:'power'|'matched'|'reflected')=>rows.reduce((a,r)=>a+(r[key]??0),0);
 const generated=sum('power'),matched=sum('matched'),reflected=sum('reflected');
 const degreeHours=rows.reduce((a,r)=>a+Math.max(0,(r.baseline??s.heatThreshold)-s.heatThreshold),0),afterDegreeHours=rows.reduce((a,r)=>a+Math.max(0,(r.scenario??s.heatThreshold)-s.heatThreshold),0);
 return {complete,roofArea,districtArea,coolArea,solarArea,newCanopy,capacity:solarArea*s.panelDensity,analogyCooling,generated,matched,exportPotential:Math.max(0,generated-matched),reflected,beforeGrid:s.dailyDemand,afterGrid:Math.max(0,s.dailyDemand-matched),carbon:matched*s.gridFactor,degreeHours,afterDegreeHours,rows};
}

export function featureInterventions(urban:UrbanData,s:TwinSettings){
 // Stable ID order is a reproducible visual allocation, not a roof suitability ranking.
 const buildings=urban.features.filter(f=>f.kind==='building').sort((a,b)=>a.id-b.id),total=buildings.reduce((a,f)=>a+f.area,0),assignments=new Map<number,{cool:number;solar:number}>();let cumulative=0;
 const coolEnd=total*s.coolRoofs/100,solarEnd=total*Math.min(100,s.coolRoofs+s.solarRoofs)/100;
 for(const f of buildings){const start=cumulative,end=start+f.area;assignments.set(f.id,{cool:Math.max(0,Math.min(end,coolEnd)-start)/f.area,solar:Math.max(0,Math.min(end,solarEnd)-Math.max(start,coolEnd))/f.area});cumulative=end}
 return assignments;
}
