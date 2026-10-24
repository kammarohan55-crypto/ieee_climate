/** Refresh only the separate campus public-data study; legacy city captures are untouched. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateRainEnsemble} from '../lib/campus-water';
import {captureMappedTrees} from './capture-campus-trees';
import {normalizeCampusBuildings} from './capture-campus-geometry';
import type {CampusBuilding, CampusDestination, CampusTree, RainArchive, ShadeSite, SourceStamp, StudyArea, Vec2, WalkEdge, WalkNode} from '../lib/campus-types';

const center={lat:51.4977025,lon:-.1018199},radiusM=800;
const out=path.resolve('public/campus');fs.mkdirSync(out,{recursive:true});
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const write=(file:string,value:unknown)=>fs.writeFileSync(path.join(out,file),JSON.stringify(value));
const xy=(lat:number,lon:number):Vec2=>({x:Math.round((lon-center.lon)*111320*Math.cos(center.lat*Math.PI/180)*100)/100,z:Math.round((center.lat-lat)*111320*100)/100});
const inside=(lat:number,lon:number)=>{const p=xy(lat,lon);return Math.abs(p.x)<=radiusM&&Math.abs(p.z)<=radiusM;};
const bounds:[number,number,number,number]=[center.lat-radiusM/111320,center.lon-radiusM/(111320*Math.cos(center.lat*Math.PI/180)),center.lat+radiusM/111320,center.lon+radiusM/(111320*Math.cos(center.lat*Math.PI/180))];
const recordedDimension=(text:string|undefined)=>text&&/^\s*\d+(?:\.\d+)?\s*(?:m)?\s*$/i.test(text)?Number.parseFloat(text):NaN;
async function json(url:string,options:RequestInit={},timeout=60000):Promise<any>{const response=await fetch(url,{...options,signal:AbortSignal.timeout(timeout),headers:{Accept:'application/json','User-Agent':'TerraTrace-Public-Research/1.0 (github.com/kammarohan55-crypto/ieee_climate)',...options.headers}});if(!response.ok)throw new Error(`${response.status}: ${url}`);return await response.json();}
type OsmElement={type:string;id:number;lat?:number;lon?:number;center?:{lat:number;lon:number};nodes?:number[];geometry?:{lat:number;lon:number}[];tags?:Record<string,string>;members?:{type:string;ref:number;role:string;geometry?:{lat:number;lon:number}[]}[]};

async function captureRain(){
  const stationId='821f835f-2ec5-4fc1-9ff0-f1a42e3ff873';
  const station=await json(`https://environment.data.gov.uk/hydrology/id/stations/${stationId}.json`);
  const url=`https://environment.data.gov.uk/hydrology/id/measures/${stationId}-rainfall-t-86400-mm-qualified/readings.json?mineq-date=2018-01-01&maxeq-date=2025-12-31&_limit=4000`;
  const raw=await json(url),retrievedAt=new Date().toISOString();
  const readings=raw.items.map((row:Record<string,unknown>)=>({date:String(row.date),valueMm:typeof row.value==='number'&&Number.isFinite(row.value)&&row.value>=0?row.value:null,quality:String(row.quality??'Unknown'),completeness:typeof row.completeness==='string'?row.completeness:null}));
  const acceptedYears=[2018,2020,2025].filter(year=>{const rows=readings.filter((row:{date:string})=>row.date.startsWith(`${year}-`));const expected=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;return rows.length===expected&&rows.every((row:{date:string;quality:string;completeness:string|null;valueMm:number|null},i:number)=>row.date===new Date(Date.UTC(year,0,1+i)).toISOString().slice(0,10)&&row.quality==='Good'&&row.completeness==='Complete'&&row.valueMm!==null);});
  if(acceptedYears.length!==3)throw new Error(`Expected accepted rainfall years did not pass: ${acceptedYears}`);
  const item=Array.isArray(station.items)?station.items[0]:station.items,lat=Number(item.lat),lon=Number(item.long),dlat=(lat-center.lat)*Math.PI/180,dlon=(lon-center.lon)*Math.PI/180;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))throw new Error('The station coordinates are missing.');
  const distanceKm=6371*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(lat*Math.PI/180)*Math.cos(center.lat*Math.PI/180)*Math.sin(dlon/2)**2));
  const archive:RainArchive={schema:'terratrace-rain-archive-v1',source:{id:'ea-mitcham-daily',title:'Environment Agency Mitcham qualified daily rainfall, 2018–2025',url,license:'Open Government Licence v3.0',attribution:'Contains Environment Agency information © Environment Agency',retrievedAt,kind:'observed',digest:digest(raw),notes:['Nearby rain gauge; rainfall is not measured on the campus.','Daily qualified totals retain original quality and completeness, including rejected readings.','EA daily dates have a 09:00 boundary in the raw dateTime; they are daily observations, not midnight hourly storms.','2018, 2020 and 2025 each contain every day with Good quality and Complete status. Other years are inspection-only.']},station:{id:stationId,name:'Mitcham',lat,lon,distanceKm},unit:'mm',periodSeconds:86400,readings,acceptedYears,raw:{station,...raw}};
  write('rainfall.json',archive);console.log('Rainfall saved:',readings.length,'daily records; accepted',acceptedYears,'distance',distanceKm.toFixed(2),'km');
}
async function captureForecast(){const url=`https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${center.lat}&longitude=${center.lon}&hourly=rain,showers,snowfall&models=gfs_seamless&forecast_days=3&timezone=UTC`,raw=await json(url,{},40000);const data=validateRainEnsemble(raw,new Date().toISOString(),url,'capture');data.source.digest=digest(raw);write('forecast.json',data);console.log('Forecast saved:',data.members.length,'members;',data.timesUTC.length,'UTC hourly values');}

function parseCSV(line:string){const fields:string[]=[];let text='',quote=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quote&&line[i+1]==='"'){text+='"';i++;}else quote=!quote;}else if(c===','&&!quote){fields.push(text);text='';}else text+=c;}fields.push(text.replace(/\r$/,''));return fields;}
async function captureTrees(){
  const url='https://data.london.gov.uk/download/2r45m/e62a6a1f-390d-4193-ae32-3aabd9846f36/Borough_tree_list_2025Nov.csv';
  const response=await fetch(url,{signal:AbortSignal.timeout(240000)});if(!response.ok||!response.body)throw new Error('GLA inventory download failed.');
  const decoder=new TextDecoder(),reader=response.body.getReader(),hash=createHash('sha256');let pending='',headers:string[]|null=null,totalRows=0;const rawRecords:Record<string,string>[]=[];const trees:CampusTree[]=[];
  function line(text:string){if(!text.trim())return;const values=parseCSV(text);if(!headers){headers=values.map(v=>v.replace(/^\uFEFF/,''));return;}totalRows++;const row=Object.fromEntries(headers.map((header,i)=>[header,values[i]??'']));const lat=Number(row.lat),lon=Number(row.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon)||!inside(lat,lon))return;
    rawRecords.push(row);const point=xy(lat,lon),height=recordedDimension(row.height_m),crown=recordedDimension(row.canopy_m),recorded=height>0&&height<60&&crown>0&&crown<80;
    // Mixed/unknown dimensions are deliberately classified as assumed; original fields stay available.
    trees.push({id:`gla-${row.uniqueid}`,x:point.x,z:point.z,heightM:height>0&&height<60?height:10,crownRadiusM:crown>0&&crown<80?crown/2:3,dimensionsSource:recorded?'recorded':'assumed',sourceId:'gla-public-trees-2025',species:row.taxon_species||row.common_name||undefined});
  }
  while(true){const chunk=await reader.read();if(chunk.done)break;hash.update(chunk.value);pending+=decoder.decode(chunk.value,{stream:true});const lines=pending.split('\n');pending=lines.pop()??'';lines.forEach(line);}
  pending+=decoder.decode();if(pending)line(pending);
  const source:SourceStamp={id:'gla-public-trees-2025',title:'GLA London Public Realm Trees, November 2025 inventory',url,license:'Open Government Licence v3.0',attribution:'Greater London Authority; GiGL; contributing London boroughs',retrievedAt:new Date().toISOString(),observedAt:'2025-11',kind:'mapped',digest:hash.digest('hex'),notes:['Inventory covers public-realm trees only; missing records do not imply absent trees.','Records differ by borough and may retain older survey information.','Crown diameter and height are recorded where valid; otherwise 6 m crown diameter and 10 m height are explicit geometric assumptions.','The dataset digest refers to the full original CSV; only study-area rows are bundled.']};
  write('trees-clipped.json',{source,trees,rawRecords,totalRows});console.log('Trees clipped:',trees.length,'from',totalRows,'records');return {source,trees,rawRecords};
}

async function captureStudy(){
  const previousStudy=fs.existsSync(path.join(out,'study.json'))?JSON.parse(fs.readFileSync(path.join(out,'study.json'),'utf8')) as StudyArea:null;
  const retainedSource=process.argv.includes('--from-cache')?previousStudy?.sources.find(source=>source.id==='osm-southwark'):undefined;
  const bbox=bounds.map(value=>value.toFixed(7)).join(',');
  const query=`[out:json][timeout:45];(way["building"](${bbox});relation["building"](${bbox});way["highway"](${bbox});way["leisure"="park"](${bbox});way["landuse"~"grass|recreation_ground"](${bbox});node["railway"~"station|subway_entrance"](${bbox});node["amenity"~"university|college|community_centre|library"](${bbox});way["amenity"~"university|college|community_centre|library"](${bbox});relation(14863884););out body geom;`;
  let raw:any;let endpoint='';
  if(process.argv.includes('--from-cache')&&fs.existsSync(path.join(out,'osm-raw.json'))){raw=JSON.parse(fs.readFileSync(path.join(out,'osm-raw.json'),'utf8'));endpoint=retainedSource?.url??'https://overpass-api.de/api/interpreter';console.log('Reprocessing retained original OSM capture.');}
  else for(const candidate of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter']){try{raw=await json(candidate,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`data=${encodeURIComponent(query)}`},70000);endpoint=candidate;break;}catch(error){console.warn('Overpass source retry:',error instanceof Error?error.message:error);}}
  if(!raw?.elements?.length)throw new Error('No public OSM study data were captured.');
  write('osm-raw.json',{query,...raw});console.log('OSM raw checkpoint:',raw.elements.length,'elements from',endpoint);
  const elements:OsmElement[]=raw.elements,normalized=normalizeCampusBuildings(elements,xy),greenAreas:StudyArea['greenAreas']=[],nodeMap=new Map<string,WalkNode>(),edges:WalkEdge[]=[];
  for(const element of elements){const tags=element.tags??{};
    if(element.type==='way'&&element.geometry&&(tags.leisure==='park'||['grass','recreation_ground'].includes(tags.landuse))){const polygon=element.geometry.map(p=>xy(p.lat,p.lon));if(polygon.length>=4)greenAreas.push({id:`osm-way-${element.id}`,polygon,name:tags.name||'Mapped green space'});}
    if(element.type!=='way'||!tags.highway||!element.geometry||!element.nodes)continue;
    if(['private','no','destination'].includes(tags.access)||['private','no','destination','use_sidepath'].includes(tags.foot))continue;
    const dedicated=['footway','pedestrian','path','steps','living_street'].includes(tags.highway),street=['residential','unclassified','tertiary','secondary','primary'].includes(tags.highway),service=tags.highway==='service'&&['yes','designated','permissive'].includes(tags.foot);
    if(!dedicated&&!street&&!service)continue;
    for(let i=1;i<element.nodes.length;i++){const a=element.geometry[i-1],b=element.geometry[i];if(!a||!b||!inside(a.lat,a.lon)||!inside(b.lat,b.lon))continue;const from=String(element.nodes[i-1]),to=String(element.nodes[i]),p=xy(a.lat,a.lon),q=xy(b.lat,b.lon),lengthM=Math.hypot(q.x-p.x,q.z-p.z);if(lengthM<=0)continue;nodeMap.set(from,{id:from,...p});nodeMap.set(to,{id:to,...q});edges.push({id:`${element.id}-${i}`,from,to,lengthM,wayId:element.id,steps:tags.highway==='steps',name:tags.name});}
  }
  const uniqueBuildings=normalized.buildings;
  const nodes=[...nodeMap.values()];if(!nodes.length||!edges.length)throw new Error('No mapped walk graph available.');
  const nearest=(point:Vec2)=>nodes.reduce((best,node)=>Math.hypot(node.x-point.x,node.z-point.z)<Math.hypot(best.x-point.x,best.z-point.z)?node:best,nodes[0]);
  const coordinates=(element:OsmElement)=>{if(element.lat!==undefined&&element.lon!==undefined)return {lat:element.lat,lon:element.lon};if(element.center)return element.center;const g=element.geometry??element.members?.flatMap(member=>member.geometry??[]);if(!g?.length)return null;return {lat:g.reduce((sum,p)=>sum+p.lat,0)/g.length,lon:g.reduce((sum,p)=>sum+p.lon,0)/g.length};};
  const destinations:CampusDestination[]=[];
  const candidates=[{id:'campus',name:'London South Bank University',match:(e:OsmElement)=>e.type==='relation'&&e.id===14863884,kind:'campus' as const},{id:'elephant-castle',name:'Elephant & Castle',match:(e:OsmElement)=>/Elephant.*Castle/i.test(e.tags?.name??'')&&Boolean(e.tags?.railway),kind:'transit' as const},{id:'southwark-station',name:'Southwark station',match:(e:OsmElement)=>/Southwark/i.test(e.tags?.name??'')&&Boolean(e.tags?.railway),kind:'transit' as const},{id:'southwark-college',name:'Southwark College',match:(e:OsmElement)=>/Southwark College/i.test(e.tags?.name??''),kind:'community' as const}];
  for(const candidate of candidates){const element=elements.find(candidate.match);if(!element)continue;const ll=coordinates(element);if(!ll||!inside(ll.lat,ll.lon))continue;const point=xy(ll.lat,ll.lon),node=nearest(point);destinations.push({id:candidate.id,name:element.tags?.name||candidate.name,...point,nodeId:node.id,kind:candidate.kind});}
  if(!destinations.some(d=>d.kind==='campus')){const campus=uniqueBuildings.find(b=>/London South Bank|LSBU|Keyworth|Perry/i.test(b.name));if(campus){const point={x:campus.polygon.reduce((s,p)=>s+p.x,0)/campus.polygon.length,z:campus.polygon.reduce((s,p)=>s+p.z,0)/campus.polygon.length},node=nearest(point);destinations.unshift({id:'campus',name:campus.name,...point,nodeId:node.id,kind:'campus'});}}
  const campusRoofs=uniqueBuildings.filter(b=>/London South Bank|LSBU|Keyworth|Perry|K2|London Road/i.test(b.name)||['university','college'].includes(b.tags.amenity??'')||b.tags.building==='university').filter((building,_,all)=>!all.some(other=>other.osmId===building.osmId&&other.areaM2>building.areaM2));
  const defaultRoofIds=campusRoofs.sort((a,b)=>{const near=(b:CampusBuilding)=>{const p=b.polygon[0];return Math.hypot(p.x,p.z);};return near(a)-near(b);}).slice(0,3).map(b=>b.id);
  if(!defaultRoofIds.length)throw new Error('No mapped university/college roofs available; do not invent them.');
  const shadeTargets=[{x:-90,z:80},{x:45,z:125},{x:130,z:230},{x:-220,z:180},{x:110,z:-80},{x:250,z:310}];
  const retainedSites=previousStudy?.id==='southwark-lsbu-public-study'&&previousStudy.shadeSites.length===6&&previousStudy.shadeSites.every(site=>!site.surveyed&&Number.isFinite(site.x)&&Number.isFinite(site.z))?previousStudy.shadeSites:null;
  const shadeSites:ShadeSite[]=retainedSites??shadeTargets.map((point,i)=>{const n=nearest(point);return {id:`concept-sail-${i+1}`,label:['Campus west approach','Borough Road approach','Elephant approach','Community path','Campus north approach','Transit approach'][i],type:'sail',x:n.x+4,z:n.z+4,widthM:12,depthM:6,heightM:4,crownRadiusM:0,rotation:0,surveyed:false};});
  const retrievedAt=retainedSource?.retrievedAt??new Date().toISOString(),osmSource:SourceStamp={id:'osm-southwark',title:'OpenStreetMap Southwark study geometry',url:endpoint,license:'ODbL 1.0',attribution:'© OpenStreetMap contributors',retrievedAt,observedAt:raw.osm3s?.timestamp_osm_base,kind:'mapped',digest:retainedSource?.digest??digest(raw),notes:['Coordinates are x east / z south metres around the study center.','Mapped building levels use an assumed 3 m per level; absent heights use an assumed 10 m.',`${normalized.courtyardCount} original inner rings are retained and deducted from roof catchment area (${normalized.courtyardAreaM2.toFixed(2)} m²). ${normalized.removedDuplicates} duplicate parent/member roof representation removed.`,...(normalized.unclosedInnerRings||normalized.unclosedOuterRings?[`${normalized.unclosedInnerRings} incomplete inner and ${normalized.unclosedOuterRings} incomplete outer rings could not be normalized; no synthetic closures were added.`]:[]),'Paths and public street centerlines share exact original OSM node IDs. No synthetic road-crossing connectors were added.','Public street centerlines are pedestrian-access proxies, not a complete sidewalk or verified crossing/accessibility survey.','POIs attach to their nearest mapped graph node; final entrances and access require a survey.','Six shade-sail sites are conceptual, unsurveyed placements near mapped routes; feasibility is not established.']};
  let trees:CampusTree[]=[],rawTreeRecords:unknown=[],treeSource:SourceStamp|undefined;
  const study:StudyArea={schema:'terratrace-campus-study-v1',id:'southwark-lsbu-public-study',name:'Southwark Campus Resilience Study',subtitle:'A public-data study around London South Bank University; no institutional partnership is claimed.',center,timezone:'Europe/London',radiusM,bounds,retrievedAt,sources:[osmSource],buildings:uniqueBuildings,trees,greenAreas,graph:{nodes,edges,sourceId:osmSource.id},destinations,shadeSites,defaultRoofIds,coverage:{lidar:false,trees:'unavailable',notes:['No verified local LiDAR clip is bundled. Building heights retain mapped/floors/assumed provenance.','Public tree inventory is incomplete and cannot establish absence of canopy.','No pedestrian counts, indoor demand, roof connection surveys, or installed interventions are provided.']},rawGeometry:{query,...raw},rawTreeRecords};
  write('study.json',study);console.log('OSM study checkpoint saved:',uniqueBuildings.length,'buildings;',nodes.length,'nodes;',edges.length,'edges');
  if(!process.argv.includes('--no-trees')){
    let saved:any;try{saved=fs.existsSync(path.join(out,'trees-clipped.json'))?JSON.parse(fs.readFileSync(path.join(out,'trees-clipped.json'),'utf8')):await captureTrees();}catch(error){console.warn('GLA tree layer unavailable:',error instanceof Error?error.message:error);try{saved=await captureMappedTrees(center,radiusM);write('trees-clipped.json',saved);}catch(error){console.warn('Mapped tree fallback unavailable:',error instanceof Error?error.message:error);}}
    if(saved){trees=saved.trees;rawTreeRecords=saved.rawRecords;treeSource=saved.source;study.trees=trees;study.rawTreeRecords=rawTreeRecords;if(treeSource)study.sources.push(treeSource);study.coverage.trees=trees.length?'partial':'unavailable';}
  }
  write('study.json',study);console.log('Study saved:',uniqueBuildings.length,'buildings;',nodes.length,'nodes;',edges.length,'edges;',trees.length,'trees;',destinations.length,'destinations; roofs:',defaultRoofIds);
}

for(const [name,task] of [['rain',captureRain],['forecast',captureForecast],['study',captureStudy]] as const){if(process.argv.includes('--study-only')&&name!=='study')continue;try{await task();}catch(error){console.error(`${name} capture failed:`,error instanceof Error?error.message:error);process.exitCode=1;}}
