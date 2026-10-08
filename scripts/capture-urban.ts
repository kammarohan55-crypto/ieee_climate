import fs from 'node:fs';
import {CITIES} from '../lib/climate';
import {boundsFor,normalizeUrban} from '../lib/twin';
fs.mkdirSync('public/urban',{recursive:true});
for(const city of CITIES){
 if(fs.existsSync(`public/urban/${city.id}.json`)&&!JSON.parse(fs.readFileSync(`public/urban/${city.id}.json`,'utf8')).truncated)continue;
 const bounds=boundsFor(city).map(n=>n.toFixed(6)).join(','),query=`[out:json][timeout:22];(way["building"](${bounds});way["highway"](${bounds});way["leisure"="park"](${bounds});way["landuse"~"forest|grass|recreation_ground"](${bounds});way["natural"~"wood|water"](${bounds}););out geom;`;
 const endpoint='https://overpass-api.de/api/interpreter';
 try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'TerraTrace-Research/1.0 (https://terratrace-climate-observatory.cozy-stone-1263.chatgpt.site)'},body:'data='+encodeURIComponent(query),signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('HTTP '+r.status);const d=normalizeUrban(await r.json(),city,endpoint,query);d.status='capture';fs.writeFileSync(`public/urban/${city.id}.json`,JSON.stringify(d));console.log(city.name,d.features.length,d.osmTime)}catch(e){console.log(city.name,'unavailable',e instanceof Error?e.message:'')}
}
