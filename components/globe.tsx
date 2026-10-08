"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Minus, Plus, RotateCcw } from "lucide-react";
import { CITIES, aqiCategory, finite, type City, type ClimateData } from "@/lib/climate";
type Geo = {points:number[][];rings:number[][][]};
export default function Planet({data,selected,layer,onSelect}:{data:ClimateData[];selected:City;layer:string;onSelect:(city:City)=>void}) {
  const canvas=useRef<HTMLCanvasElement>(null);const wrapper=useRef<HTMLDivElement>(null);const rotation=useRef({lon:58,lat:16});const positions=useRef<{x:number;y:number;city:City}[]>([]);const drag=useRef<{x:number;y:number;moved:boolean}|null>(null);const [geo,setGeo]=useState<Geo|null>(null);const [paused,setPaused]=useState(false);const [zoom,setZoom]=useState(1);const [hover,setHover]=useState("");const props=useRef({data,selected,layer,onSelect,paused,zoom});props.current={data,selected,layer,onSelect,paused,zoom};
  useEffect(()=>{fetch("/globe-land.json").then(r=>r.json()).then(value=>setGeo(value as Geo)).catch(()=>setHover("Geographic layer unavailable"));setPaused(window.matchMedia("(prefers-reduced-motion: reduce)").matches);},[]);
  useEffect(()=>{rotation.current.lon=selected.lon;rotation.current.lat=selected.lat*.5;},[selected.id,selected.lat,selected.lon]);
  useEffect(()=>{
    if(!geo || !canvas.current || !wrapper.current)return;const el=canvas.current,ctx=el.getContext("2d");if(!ctx)return;let frame=0,last=0;let width=600,height=340;
    const resize=new ResizeObserver(([e])=>{width=e.contentRect.width;height=e.contentRect.height;const dpr=Math.min(devicePixelRatio,2);el.width=width*dpr;el.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);});resize.observe(wrapper.current);
    const render=(time:number)=>{frame=requestAnimationFrame(render);if(time-last<32)return;last=time;const {data,selected,layer,paused,zoom}=props.current;if(!paused&&!drag.current)rotation.current.lon+=.025;
      const rad=Math.PI/180,centerX=width*.5,centerY=height*.48,R=Math.min(width*.36,height*.425)*zoom,lon=rotation.current.lon*rad,lat=rotation.current.lat*rad;
      const project=(lng:number,lt:number)=>{const a=lng*rad-lon,b=lt*rad,x=Math.cos(b)*Math.sin(a),y=Math.sin(b)*Math.cos(lat)-Math.cos(b)*Math.cos(a)*Math.sin(lat),z=Math.sin(b)*Math.sin(lat)+Math.cos(b)*Math.cos(a)*Math.cos(lat);return {x:centerX+x*R,y:centerY-y*R,z};};
      ctx.clearRect(0,0,width,height);
      const glow=ctx.createRadialGradient(centerX,centerY,R*.65,centerX,centerY,R*1.22);glow.addColorStop(0,"#2f8c7122");glow.addColorStop(.7,"#499e7825");glow.addColorStop(1,"#1a634800");ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
      const ocean=ctx.createRadialGradient(centerX-R*.38,centerY-R*.5,0,centerX,centerY,R);ocean.addColorStop(0,"#173b32");ocean.addColorStop(.65,"#102b25");ocean.addColorStop(1,"#081a16");ctx.fillStyle=ocean;ctx.beginPath();ctx.arc(centerX,centerY,R,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#62937e70";ctx.lineWidth=.7;ctx.stroke();
      ctx.save();ctx.beginPath();ctx.arc(centerX,centerY,R,0,Math.PI*2);ctx.clip();
      const line=(coords:number[][],color:string,lw:number)=>{ctx.beginPath();let started=false;for(const [a,b] of coords){const p=project(a,b);if(p.z<.015){started=false;continue;}if(started)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);started=true;}ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.stroke();};
      for(let b=-75;b<=75;b+=15)line(Array.from({length:181},(_,i)=>[-180+i*2,b]),"#609b8040",.5);
      for(let a=-180;a<180;a+=20)line(Array.from({length:91},(_,i)=>[a,-90+i*2]),"#609b8035",.5);
      for(const ring of geo.rings)line(ring,"#8acbad65",.7);
      for(const [lng,lt] of geo.points){const p=project(lng,lt);if(p.z<0)continue;ctx.fillStyle=`rgba(126,191,148,${.1+p.z*.48})`;ctx.beginPath();ctx.arc(p.x,p.y,.7+p.z*.25,0,Math.PI*2);ctx.fill();}
      ctx.restore();positions.current=[];const cities=[...CITIES];if(!cities.some(c=>c.id===selected.id))cities.push(selected);
      for(const city of cities){const p=project(city.lon,city.lat);if(p.z<.05)continue;positions.current.push({x:p.x,y:p.y,city});const d=data.find(d=>d.city.id===city.id);const aqi=d?.air?.current.us_aqi;const color=layer==="Air quality"?aqiCategory(aqi).color:layer==="Temperature"?(finite(d?.weather?.current.temperature_2m)&&Number(d?.weather?.current.temperature_2m)>25?"#efbd80":"#a6d9e3"):"#d0f794";
        const isSelected=selected.id===city.id;const pulse=isSelected?(paused?5:5+Math.sin(time*.002)*1.8):4;ctx.beginPath();ctx.arc(p.x,p.y,pulse+5,0,Math.PI*2);ctx.fillStyle=color+"17";ctx.fill();ctx.strokeStyle=color+"55";ctx.lineWidth=.7;ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,isSelected?3.8:2.5,0,Math.PI*2);ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=isSelected?12:6;ctx.fill();ctx.shadowBlur=0;
        if(isSelected || p.z>.5){ctx.font=`${isSelected?"550":"400"} 11px 'DM Sans',sans-serif`;const textWidth=ctx.measureText(city.name).width;const labelX=Math.min(width-textWidth-12,p.x+13),labelY=p.y-8;ctx.fillStyle="#0b1915dd";ctx.fillRect(labelX-4,labelY-12,textWidth+8,19);ctx.fillStyle=isSelected?"#e4f5d6":"#a6c7b4";ctx.fillText(city.name,labelX,labelY);}
      }
      ctx.setLineDash([2,5]);ctx.strokeStyle="#638e6c35";ctx.beginPath();ctx.ellipse(centerX,centerY,R*1.2,R*.36,-.23,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    };frame=requestAnimationFrame(render);return()=>{cancelAnimationFrame(frame);resize.disconnect();};
  },[geo]);
  return <div className="globe-wrap" ref={wrapper}><canvas ref={canvas} aria-label="Interactive globe of environmental forecast locations. Drag to rotate or choose a city below." onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,moved:false};}} onPointerMove={e=>{if(drag.current){const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>2)drag.current.moved=true;rotation.current.lon-=dx*.4;rotation.current.lat=Math.max(-65,Math.min(65,rotation.current.lat+dy*.3));drag.current.x=e.clientX;drag.current.y=e.clientY;}else{const box=e.currentTarget.getBoundingClientRect();const p=positions.current.find(p=>Math.hypot(p.x-e.clientX+box.x,p.y-e.clientY+box.y)<15);setHover(p?.city.name??"");}}} onPointerUp={e=>{if(!drag.current?.moved){const box=e.currentTarget.getBoundingClientRect();const p=positions.current.find(p=>Math.hypot(p.x-e.clientX+box.x,p.y-e.clientY+box.y)<18);if(p)onSelect(p.city);}drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}/>
    <div className="globe-coordinates"><span>LAT {selected.lat.toFixed(2)}°</span><span>LON {selected.lon.toFixed(2)}°</span></div><div className="globe-caption">{hover||"Drag to rotate · select a location"}</div><div className="globe-controls"><button title={paused?"Rotate globe":"Pause rotation"} aria-label={paused?"Rotate globe":"Pause rotation"} onClick={()=>setPaused(!paused)}>{paused?<Play size={14}/>:<Pause size={14}/>}</button><button aria-label="Zoom in" onClick={()=>setZoom(Math.min(1.3,zoom+.1))}><Plus size={16}/></button><button aria-label="Zoom out" onClick={()=>setZoom(Math.max(.7,zoom-.1))}><Minus size={16}/></button><button aria-label="Center selected city" onClick={()=>{rotation.current={lon:selected.lon,lat:selected.lat*.5};setZoom(1);}}><RotateCcw size={14}/></button></div></div>;
}


