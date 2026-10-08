import {clipPolygon,polygonArea,type UrbanFeature,type UrbanData,type Point} from './twin';
import {buildingUse} from './city-inspection';
export const HEIGHT_EVIDENCE={mapped:{label:'OSM height tag',color:'#8dded0'},floors:{label:'From mapped floors',color:'#b8aae9'},assumed:{label:'Assumed 10 m',color:'#dcad89'},capped:{label:'Capped at 150 m',color:'#d4e993'}};
export type HeightCategory=keyof typeof HEIGHT_EVIDENCE;
export function cappedOrigin(f:UrbanFeature){const raw=parseFloat(f.tags.height??'');return Number.isFinite(raw)&&raw>0?'OSM height tag':Number.isFinite(parseFloat(f.tags['building:levels']??''))?'mapped floor count':'unavailable original tag';}
export function evidenceSummary(urban:UrbanData){const buildings=urban.features.filter(f=>f.kind==='building');return {buildings,groups:(Object.keys(HEIGHT_EVIDENCE) as HeightCategory[]).map(key=>({key,...HEIGHT_EVIDENCE[key],count:buildings.filter(f=>f.heightSource===key).length,area:buildings.filter(f=>f.heightSource===key).reduce((s,f)=>s+f.area,0)})),unknownUse:buildings.filter(f=>buildingUse(f)==='Unknown').length,missingRoofShape:buildings.filter(f=>!f.tags['roof:shape']).length};}
export type DensityCell={id:string;points:Point[];area:number;footprint:number;count:number;ratio:number};
export function footprintDensity(urban:UrbanData,divisions=8):DensityCell[]{
 const [s,w,n,e]=urban.bounds,buildings=urban.features.filter(f=>f.kind==='building');const cells:DensityCell[]=[];
 for(let y=0;y<divisions;y++)for(let x=0;x<divisions;x++){const b:[number,number,number,number]=[s+(n-s)*y/divisions,w+(e-w)*x/divisions,s+(n-s)*(y+1)/divisions,w+(e-w)*(x+1)/divisions];const points=[{lat:b[0],lon:b[1]},{lat:b[0],lon:b[3]},{lat:b[2],lon:b[3]},{lat:b[2],lon:b[1]}];let footprint=0,count=0;
  for(const f of buildings){const area=polygonArea(clipPolygon(f.points,b),urban.city);if(area>1e-5){footprint+=area;count++;}}
  const area=polygonArea(points,urban.city);cells.push({id:`${y+1}-${x+1}`,points,area,footprint,count,ratio:area?footprint/area:0});
 }return cells;
}
export type SurveyEntry={id:number;feature:UrbanFeature;osmTime:string;timeKind:string;recordedAt:string;source:string};
export type SurveyChecklist={schema:'terratrace-survey-list-v1';cityId:string;entries:SurveyEntry[]};
export function checklistPayload(urban:UrbanData,list:SurveyChecklist){return {schema:list.schema,city:urban.city,bounds:urban.bounds,source:{url:urban.source,osmTime:urban.osmTime,timeKind:urban.timeKind??'osm-base',retrievedAt:urban.retrievedAt,relationsOmitted:true},entries:list.entries.slice().sort((a,b)=>a.id-b.id).map(e=>({...e,url:`https://www.openstreetmap.org/way/${e.id}`,questions:['Confirm height and roof geometry','Check roof access, structure and existing equipment','Measure shade and existing PV','Confirm permitted intervention and meter baseline']})),limitations:['Captured mapped ways only; source links can change later.','No survey has been completed by adding a building to this list.']};}
