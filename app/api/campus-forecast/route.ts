import {validateRainEnsemble} from '@/lib/campus-water';
import type {RainEnsemble} from '@/lib/campus-types';

const SOURCE='https://ensemble-api.open-meteo.com/v1/ensemble?latitude=51.4977025&longitude=-0.1018199&hourly=rain,showers,snowfall&models=gfs_seamless&forecast_days=3&timezone=UTC';
let cache:{at:number;data:RainEnsemble}|null=null;
export async function GET(){
  if(cache&&Date.now()-cache.at<300000)return Response.json(cache.data,{headers:{'Cache-Control':'public, max-age=180'}});
  try{
    const response=await fetch(SOURCE,{signal:AbortSignal.timeout(14000),headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`Forecast provider returned ${response.status}.`);
    const raw=await response.json(),data=validateRainEnsemble(raw,new Date().toISOString(),SOURCE,'live');
    // A refresh is an indivisible snapshot. Never merge members from different captures.
    cache={at:Date.now(),data};return Response.json(data,{headers:{'Cache-Control':'public, max-age=180'}});
  }catch(error){return Response.json({available:false,error:error instanceof Error?error.message:'The forecast is temporarily unavailable.',capturedFallback:'/campus/forecast.json'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
