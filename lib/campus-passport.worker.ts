import {makeCampusPassportCore,verifyCampusPassportCore,type PassportWorkerRequest} from './campus-passport-core';

const scope=self as unknown as {onmessage:((event:MessageEvent<PassportWorkerRequest>)=>void)|null;postMessage:(message:unknown)=>void};
/** The worker has no window. Exported APIs therefore use their direct implementation,
 * including canonical JSON hashes and complete model replay, without spawning workers.
 */
scope.onmessage=async(event:MessageEvent<PassportWorkerRequest>)=>{
 try{
  const request=event.data;
  if(request.action==='seal'){
   const result=await makeCampusPassportCore(...request.args);
   scope.postMessage({ok:true,result});
  }else if(request.action==='verify'){
   const result=await verifyCampusPassportCore(request.value);
   scope.postMessage({ok:true,result});
  }else throw Error('Unsupported evidence worker action.');
 }catch(error){scope.postMessage({ok:false,error:error instanceof Error?error.message:'Evidence calculation could not finish.'})}
};
