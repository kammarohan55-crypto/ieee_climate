import {type City} from '@/lib/climate';
import {boundsFor,normalizeUrban,osmMapGeometry,type UrbanData} from '@/lib/twin';
const cache=new Map<string,{at:number;data:UrbanData}>(),pending=new Map<string,Promise<UrbanData>>();
const endpoint='https://maps.mail.ru/osm/tools/overpass/api/interpreter';
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,lat=Number(q.get('lat')),lon=Number(q.get('lon'));
 if(!q.has('lat')||!q.has('lon')||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>80||Math.abs(lon)>179.9)return Response.json({error:'A location between 80°S and 80°N is required.'},{status:400});
 const city:City={id:(q.get('id')??`custom-${lat}-${lon}`).slice(0,100),name:(q.get('name')??'Selected city').slice(0,80),country:(q.get('country')??'').slice(0,80),lat,lon},key=`${lat.toFixed(4)},${lon.toFixed(4)}`;
 const saved=cache.get(key);if(saved&&Date.now()-saved.at<86400000)return Response.json({...saved.data,city},{headers:{'Cache-Control':'public, max-age=3600'}});
 try{
  let work=pending.get(key);if(!work){work=(async()=>{const bounds=boundsFor(city).map(n=>n.toFixed(6)).join(','),query=`[out:json][timeout:22];(way["building"](${bounds});way["highway"](${bounds});way["leisure"="park"](${bounds});way["landuse"~"forest|grass|recreation_ground"](${bounds});way["natural"~"wood|water"](${bounds}););out geom;`;
   let data:UrbanData;
   try{const r=await fetch(endpoint+'?data='+encodeURIComponent(query),{headers:{'User-Agent':'TerraTrace-Climate-Research/1.0'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();data=normalizeUrban(await r.json(),city,endpoint,query)}
   catch{const [s,w,n,e]=boundsFor(city),url=`https://api.openstreetmap.org/api/0.6/map.json?bbox=${w},${s},${e},${n}`;const r=await fetch(url,{headers:{'User-Agent':'TerraTrace-Climate-Research/1.0'},signal:AbortSignal.timeout(15000)});if(!r.ok||Number(r.headers.get('content-length')??0)>12000000)throw Error('Map provider unavailable.');data=normalizeUrban(osmMapGeometry(await r.json()),city,url,url);data.osmTime=data.retrievedAt;data.timeKind='retrieved';}
   if(cache.size>=8)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),data});return data})();pending.set(key,work)}
  const data=await work;return Response.json({...data,city},{headers:{'Cache-Control':'public, max-age=3600, stale-while-revalidate=86400'}});
 }catch{return Response.json({error:'Map data is temporarily unavailable. Try a featured city or retry later.'},{status:503})}finally{pending.delete(key)}
}
