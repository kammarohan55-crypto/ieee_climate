import type {CampusScenario,RainArchive,RainEnsemble,RouteComparison,StudyArea,WaterRun} from './campus-types';
import {makeCampusPassportCore,verifyCampusPassportCore,signCampusPassportCore,type CampusPassportReceipt,type PassportOptions,type PassportVerification,type PassportWorkerRequest} from './campus-passport-core';
export type * from './campus-passport-core';
export {PASSPORT_STATES,bytesDigest,makePassportAttachment,verifyPassportSignature,campusPassportBrief,storedZip,campusPassportZip} from './campus-passport-core';

/** Browser dispatcher is deliberately separate from the calculation core. The worker
 * imports only the core, avoiding a circular Vite worker bundle. */
async function passportWorker<T>(request:PassportWorkerRequest):Promise<T>{
 const {default:EvidenceWorker}=await import('./campus-passport.worker?worker');
 return new Promise((resolve,reject)=>{
  const worker=new EvidenceWorker({type:'module'}),timeout=setTimeout(()=>{worker.terminate();reject(Error('Evidence verification did not finish within 60 seconds. Try a smaller proposal or verify it with the project tools.'))},60_000);
  const close=()=>{clearTimeout(timeout);worker.terminate()};
  worker.onmessage=(event:MessageEvent<{ok:boolean;result:T;error?:string}>)=>{close();if(event.data.ok)resolve(event.data.result);else reject(Error(event.data.error??'The evidence worker could not finish.'))};
  worker.onerror=()=>{close();reject(Error('The evidence worker could not start or finish. Reload this workspace and try again.'))};
  try{worker.postMessage(request)}catch(error){close();reject(error)}
 });
}
export async function makeCampusPassport(study:StudyArea,archive:RainArchive,ensemble:RainEnsemble|null,scenario:CampusScenario,waterRuns:WaterRun[],route:RouteComparison|null,extras:Record<string,unknown>={},options:PassportOptions={}):Promise<CampusPassportReceipt>{
 if(typeof window!=='undefined'&&typeof Worker!=='undefined'){
  // Capture every caller-owned value synchronously before dynamic import or hashing.
  const args=structuredClone([study,archive,ensemble,scenario,waterRuns,route,extras,options]) as Extract<PassportWorkerRequest,{action:'seal'}>['args'];
  return passportWorker<CampusPassportReceipt>({action:'seal',args});
 }
 return makeCampusPassportCore(study,archive,ensemble,scenario,waterRuns,route,extras,options);
}
export async function verifyCampusPassport(value:unknown):Promise<PassportVerification>{
 if(typeof window!=='undefined'&&typeof Worker!=='undefined'){
  const snapshot=structuredClone(value);
  return passportWorker<PassportVerification>({action:'verify',value:snapshot});
 }
 return verifyCampusPassportCore(value);
}
export async function signCampusPassport(receipt:CampusPassportReceipt,ethereum:unknown):Promise<CampusPassportReceipt>{
 return signCampusPassportCore(receipt,ethereum,verifyCampusPassport);
}
