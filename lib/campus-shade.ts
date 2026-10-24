import type {CampusScenario,RouteComparison,ShadeRoute,ShadeSample,StudyArea,Vec2,WalkGraph} from './campus-types';

export const SHADE_MODEL_VERSION='campus-geometric-shade-1.0.0';
const DEG=Math.PI/180;
export type SunPosition={altitude:number;azimuth:number;direction:{x:number;y:number;z:number}};

/** Hour is UTC; local scene hours must first pass through localDepartureToUTC. Coordinates: x east, z south. */
export function sunPosition(dateISO:string,hour:number,lat:number,lon:number):SunPosition{
 const date=new Date(dateISO);date.setUTCHours(0,0,0,0);date.setTime(date.getTime()+hour*3600000);
 if(!Number.isFinite(date.getTime())||!Number.isFinite(lat)||!Number.isFinite(lon))return {altitude:-90,azimuth:0,direction:{x:0,y:-1,z:0}};
 const jd=date.getTime()/86400000+2440587.5,t=(jd-2451545)/36525;
 const norm=(n:number)=>((n%360)+360)%360,L=norm(280.46646+t*(36000.76983+t*.0003032)),M=norm(357.52911+t*(35999.05029-.0001537*t));
 const e=.016708634-t*(.000042037+.0000001267*t),C=Math.sin(M*DEG)*(1.914602-t*(.004817+.000014*t))+Math.sin(2*M*DEG)*(.019993-.000101*t)+Math.sin(3*M*DEG)*.000289;
 const omega=125.04-1934.136*t,lambda=(L+C-.00569-.00478*Math.sin(omega*DEG))*DEG;
 const ob=(23+(26+(21.448-t*(46.815+t*(.00059-t*.001813)))/60)/60+.00256*Math.cos(omega*DEG))*DEG;
 const decl=Math.asin(Math.sin(ob)*Math.sin(lambda)),y=Math.tan(ob/2)**2;
 const eq=4/DEG*(y*Math.sin(2*L*DEG)-2*e*Math.sin(M*DEG)+4*e*y*Math.sin(M*DEG)*Math.cos(2*L*DEG)-.5*y*y*Math.sin(4*L*DEG)-1.25*e*e*Math.sin(2*M*DEG));
 const minutes=date.getUTCHours()*60+date.getUTCMinutes()+date.getUTCSeconds()/60;
 const ha=(norm((minutes+eq+4*lon)/4)-180)*DEG,phi=lat*DEG;
 const altitude=Math.asin(Math.sin(phi)*Math.sin(decl)+Math.cos(phi)*Math.cos(decl)*Math.cos(ha));
 const azimuth=norm(Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(phi)-Math.tan(decl)*Math.cos(phi))/DEG+180);
 return {altitude:altitude/DEG,azimuth,direction:{x:Math.sin(azimuth*DEG)*Math.cos(altitude),y:Math.sin(altitude),z:-Math.cos(azimuth*DEG)*Math.cos(altitude)}};
}

/** Returns null for a skipped or ambiguous local wall-clock time rather than silently choosing a DST offset. */
export function localDepartureToUTC(dateISO:string,hour:number,timezone:string):Date|null{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)||!Number.isFinite(hour)||hour<0||hour>=24)return null;
 const [year,month,day]=dateISO.split('-').map(Number),h=Math.floor(hour),m=Math.round((hour-h)*60),guess=Date.UTC(year,month-1,day,h,m);
 let formatter:Intl.DateTimeFormat;try{formatter=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})}catch{return null}
 const matches:Date[]=[];
 for(let offset=-14*60;offset<=14*60;offset+=15){const candidate=new Date(guess+offset*60000),parts=Object.fromEntries(formatter.formatToParts(candidate).map(p=>[p.type,p.value]));if(+parts.year===year&&+parts.month===month&&+parts.day===day&&+parts.hour===h&&+parts.minute===m)matches.push(candidate)}
 return matches.length===1?matches[0]:null;
}
export function sceneSun(study:StudyArea,scenario:CampusScenario):SunPosition{
 const date=localDepartureToUTC(scenario.departureDate,scenario.departureHour,study.timezone);
 return date?sunPosition(date.toISOString().slice(0,10),date.getUTCHours()+date.getUTCMinutes()/60,study.center.lat,study.center.lon):{altitude:-90,azimuth:0,direction:{x:0,y:-1,z:0}};
}
function pointInPolygon(p:Vec2,polygon:Vec2[]):boolean{let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if(((a.z>p.z)!==(b.z>p.z))&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside}return inside}
function orientation(a:Vec2,b:Vec2,c:Vec2){return (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)}
function segmentCross(a:Vec2,b:Vec2,c:Vec2,d:Vec2){const o1=orientation(a,b,c),o2=orientation(a,b,d),o3=orientation(c,d,a),o4=orientation(c,d,b);return o1*o2<=0&&o3*o4<=0&&Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))&&Math.max(Math.min(a.z,b.z),Math.min(c.z,d.z))<=Math.min(Math.max(a.z,b.z),Math.max(c.z,d.z))}
function intersectsFootprint(a:Vec2,b:Vec2,polygon:Vec2[],holes:Vec2[][]=[]){const filled=(p:Vec2)=>pointInPolygon(p,polygon)&&!holes.some(hole=>pointInPolygon(p,hole));if(filled(a)||filled(b))return true;for(const ring of [polygon,...holes])for(let i=0;i<ring.length;i++)if(segmentCross(a,b,ring[i],ring[(i+1)%ring.length]))return true;return false}
function crownHit(p:Vec2,sun:SunPosition,x:number,z:number,height:number,r:number){if(r<=0||height<=0)return false;const vr=Math.min(height*.5,r*1.2),cy=height-vr,dx=(p.x-x)/r,dz=(p.z-z)/r,dy=-cy/vr,sx=sun.direction.x/r,sz=sun.direction.z/r,sy=sun.direction.y/vr;const a=sx*sx+sy*sy+sz*sz,b=2*(dx*sx+dy*sy+dz*sz),c=dx*dx+dy*dy+dz*dz-1,discriminant=b*b-4*a*c;return discriminant>=0&&(-b+Math.sqrt(discriminant))/(2*a)>=0}

type ShadeResult={shaded:boolean;known:boolean;source:'building'|'tree'|'proposal'|'night'|'none'};
type StudyCache={buildings:{building:StudyArea['buildings'][number];minX:number;maxX:number;minZ:number;maxZ:number}[];baseline:Map<string,ShadeResult>;paths:Map<string,Path[]>;nodes:Map<string,Vec2>;edgeLengths:Map<string,number>;evaluated:Map<string,{route:ShadeRoute;weights:number[];suns:SunPosition[]}>};
const studyCaches=new WeakMap<StudyArea,StudyCache>();
function studyCache(study:StudyArea){let cache=studyCaches.get(study);if(!cache){const edgeLengths=new Map<string,number>();for(const edge of study.graph.edges){const key=edgeKey(edge.from,edge.to);edgeLengths.set(key,Math.min(edgeLengths.get(key)??Infinity,edge.lengthM))}cache={buildings:study.buildings.map(building=>({building,minX:Math.min(...building.polygon.map(p=>p.x)),maxX:Math.max(...building.polygon.map(p=>p.x)),minZ:Math.min(...building.polygon.map(p=>p.z)),maxZ:Math.max(...building.polygon.map(p=>p.z))})),baseline:new Map(),paths:new Map(),nodes:new Map(study.graph.nodes.map(n=>[n.id,n])),edgeLengths,evaluated:new Map()};studyCaches.set(study,cache)}return cache}
function baselineShade(study:StudyArea,point:Vec2,sun:SunPosition):ShadeResult{
 const cache=studyCache(study),key=`${point.x},${point.z},${sun.direction.x},${sun.direction.y},${sun.direction.z}`,cached=cache.baseline.get(key);if(cached)return cached;
 let uncertainHit=false,source:ShadeResult['source']='none';
 for(const box of cache.buildings){const b=box.building,end={x:point.x+sun.direction.x*b.heightM/sun.direction.y,z:point.z+sun.direction.z*b.heightM/sun.direction.y};if(Math.max(point.x,end.x)<box.minX||Math.min(point.x,end.x)>box.maxX||Math.max(point.z,end.z)<box.minZ||Math.min(point.z,end.z)>box.maxZ)continue;if(intersectsFootprint(point,end,b.polygon,b.holes)){if(b.heightSource==='assumed'){uncertainHit=true;source='building'}else{const result:ShadeResult={shaded:true,known:true,source:'building'};cache.baseline.set(key,result);return result}}}
 for(const t of study.trees)if(crownHit(point,sun,t.x,t.z,t.heightM,t.crownRadiusM)){if(t.dimensionsSource==='assumed'){uncertainHit=true;source='tree'}else{const result:ShadeResult={shaded:true,known:true,source:'tree'};cache.baseline.set(key,result);return result}}
 const result:ShadeResult={shaded:uncertainHit,known:!uncertainHit&&study.coverage.trees!=='partial'&&study.coverage.trees!=='unavailable',source};if(cache.baseline.size>50000)cache.baseline.clear();cache.baseline.set(key,result);return result;
}

/** Opaque geometric crowns and buildings. Coverage reports source-backed shading; missing canopy remains unknown. */
export function pointShade(study:StudyArea,point:Vec2,sun:SunPosition,shadeSiteIds:string[]=[]):ShadeResult{
 if(sun.altitude<=0)return {shaded:true,known:true,source:'night'};
 const baseline=baselineShade(study,point,sun);if(baseline.shaded)return baseline;
 for(const site of study.shadeSites){if(!shadeSiteIds.includes(site.id))continue;let hit=false;if(site.type==='tree')hit=crownHit(point,sun,site.x,site.z,site.heightM,site.crownRadiusM);else{const x=point.x+sun.direction.x*site.heightM/sun.direction.y-site.x,z=point.z+sun.direction.z*site.heightM/sun.direction.y-site.z,c=Math.cos(site.rotation*DEG),s=Math.sin(site.rotation*DEG);hit=Math.abs(x*c-z*s)<=site.widthM/2&&Math.abs(x*s+z*c)<=site.depthM/2}if(hit)return {shaded:true,known:false,source:'proposal'}}
 return baseline;
}

type Path={nodes:string[];cost:number};
const edgeKey=(a:string,b:string)=>a<b?a+'|'+b:b+'|'+a;
function connected(graph:WalkGraph){const known=new Set(graph.nodes.map(n=>n.id)),map=new Map<string,{to:string;length:number}[]>();for(const edge of graph.edges){const flags=edge as typeof edge & {access?:string;indoor?:boolean|string};if(flags.access==='private'||flags.access==='no'||flags.indoor===true||flags.indoor==='yes'||edge.lengthM<=0||!Number.isFinite(edge.lengthM)||!known.has(edge.from)||!known.has(edge.to))continue;for(const [from,to]of [[edge.from,edge.to],[edge.to,edge.from]]){if(!map.has(from))map.set(from,[]);map.get(from)!.push({to,length:edge.lengthM})}}return map}
function shortest(map:ReturnType<typeof connected>,from:string,to:string,blockedNodes=new Set<string>(),blockedEdges=new Set<string>()):Path|null{
 if(blockedNodes.has(from)||blockedNodes.has(to))return null;const distances=new Map([[from,0]]),previous=new Map<string,string>(),queue:{id:string;cost:number}[]=[{id:from,cost:0}];
 while(queue.length){queue.sort((a,b)=>b.cost-a.cost);const current=queue.pop()!;if(current.cost!==distances.get(current.id))continue;if(current.id===to){const nodes=[to];while(nodes[0]!==from)nodes.unshift(previous.get(nodes[0])!);return {nodes,cost:current.cost}}for(const edge of map.get(current.id)??[]){if(blockedNodes.has(edge.to)||blockedEdges.has(edgeKey(current.id,edge.to)))continue;const next=current.cost+edge.length;if(next<(distances.get(edge.to)??Infinity)){distances.set(edge.to,next);previous.set(edge.to,current.id);queue.push({id:edge.to,cost:next})}}}return null;
}
/** Bounded Yen search. Returns up to twenty loopless paths within a 20% detour. */
function alternatives(graph:WalkGraph,from:string,to:string):Path[]{const map=connected(graph),first=shortest(map,from,to);if(!first)return [];const accepted=[first],pool=new Map<string,Path>(),maxCost=first.cost*1.2+1e-8;for(let k=1;k<20;k++){const previous=accepted[k-1];let rootCost=0;for(let i=0;i<previous.nodes.length-1;i++){const root=previous.nodes.slice(0,i+1),blockedEdges=new Set<string>();for(const path of accepted)if(root.every((n,j)=>path.nodes[j]===n)&&path.nodes[i+1])blockedEdges.add(edgeKey(path.nodes[i],path.nodes[i+1]));const spur=shortest(map,root.at(-1)!,to,new Set(root.slice(0,-1)),blockedEdges);if(spur){const candidate={nodes:[...root.slice(0,-1),...spur.nodes],cost:rootCost+spur.cost},key=candidate.nodes.join('>');if(candidate.cost<=maxCost&&!accepted.some(p=>p.nodes.join('>')===key))pool.set(key,candidate)}const edge=map.get(previous.nodes[i])?.find(e=>e.to===previous.nodes[i+1]);rootCost+=edge?.length??Infinity}const best=[...pool.entries()].sort((a,b)=>a[1].cost-b[1].cost)[0];if(!best)break;accepted.push(best[1]);pool.delete(best[0])}return accepted}
function evaluate(study:StudyArea,path:Path,scenario:CampusScenario,departure:Date,planned:boolean,index:number):ShadeRoute{
 const speed=Math.min(3,Math.max(.2,scenario.speedMps));
 const cache=studyCache(study),key=path.nodes.join('>')+'|'+departure.toISOString()+'|'+speed;let saved=cache.evaluated.get(key);
 if(!saved){const points=path.nodes.map(id=>cache.nodes.get(id)!).map(p=>({x:p.x,z:p.z})),samples:ShadeSample[]=[],weights:number[]=[],suns:SunPosition[]=[];let elapsed=0,sunMinutes=0,knownMinutes=0,total=0;
  for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],length=Math.hypot(b.x-a.x,b.z-a.z),travelLength=cache.edgeLengths.get(edgeKey(path.nodes[i],path.nodes[i+1]))??length,segments=Math.max(1,Math.ceil(length/5)),duration=travelLength/speed/60;
   for(let j=0;j<segments;j++){const fraction=(j+.5)/segments,p={x:a.x+(b.x-a.x)*fraction,z:a.z+(b.z-a.z)*fraction},time=new Date(departure.getTime()+(elapsed+duration*fraction)*60000),sun=sunPosition(time.toISOString().slice(0,10),time.getUTCHours()+time.getUTCMinutes()/60+time.getUTCSeconds()/3600,study.center.lat,study.center.lon),result=pointShade(study,p,sun,[]),weight=duration/segments;samples.push({...p,elapsedMin:elapsed+duration*fraction,shaded:result.shaded,known:result.known});weights.push(weight);suns.push(sun);if(!result.shaded)sunMinutes+=weight;if(result.known)knownMinutes+=weight;total+=weight}
   elapsed+=duration;
  }
  const route:ShadeRoute={id:'route-'+index,points,nodeIds:path.nodes,distanceM:path.cost,durationMin:total,sunMinutes,shadedMinutes:Math.max(0,total-sunMinutes),shadePercent:total?100*(total-sunMinutes)/total:0,coveragePercent:total?100*knownMinutes/total:0,samples};saved={route,weights,suns};if(cache.evaluated.size>1000)cache.evaluated.clear();cache.evaluated.set(key,saved);
 }
 if(!planned||!scenario.shadeSiteIds.length)return saved.route;
 let sunMinutes=0,knownMinutes=0;const samples=saved.route.samples.map((sample,i)=>{const result=sample.shaded?sample:pointShade(study,sample,saved.suns[i],scenario.shadeSiteIds);if(!result.shaded)sunMinutes+=saved.weights[i];if(result.known)knownMinutes+=saved.weights[i];return {...sample,shaded:result.shaded,known:result.known}}),total=saved.route.durationMin;
 return {...saved.route,samples,sunMinutes,shadedMinutes:Math.max(0,total-sunMinutes),shadePercent:total?100*(total-sunMinutes)/total:0,coveragePercent:total?100*knownMinutes/total:0};
}
export function compareRoutes(study:StudyArea,scenario:CampusScenario,planned:boolean):RouteComparison{
 const unavailable=(reason:string):RouteComparison=>({available:false,reason,shortest:null,shadiest:null,routes:[],consideredCount:0,modelVersion:SHADE_MODEL_VERSION});
 const origin=study.destinations.find(d=>d.id===scenario.originId),destination=study.destinations.find(d=>d.id===scenario.destinationId);if(!origin||!destination)return unavailable('Choose two mapped destinations.');if(origin.nodeId===destination.nodeId)return unavailable('The destinations connect to the same mapped path node.');
 if(!Number.isFinite(scenario.speedMps)||scenario.speedMps<.2||scenario.speedMps>3)return unavailable('Use an assumed walking speed between 0.2 and 3 metres per second.');
 const departure=localDepartureToUTC(scenario.departureDate,scenario.departureHour,study.timezone);if(!departure)return unavailable('This local departure time is invalid, skipped, or ambiguous at a daylight-saving transition. Choose another time.');
 const cache=studyCache(study),pathKey=origin.nodeId+'|'+destination.nodeId;let paths=cache.paths.get(pathKey);if(!paths){paths=alternatives(study.graph,origin.nodeId,destination.nodeId);cache.paths.set(pathKey,paths)}if(!paths.length)return unavailable('These destinations are disconnected in the eligible public walking network. No connecting path was invented.');
 const routes=paths.map((path,i)=>evaluate(study,path,scenario,departure,planned,i)),shadiest=[...routes].sort((a,b)=>a.sunMinutes-b.sunMinutes||a.distanceM-b.distanceM)[0];return {available:true,shortest:routes[0],shadiest,routes,consideredCount:routes.length,modelVersion:SHADE_MODEL_VERSION};
}
