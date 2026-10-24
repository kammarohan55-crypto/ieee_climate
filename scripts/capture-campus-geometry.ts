import type {CampusBuilding,Vec2} from '../lib/campus-types';

export type OsmBuildingElement={type:string;id:number;geometry?:{lat:number;lon:number}[];tags?:Record<string,string>;members?:{type:string;ref:number;role:string;geometry?:{lat:number;lon:number}[]}[]};
export const polygonArea=(polygon:Vec2[])=>Math.abs(polygon.reduce((sum,point,index)=>{const next=polygon[(index+1)%polygon.length];return sum+point.x*next.z-next.x*point.z;},0))/2;
const numeric=(value:string|undefined)=>value?Number.parseFloat(value.replace(',','.')):NaN;
const contains=(point:Vec2,polygon:Vec2[])=>{let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.z>point.z)!==(b.z>point.z)&&point.x<(b.x-a.x)*(point.z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside;};

/** Closed source rings only. No synthetic edges are introduced to complete partial geometry. */
export function normalizeCampusBuildings(elements:OsmBuildingElement[],project:(lat:number,lon:number)=>Vec2){
  const buildings:CampusBuilding[]=[],wayById=new Map(elements.filter(element=>element.type==='way').map(element=>[element.id,element]));
  let unclosedInnerRings=0,unclosedOuterRings=0;
  const ring=(geometry:{lat:number;lon:number}[]|undefined):Vec2[]|null=>{
    if(!geometry||geometry.length<4||geometry[0].lat!==geometry.at(-1)!.lat||geometry[0].lon!==geometry.at(-1)!.lon)return null;
    return geometry.slice(0,-1).map(point=>project(point.lat,point.lon));
  };
  function insert(element:OsmBuildingElement,polygon:Vec2[],holes:Vec2[][]=[],component?:number,innerIds:number[]=[]){
    const areaM2=polygonArea(polygon)-holes.reduce((sum,hole)=>sum+polygonArea(hole),0);if(areaM2<10)return;
    // A component can carry its own mapped height while the relation supplies the building name.
    const tags={...(component?wayById.get(component)?.tags:{}),...(element.tags??{})},height=numeric(tags.height),floors=numeric(tags['building:levels']);
    const heightSource=height>0&&height<=300?'mapped':floors>0&&floors<100?'floors':'assumed',heightM=heightSource==='mapped'?height:heightSource==='floors'?floors*3:10;
    buildings.push({id:`osm-${element.type}-${element.id}${component?`-outer-${component}`:''}`,osmId:element.id,name:tags.name||tags['addr:housename']||`Mapped ${tags.building||'building'}`,polygon,...(holes.length?{holes}:{}),areaM2:Math.round(areaM2*100)/100,heightM,heightSource,tags:component?{...tags,'terratrace:outer_way':String(component),...(innerIds.length?{'terratrace:inner_ways':innerIds.join(',')}:{})}:tags});
  }
  for(const element of elements){
    if(!element.tags?.building)continue;
    if(element.type==='way'){const polygon=ring(element.geometry);if(polygon)insert(element,polygon);else unclosedOuterRings++;}
    if(element.type==='relation'){
      const inner=(element.members??[]).filter(member=>member.role==='inner').flatMap(member=>{const polygon=ring(member.geometry);if(!polygon){unclosedInnerRings++;return [];}return [{id:member.ref,polygon}];});
      for(const member of element.members??[])if(member.role==='outer'){
        const polygon=ring(member.geometry);if(!polygon){unclosedOuterRings++;continue;}
        const ownedHoles=inner.filter(hole=>contains(hole.polygon[0],polygon));insert(element,polygon,ownedHoles.map(hole=>hole.polygon),member.ref,ownedHoles.map(hole=>hole.id));
      }
    }
  }
  // A relation's outer component and its separately tagged way describe the same roof.
  const representedOuterWays=new Set(buildings.filter(building=>building.id.startsWith('osm-relation-')).map(building=>Number(building.tags['terratrace:outer_way'])));
  const kept=buildings.filter((building,index)=>!(building.id.startsWith('osm-way-')&&representedOuterWays.has(building.osmId))&&buildings.findIndex(other=>other.id===building.id)===index);
  return {buildings:kept,removedDuplicates:buildings.length-kept.length,courtyardCount:kept.reduce((sum,building)=>sum+(building.holes?.length??0),0),courtyardAreaM2:kept.reduce((sum,building)=>sum+(building.holes??[]).reduce((area,hole)=>area+polygonArea(hole),0),0),unclosedInnerRings,unclosedOuterRings};
}
