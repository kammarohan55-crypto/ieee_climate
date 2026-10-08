import { CITIES, type City, type ClimateData, type ModelResponse } from "@/lib/climate";
const cache = new Map<string, { at: number; data: ClimateData }>();
function urls(city: City) {
  const common = `latitude=${city.lat}&longitude=${city.lon}&timezone=auto&forecast_days=3`;
  return {
    weather: `https://api.open-meteo.com/v1/forecast?${common}&current=temperature_2m,relative_humidity_2m,apparent_temperature,cloud_cover,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,global_tilted_irradiance,shortwave_radiation&daily=temperature_2m_max,temperature_2m_min&tilt=${Math.round(Math.abs(city.lat))}&azimuth=${city.lat < 0 ? 180 : 0}`,
    air: `https://air-quality-api.open-meteo.com/v1/air-quality?${common}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&hourly=us_aqi,pm2_5`,
  };
}
async function model(url: string): Promise<ModelResponse> {
  let error: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(14000), headers: { "Accept": "application/json" } }); if (!r.ok) throw new Error(`Provider returned ${r.status}`); const data = await r.json() as ModelResponse; if (!data.current?.time || !data.hourly?.time?.length) throw new Error("Invalid model response"); return data; } catch(e) { error=e; }
  }
  throw error;
}
async function read(city: City): Promise<ClimateData> {
  const key=`${city.lat},${city.lon}`; const saved=cache.get(key); if(saved && Date.now()-saved.at<300000) return {...saved.data,city};
  const sources=urls(city); const [w,a]=await Promise.allSettled([model(sources.weather),model(sources.air)]);
  const data: ClimateData = {city,weather:w.status==="fulfilled"?w.value:null,air:a.status==="fulfilled"?a.value:null,sources,retrievedAt:new Date().toISOString(),status:w.status==="fulfilled"&&a.status==="fulfilled"?"live":"partial",errors:[w,a].filter(r=>r.status==="rejected").map(()=>"A data provider is temporarily unavailable.")};
  if(data.weather && data.air) cache.set(key,{at:Date.now(),data});
  return data;
}
export async function GET(request: Request) {
  const q=new URL(request.url).searchParams; let cities: City[];
  if(q.has("lat") || q.has("lon")) {
    const lat=Number(q.get("lat")),lon=Number(q.get("lon"));
    if(!q.has("lat")||!q.has("lon")||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) return Response.json({error:"Valid latitude and longitude are required."},{status:400});
    cities=[{id:`custom-${lat}-${lon}`,name:(q.get("name")??"Selected location").slice(0,80),country:(q.get("country")??"").slice(0,80),lat,lon}];
  } else { cities=q.get("city")?CITIES.filter(c=>c.id===q.get("city")):CITIES; if(!cities.length)return Response.json({error:"Unknown city."},{status:400}); }
  const data=await Promise.all(cities.map(read));
  return Response.json({data},{headers:{"Cache-Control":"public, max-age=180, stale-while-revalidate=300"}});
}
