export async function GET(request: Request) {
  const name = (new URL(request.url).searchParams.get("q")??"").trim().slice(0,80);
  if(name.length<2) return Response.json({results:[]});
  try { const response=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=8&language=en&format=json`,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();return Response.json(await response.json(),{headers:{"Cache-Control":"public,max-age=3600"}}); }
  catch { return Response.json({error:"City search is temporarily unavailable. Choose a featured city."},{status:503}); }
}
