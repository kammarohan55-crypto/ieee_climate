import type {ClimateData} from './climate';
import {TWIN_DEFAULTS,twinModel,type TwinSettings,type UrbanData} from './twin';
import {digest,makeReceipt} from './proof';

export type Interventions=Pick<TwinSettings,'coolRoofs'|'solarRoofs'|'trees'>;
export type Strategy={id:string;name:string;createdAt:string;interventions:Interventions};
export type PlanningSnapshot={climate:ClimateData;urban:UrbanData;assumptions:TwinSettings;digest:string;capturedAt:string;modelVersion:'district-planning-v2'};
export type PlanningWorkspace={schema:'terratrace-strategies-v1';cityId:string;snapshot:PlanningSnapshot|null;plans:Strategy[];pair:[string,string]};
export const PLAN_COLORS=['#c9ef98','#88ddd1','#b6a4ef','#edbb8b'];
export const emptyPlanning=(cityId:string):PlanningWorkspace=>({schema:'terratrace-strategies-v1',cityId,snapshot:null,plans:[],pair:['baseline','draft']});
export const interventions=(s:TwinSettings):Interventions=>({coolRoofs:s.coolRoofs,solarRoofs:s.solarRoofs,trees:s.trees});
export function validInterventions(s:Interventions){return [s.coolRoofs,s.solarRoofs,s.trees].every(Number.isFinite)&&s.coolRoofs>=0&&s.solarRoofs>=0&&s.coolRoofs+s.solarRoofs<=100&&s.trees>=0&&s.trees<=1000;}
export function planSettings(snapshot:PlanningSnapshot,plan:Strategy|'baseline'|'draft',draft:TwinSettings):TwinSettings{return {...snapshot.assumptions,...(plan==='baseline'?{coolRoofs:0,solarRoofs:0,trees:0}:plan==='draft'?interventions(draft):plan.interventions)};}
export async function planningSnapshot(climate:ClimateData,urban:UrbanData,assumptions:TwinSettings):Promise<PlanningSnapshot>{
 if(climate.city.lat!==urban.city.lat||climate.city.lon!==urban.city.lon||!twinModel(climate,urban,assumptions).complete)throw Error('A complete forecast and mapped district are needed to save a comparison.');
 const source=structuredClone({climate,urban,assumptions:{...assumptions,coolRoofs:0,solarRoofs:0,trees:0},modelVersion:'district-planning-v2' as const});
 return {...source,digest:await digest(source),capturedAt:new Date().toISOString()};
}
export async function validatePlanning(value:unknown,cityId:string):Promise<PlanningWorkspace>{
 const w=value as PlanningWorkspace;
 if(!w||w.schema!=='terratrace-strategies-v1'||w.cityId!==cityId||!Array.isArray(w.plans)||w.plans.length>4||!Array.isArray(w.pair)||w.pair.length!==2)throw Error('Saved plans could not be read. Retry loading them.');
 if(w.plans.some(p=>!p||typeof p.id!=='string'||['baseline','draft'].includes(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>48||!Number.isFinite(Date.parse(p.createdAt))||!p.interventions||!validInterventions(p.interventions))||new Set(w.plans.map(p=>p.id)).size!==w.plans.length)throw Error('Saved strategy settings are invalid.');
 if(w.plans.length&&!w.snapshot)throw Error('The saved comparison snapshot is missing.');
 if(w.snapshot){const {digest:hash,capturedAt,...source}=w.snapshot;if(source.urban?.city.id!==cityId||source.climate?.city.id!==cityId||!source.assumptions||Object.keys(TWIN_DEFAULTS).some(k=>!Number.isFinite(source.assumptions[k as keyof TwinSettings]))||source.modelVersion!=='district-planning-v2'||!Number.isFinite(Date.parse(capturedAt))||await digest(source)!==hash)throw Error('The saved source snapshot did not pass its integrity check.');}
 const ids=new Set(['baseline','draft',...w.plans.map(p=>p.id)]);if(w.pair.some(id=>!ids.has(id)))throw Error('The saved comparison selection is invalid.');return w;
}
export function comparisonPayload(w:PlanningWorkspace,draft:TwinSettings){
 if(!w.snapshot)throw Error('Save a strategy first.');const snapshot=w.snapshot;
 const alternatives=[{id:'baseline',name:'Untreated baseline',settings:planSettings(snapshot,'baseline',draft)},...w.plans.map(p=>({id:p.id,name:p.name,settings:planSettings(snapshot,p,draft)})),{id:'draft',name:'Working draft',settings:planSettings(snapshot,'draft',draft)}];
 return {schema:'terratrace-strategy-comparison-v1',city:snapshot.urban.city,snapshot,savedPlans:w.plans,pair:w.pair,alternatives:alternatives.map(p=>({...p,snapshotDigest:snapshot.digest,results:twinModel(snapshot.climate,snapshot.urban,p.settings)})),limitations:['Shared source snapshot and reference assumptions for every alternative.','Hypothetical interventions; cooling is a transferred sensitivity, not a calibrated forecast.','No existing PV, storage, costs or observed savings are modeled.']};
}
export async function comparisonReceipt(w:PlanningWorkspace,draft:TwinSettings){const payload=comparisonPayload(w,draft);const identity={kind:'strategy-comparison',version:1,sourceDigest:payload.snapshot.digest,comparisonDigest:await digest(payload)};return makeReceipt({...payload,observationIdentity:identity},identity);}
