/** Shared, source-preserving interfaces for the public-data campus study. */
export type Vec2 = {x:number;z:number};
export type SourceStamp = {
  id:string;title:string;url:string;license:string;attribution:string;
  retrievedAt:string;observedAt?:string;kind:'observed'|'mapped'|'derived'|'forecast'|'assumed';
  digest?:string;notes:string[];
};
export type CampusBuilding = {
  id:string;osmId:number;name:string;polygon:Vec2[];holes?:Vec2[][];areaM2:number;heightM:number;
  heightSource:'mapped'|'floors'|'assumed'|'lidar';tags:Record<string,string>;
};
export type CampusTree = {
  id:string;x:number;z:number;heightM:number;crownRadiusM:number;
  dimensionsSource:'recorded'|'lidar'|'assumed';sourceId:string;species?:string;
};
export type WalkNode = Vec2 & {id:string};
export type WalkEdge = {id:string;from:string;to:string;lengthM:number;wayId:number;steps:boolean;name?:string};
export type WalkGraph = {nodes:WalkNode[];edges:WalkEdge[];sourceId:string};
export type CampusDestination = Vec2 & {id:string;name:string;nodeId:string;kind:'campus'|'transit'|'community'};
export type ShadeSite = Vec2 & {
  id:string;label:string;type:'sail'|'tree';widthM:number;depthM:number;heightM:number;
  crownRadiusM:number;rotation:number;surveyed:boolean;
};
export type StudyArea = {
  schema:'terratrace-campus-study-v1';id:string;name:string;subtitle:string;
  center:{lat:number;lon:number};timezone:string;radiusM:number;
  bounds:[number,number,number,number];retrievedAt:string;
  sources:SourceStamp[];buildings:CampusBuilding[];trees:CampusTree[];
  greenAreas:{id:string;polygon:Vec2[];name:string}[];
  graph:WalkGraph;destinations:CampusDestination[];shadeSites:ShadeSite[];
  defaultRoofIds:string[];coverage:{lidar:boolean;trees:'partial'|'unavailable';notes:string[]};
  rawGeometry?:unknown;rawTreeRecords?:unknown;
};
export type RainReading = {date:string;valueMm:number|null;quality:string;completeness:string|null};
export type RainArchive = {
  schema:'terratrace-rain-archive-v1';source:SourceStamp;
  station:{id:string;name:string;lat:number;lon:number;distanceKm:number};
  unit:'mm';periodSeconds:86400;readings:RainReading[];acceptedYears:number[];raw:unknown;
};
export type EnsembleMember = {id:string;rainMm:(number|null)[]};
export type RainEnsemble = {
  schema:'terratrace-rain-ensemble-v1';source:SourceStamp;status:'live'|'capture';
  latitude:number;longitude:number;timesUTC:string[];members:EnsembleMember[];raw:unknown;
};
export type RoofChoice = {buildingId:string;capacityM3:number;connectedFraction:number;runoffCoefficient:number};
export type WaterSettings = {roofs:RoofChoice[];dailyDemandM3:number;startingFillFraction:number};
export type CampusScenario = {
  water:WaterSettings;shadeSiteIds:string[];departureDate:string;departureHour:number;
  speedMps:number;originId:string;destinationId:string;
};
export type WaterStep = {
  time:string;rainMm:number;inflowM3:number;bypassM3:number;overflowM3:number;
  reuseM3:number;unservedM3:number;storageM3:number;
};
export type WaterRun = {
  available:boolean;reason?:string;modelVersion:string;year?:number;
  demandM3:number;reuseM3:number;overflowM3:number;bypassM3:number;inflowM3:number;
  endingStorageM3:number;initialStorageM3:number;coveragePercent:number;steps:WaterStep[];
};
export type ShadeSample = Vec2 & {elapsedMin:number;shaded:boolean;known:boolean};
export type ShadeRoute = {
  id:string;points:Vec2[];nodeIds:string[];distanceM:number;durationMin:number;
  sunMinutes:number;shadedMinutes:number;shadePercent:number;coveragePercent:number;samples:ShadeSample[];
};
export type RouteComparison = {
  available:boolean;reason?:string;shortest:ShadeRoute|null;shadiest:ShadeRoute|null;
  routes:ShadeRoute[];consideredCount:number;modelVersion:string;
};
