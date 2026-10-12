import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {CITIES,type City,type ClimateData,type ModelResponse} from '../lib/climate';

type SourceResult={model:ModelResponse|null;retrievedAt:string|null;attempts:number;error?:string};
type CapturedClimate=ClimateData&{sourceRetrievedAt:{weather:string|null;air:string|null};sourceAttempts:{weather:number;air:number}};
const captureStartedAt=new Date().toISOString();
const data:CapturedClimate[]=new Array(CITIES.length);

// Keep these query strings identical to app/api/climate/route.ts. The full originals
// are retained in each capture; provider JSON and source timestamps are not rewritten.
function urls(city:City){
 const common=`latitude=${city.lat}&longitude=${city.lon}&timezone=auto&forecast_days=3`;
 return {
  weather:`https://api.open-meteo.com/v1/forecast?${common}&precipitation_unit=mm&current=temperature_2m,relative_humidity_2m,apparent_temperature,cloud_cover,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,global_tilted_irradiance,shortwave_radiation,rain,showers&daily=temperature_2m_max,temperature_2m_min&tilt=${Math.round(Math.abs(city.lat))}&azimuth=${city.lat<0?180:0}`,
  air:`https://air-quality-api.open-meteo.com/v1/air-quality?${common}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&hourly=us_aqi,pm2_5`,
 };
}

async function captureSource(url:string,kind:'weather'|'air'):Promise<SourceResult>{
 let error='Provider unavailable.';
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(14000)});
   if(!response.ok)throw Error(`HTTP ${response.status}`);
   const model=await response.json() as ModelResponse;
   const retrievedAt=new Date().toISOString();
   if(typeof model.current?.time!=='string'||!Array.isArray(model.hourly?.time)||!model.hourly.time.length)throw Error('Missing current or hourly data.');
   if(kind==='weather'&&['rain','showers'].some(field=>!Array.isArray(model.hourly[field])||model.hourly[field].length!==model.hourly.time.length||model.hourly_units?.[field]!=='mm'))throw Error('Rainfall arrays or millimeter units are missing.');
   return {model,retrievedAt,attempts:attempt};
  }catch(e){error=e instanceof Error?e.message:'Unknown provider failure.';if(attempt<3)await new Promise(resolve=>setTimeout(resolve,500*attempt));}
 }
 return {model:null,retrievedAt:null,attempts:3,error};
}

let nextCity=0;
async function worker(){
 for(;;){
  const index=nextCity++;if(index>=CITIES.length)return;
  const city=CITIES[index],sources=urls(city);
  // Two city workers × two sources gives at most four simultaneous requests.
  const [weather,air]=await Promise.all([captureSource(sources.weather,'weather'),captureSource(sources.air,'air')]);
  const errors:string[]=[];
  if(weather.error)errors.push(`Weather capture unavailable: ${weather.error}`);
  if(air.error)errors.push(`Air-quality capture unavailable: ${air.error}`);
  data[index]={city,weather:weather.model,air:air.model,sources,retrievedAt:new Date().toISOString(),status:weather.model&&air.model?'snapshot':'partial',errors,sourceRetrievedAt:{weather:weather.retrievedAt,air:air.retrievedAt},sourceAttempts:{weather:weather.attempts,air:air.attempts}};
  console.log(`${city.name}: weather ${weather.model?'captured':'unavailable'}, air ${air.model?'captured':'unavailable'}; ${data[index].retrievedAt}`);
 }
}

await Promise.all([worker(),worker()]);
const capture={schemaVersion:2,captureStartedAt,captureCompletedAt:new Date().toISOString(),description:'Authentic dated Open-Meteo provider responses. Rain and showers are preceding-hour liquid totals in mm. Missing providers remain null; no older sources are merged.',attribution:{weather:'Weather data by Open-Meteo',air:'Copernicus CAMS / CAMS ENSEMBLE via Open-Meteo',licence:'CC BY 4.0',licenceUrl:'https://open-meteo.com/en/licence',weatherDocumentation:'https://open-meteo.com/en/docs',airDocumentation:'https://open-meteo.com/en/docs/air-quality-api'},data};
const destination=fileURLToPath(new URL('../public/climate-reference-v2.json',import.meta.url));
await writeFile(destination,JSON.stringify(capture,null,2)+'\n','utf8');
console.log(`Saved ${data.length} locations; ${data.filter(entry=>entry.status==='partial').length} partial entries. Original reference-data.json remains unchanged.`);
