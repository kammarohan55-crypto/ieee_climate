import {dayHours,finite,type ClimateData,type City} from './climate';
import {localPoint,type UrbanData,type UrbanFeature,type TwinSettings,type Point} from './twin';

export function buildingUse(f:UrbanFeature):'Residential'|'Non-residential'|'Unknown'{
 const use=f.tags['building:use']??f.tags.building;
 if(/^(residential|house|apartments|detached|semidetached_house|terrace|bungalow|dormitory)$/.test(use??''))return 'Residential';
 if(/^(commercial|retail|office|industrial|warehouse|school|university|hospital|civic|public|hotel|church|mosque|temple|cathedral|supermarket|train_station)$/.test(use??'')||/^(school|university|college|hospital|clinic|townhall|library)$/.test(f.tags.amenity??''))return 'Non-residential';
 return 'Unknown';
}
export function roofSurvey(urban:UrbanData,data:ClimateData|undefined,s:TwinSettings){
 const day=dayHours(data,1),complete=day.length===24&&day.every(h=>finite(h.irradiance)),irradiation=complete?day.reduce((sum,h)=>sum+Math.max(0,h.irradiance!)/1000,0):null;
 return urban.features.filter(f=>f.kind==='building').map(feature=>{
  const use=buildingUse(feature),coverage=Math.max(0,Math.min(100,use==='Non-residential'?s.surveyNonResidential:s.surveyResidential))/100;
  const usableArea=feature.area*coverage,capacity=usableArea*s.panelDensity;
  return {feature,use,coverage,usableArea,capacity,generation:irradiation===null?null:capacity*irradiation*s.performance};
 }).sort((a,b)=>b.capacity-a.capacity||a.feature.id-b.feature.id);
}

// NOAA's fractional-year approximation, east-positive longitude; no refraction.
// localTime is a wall-clock forecast time. offsetSeconds comes from that forecast.
export function solarPosition(city:City,localTime:string,offsetSeconds:number){
 const wall=new Date(localTime+'Z');if(!Number.isFinite(wall.getTime())||!finite(offsetSeconds))return null;
 const year=wall.getUTCFullYear(),day=(wall.getTime()-Date.UTC(year,0,1))/86400000+1,hour=wall.getUTCHours()+wall.getUTCMinutes()/60;
 const days=(year%4===0&&year%100!==0)||year%400===0?366:365,gamma=2*Math.PI/days*(Math.floor(day)-1+(hour-12)/24);
 const eq=229.18*(.000075+.001868*Math.cos(gamma)-.032077*Math.sin(gamma)-.014615*Math.cos(2*gamma)-.040849*Math.sin(2*gamma));
 const decl=.006918-.399912*Math.cos(gamma)+.070257*Math.sin(gamma)-.006758*Math.cos(2*gamma)+.000907*Math.sin(2*gamma)-.002697*Math.cos(3*gamma)+.00148*Math.sin(3*gamma);
 const trueMinutes=((hour*60+eq+4*city.lon-offsetSeconds/60)%1440+1440)%1440,ha=(trueMinutes/4-180)*Math.PI/180,lat=city.lat*Math.PI/180;
 const cosZenith=Math.max(-1,Math.min(1,Math.sin(lat)*Math.sin(decl)+Math.cos(lat)*Math.cos(decl)*Math.cos(ha)));
 const elevation=Math.asin(cosZenith)*180/Math.PI;
 const azimuth=(Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(lat)-Math.tan(decl)*Math.cos(lat))*180/Math.PI+180+360)%360;
 return {elevation,azimuth};
}
export function shadowOffset(height:number,sun:{elevation:number;azimuth:number}|null){
 if(!sun||sun.elevation<5||height<=0)return null;
 const length=height/Math.tan(sun.elevation*Math.PI/180),a=sun.azimuth*Math.PI/180;
 return {x:-Math.sin(a)*length,y:-Math.cos(a)*length,length};
}
// Convex envelope of a footprint and its displaced copy. Concave shapes are
// deliberately over-enveloped; this is a ground-shadow schematic, not occlusion.
export function shadowEnvelope(feature:UrbanFeature,urban:UrbanData,sun:{elevation:number;azimuth:number}|null):Point[]{
 const d=shadowOffset(feature.height,sun);if(!d)return [];
 const pts=feature.points.flatMap(p=>{const q=localPoint(p,urban.city);return [q,{x:q.x+d.x,y:q.y+d.y}]}).sort((a,b)=>a.x-b.x||a.y-b.y);
 const cross=(o:{x:number;y:number},a:{x:number;y:number},b:{x:number;y:number})=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
 const lower:typeof pts=[],upper:typeof pts=[];
 for(const p of pts){while(lower.length>1&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p)}
 for(const p of pts.slice().reverse()){while(upper.length>1&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p)}
 return lower.slice(0,-1).concat(upper.slice(0,-1)).map(q=>({lat:urban.city.lat+q.y/111320,lon:urban.city.lon+q.x/(111320*Math.cos(urban.city.lat*Math.PI/180))}));
}
