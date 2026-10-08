import { finite, type Hour } from "./climate";
type Tree = { size: number; feature?: number; split?: number; left?: Tree; right?: Tree };
function c(n: number) { return n <= 1 ? 0 : n === 2 ? 1 : 2 * (Math.log(n - 1) + .5772156649) - 2 * (n - 1) / n; }
/** Genuine unsupervised Isolation Forest; deterministic seed for reproducible evidence. */
export function isolationScores(points: number[][], seed = 2026): number[] {
  if(points.length<8) return [];
  const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296};
  const build=(data:number[][],depth:number):Tree=>{
    if(depth>=Math.ceil(Math.log2(points.length))||data.length<=1)return {size:data.length};
    const features=points[0].map((_,f)=>f).filter(f=>Math.max(...data.map(p=>p[f]))>Math.min(...data.map(p=>p[f])));
    if(!features.length)return {size:data.length};
    const feature=features[Math.floor(random()*features.length)];const lo=Math.min(...data.map(p=>p[feature])),hi=Math.max(...data.map(p=>p[feature]));const split=lo+random()*(hi-lo);
    return {size:data.length,feature,split,left:build(data.filter(p=>p[feature]<split),depth+1),right:build(data.filter(p=>p[feature]>=split),depth+1)};
  };
  const forest=Array.from({length:64},()=>build(points,0));
  const path=(p:number[],t:Tree,depth=0):number=>t.feature===undefined?depth+c(t.size):path(p,(p[t.feature]<t.split!?t.left:t.right)!,depth+1);
  return points.map(p=>Math.pow(2,-forest.reduce((s,t)=>s+path(p,t),0)/forest.length/c(points.length)));
}
export function analyzeSignals(all: Hour[]) {
  const valid=all.filter(h=>finite(h.temperature)&&finite(h.humidity)&&finite(h.pm25));
  const scores=isolationScores(valid.map(h=>[h.temperature!,h.humidity!,h.pm25!]));
  return valid.map((h,i)=>({...h,score:scores[i]??0})).sort((a,b)=>b.score-a.score);
}
