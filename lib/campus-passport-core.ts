import type {CampusScenario,RainArchive,RainEnsemble,RouteComparison,StudyArea,WaterRun} from './campus-types';
import {canonical,digest,makeReceipt,verifyReceipt,type Receipt} from './proof';
import {runAnnual,runForecast,CAMPUS_WATER_MODEL_VERSION} from './campus-water';
import {compareRoutes,SHADE_MODEL_VERSION} from './campus-shade';
import {compareFlexibleUse,type FlexibleTask} from './campus-operations';
import {parseDailyDemandCsv} from './campus-demand';
import {planPortfolios,PLANNER_VERSION,type PlannerResult,type PlanTargets} from './campus-planner';

export type PassportState='Draft'|'Needs survey'|'Survey recorded'|'Ready for review'|'Measured evidence attached';
export const PASSPORT_STATES:PassportState[]=['Draft','Needs survey','Survey recorded','Ready for review','Measured evidence attached'];
export type PassportAttachment={id:string;name:string;mediaType:'image/png'|'image/jpeg'|'image/webp';size:number;digest:string;base64:string;note:string};
export type PassportOptions={planId?:string;revision?:number;title?:string;state?:PassportState;previousDigest?:string|null;survey?:Record<string,boolean>;reviewNotes?:string;attachments?:PassportAttachment[];measuredEvidence?:{name:string;digest:string;unit:string;notes:string;csv:string}[];additional?:Record<string,unknown>};
export type PassportSignature={schema:'terratrace-passport-signature-v1';address:string;signature:string;domain:{name:string;version:string;chainId:number};signedAt:string};
export type CampusPassportReceipt=Receipt & {walletSignature?:PassportSignature};
export type CampusPlanningEvidence={schema:'terratrace-campus-planning-evidence-v1';scenario:CampusScenario;targets:PlanTargets;result:PlannerResult;selectedCandidateId:string;costEvidence:{source:string;kind:'assumed'|'quoted'}};
export type CampusPassportPayload={
 schema:'terratrace-campus-action-v1';observationIdentity:Record<string,unknown>;
 plan:{id:string;revision:number;title:string;state:PassportState;previousDigest:string|null;survey:Record<string,boolean>;reviewNotes:string;measuredEvidence:NonNullable<PassportOptions['measuredEvidence']>};
 inputs:{study:StudyArea;archive:RainArchive;ensemble:RainEnsemble|null;scenario:CampusScenario};
 outputs:{waterRuns:WaterRun[];route:RouteComparison;forecast:ReturnType<typeof runForecast>|null};
 models:{water:string;shade:string};attachments:PassportAttachment[];extras:Record<string,unknown>;limits:string[];
};
const hashPattern=/^0x[0-9a-f]{64}$/;
const portable=<T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const portableDigest=(value:unknown)=>digest(portable(value));
export async function bytesDigest(bytes:Uint8Array):Promise<string>{const buffer=bytes.slice().buffer as ArrayBuffer;const hash=await crypto.subtle.digest('SHA-256',buffer);return '0x'+Array.from(new Uint8Array(hash),value=>value.toString(16).padStart(2,'0')).join('');}
function base64Bytes(encoded:string):Uint8Array{if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)||encoded.length%4!==0)throw Error('Invalid attachment encoding.');return Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));}
function imageType(bytes:Uint8Array):PassportAttachment['mediaType']|null{
 if(bytes.length>=8&&bytes[0]===137&&String.fromCharCode(...bytes.slice(1,4))==='PNG'&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';return null;
}
export async function makePassportAttachment(file:File,note=''):Promise<PassportAttachment>{
 if(file.size<1||file.size>2_000_000)throw Error('Use PNG, JPEG, or WebP photos up to 2 MB each.');
 const bytes=new Uint8Array(await file.arrayBuffer()),mediaType=imageType(bytes);if(!mediaType||file.type!==mediaType)throw Error('This photo has an unsupported or mismatched image format.');
 let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.slice(offset,offset+8192));
 return {id:crypto.randomUUID(),name:file.name.replace(/[\\/\u0000-\u001f]/g,'_').slice(0,120),mediaType,size:bytes.length,digest:await bytesDigest(bytes),base64:btoa(binary),note:note.slice(0,1000)};
}
async function checkedAttachments(attachments:PassportAttachment[]):Promise<boolean>{
 if(attachments.length>4||attachments.reduce((sum,a)=>sum+a.size,0)>8_000_000)return false;
 for(const attachment of attachments){
  if(!hashPattern.test(attachment.digest)||typeof attachment.base64!=='string'||attachment.base64.length>2_666_672||attachment.size<1||attachment.size>2_000_000)return false;
  const bytes=base64Bytes(attachment.base64);if(bytes.length!==attachment.size||imageType(bytes)!==attachment.mediaType||await bytesDigest(bytes)!==attachment.digest)return false;
 }return true;
}
async function checkedMeasurements(readings:NonNullable<PassportOptions['measuredEvidence']>):Promise<boolean>{
 if(readings.length>3)return false;
 for(const item of readings){if(item.unit!=='m3/day'||typeof item.csv!=='string'||item.csv.length>1_000_000||!hashPattern.test(item.digest))return false;const bytes=new TextEncoder().encode(item.csv);if(await bytesDigest(bytes)!==item.digest||parseDailyDemandCsv(item.csv,item.name).validDays===0)return false;}return true;
}
function validInputs(inputs:CampusPassportPayload['inputs']){
 if(inputs.study?.schema!=='terratrace-campus-study-v1'||inputs.archive?.schema!=='terratrace-rain-archive-v1'||!Array.isArray(inputs.study.buildings)||inputs.study.buildings.length>10000||!Array.isArray(inputs.study.graph?.nodes)||inputs.study.graph.nodes.length>100000||!Array.isArray(inputs.study.graph.edges)||inputs.study.graph.edges.length>150000||!Array.isArray(inputs.archive.readings)||inputs.archive.readings.length>15000||!Array.isArray(inputs.archive.acceptedYears)||inputs.archive.acceptedYears.length>20||!inputs.scenario?.water||!Array.isArray(inputs.scenario.water.roofs)||inputs.scenario.water.roofs.length>3||!Array.isArray(inputs.scenario.shadeSiteIds)||inputs.scenario.shadeSiteIds.length>20)throw Error('Unsupported or oversized campus inputs.');
 if(inputs.ensemble!==null&&(inputs.ensemble?.schema!=='terratrace-rain-ensemble-v1'||inputs.ensemble.timesUTC.length>168||inputs.ensemble.members.length>64))throw Error('Unsupported forecast evidence.');
}
async function passportIdentity(inputs:CampusPassportPayload['inputs'],plan:CampusPassportPayload['plan'],attachments:PassportAttachment[]){return {schema:'terratrace-campus-action-observation-v1',studyId:inputs.study.id,planId:plan.id,revision:plan.revision,previousDigest:plan.previousDigest,studyDigest:await digest(inputs.study),archiveDigest:await digest(inputs.archive),ensembleDigest:inputs.ensemble?await digest(inputs.ensemble):null,scenarioDigest:await digest(inputs.scenario),attachmentManifest:attachments.map(a=>({id:a.id,digest:a.digest,size:a.size,mediaType:a.mediaType}))};}
async function replayPlanner(study:StudyArea,archive:RainArchive,scenario:CampusScenario,targets:PlanTargets):Promise<PlannerResult>{return planPortfolios(study,archive,scenario,targets)}
async function checkedPlanning(inputs:CampusPassportPayload['inputs'],value:unknown):Promise<boolean>{
 if(value===undefined)return false;
 if(!value||typeof value!=='object')throw Error('Unsupported portfolio planning evidence.');
 const evidence=value as CampusPlanningEvidence;
 if(evidence.schema!=='terratrace-campus-planning-evidence-v1'||evidence.result?.version!==PLANNER_VERSION||!evidence.targets||!Array.isArray(evidence.result.candidates)||evidence.result.candidates.length>12000||typeof evidence.selectedCandidateId!=='string'||!evidence.costEvidence||!['assumed','quoted'].includes(evidence.costEvidence.kind)||typeof evidence.costEvidence.source!=='string'||evidence.costEvidence.source.length>4000)throw Error('Unsupported portfolio planning evidence or cost declaration.');
 if(evidence.costEvidence.kind==='quoted'&&!evidence.costEvidence.source.trim())throw Error('Name the quoted cost source before sealing that declaration.');
 validInputs({...inputs,scenario:evidence.scenario});
 const selected=evidence.result.candidates.find(candidate=>candidate.id===evidence.selectedCandidateId);
 if(!selected||!Array.isArray(selected.capacities)||selected.capacities.length!==evidence.scenario.water.roofs.length||!Array.isArray(selected.shadeSiteIds))throw Error('The selected project is missing from its declared frontier.');
 const selectedScenario:CampusScenario={...evidence.scenario,water:{...evidence.scenario.water,startingFillFraction:0,roofs:evidence.scenario.water.roofs.map((roof,index)=>({...roof,capacityM3:selected.capacities[index]}))},shadeSiteIds:selected.shadeSiteIds};
 if(await portableDigest(selectedScenario)!==await portableDigest(inputs.scenario))throw Error('The selected portfolio no longer matches this proposal. Recompare projects after changing its settings.');
 const reproduced=await replayPlanner(inputs.study,inputs.archive,evidence.scenario,evidence.targets);
 if(await portableDigest(reproduced)!==await portableDigest(evidence.result))throw Error('Portfolio alternatives, targets, or recommendation do not reproduce from the frozen inputs.');
 return true;
}
type PassportSealArguments=[StudyArea,RainArchive,RainEnsemble|null,CampusScenario,WaterRun[],RouteComparison|null,Record<string,unknown>,PassportOptions];
export type PassportWorkerRequest={action:'seal';args:PassportSealArguments}|{action:'verify';value:unknown};
export async function makeCampusPassportCore(study:StudyArea,archive:RainArchive,ensemble:RainEnsemble|null,scenario:CampusScenario,waterRuns:WaterRun[],route:RouteComparison|null,extras:Record<string,unknown>={},options:PassportOptions={}):Promise<CampusPassportReceipt>{
 const inputs=portable({study,archive,ensemble,scenario});validInputs(inputs);
 // Capture every caller-owned value before the first await. UI changes or mutable
 // import objects must not alter a revision halfway through its source hashing.
 study=inputs.study;archive=inputs.archive;ensemble=inputs.ensemble;scenario=inputs.scenario;
 waterRuns=portable(waterRuns);route=portable(route);extras=portable(extras);options=portable(options);
 if(!route||!waterRuns.length)throw Error('Wait for the current proposal calculations before sealing.');
 if(waterRuns.length!==archive.acceptedYears.length||waterRuns.some(run=>!run.available))throw Error('Each accepted rain year needs a complete current replay.');
 const attachments=options.attachments??[];if(!await checkedAttachments(attachments))throw Error('An attachment is invalid or exceeds the passport limit.');
 const state=options.state??'Needs survey';if(!PASSPORT_STATES.includes(state))throw Error('Unsupported evidence state.');
 if(!await checkedMeasurements(options.measuredEvidence??[]))throw Error('Measured readings are invalid or differ from their fingerprint.');
 if(state==='Measured evidence attached'&&!options.measuredEvidence?.length)throw Error('Attach a measured-readings digest before using the measured-evidence state.');
 const revision=options.revision??1;if(!Number.isInteger(revision)||revision<1||revision>100000)throw Error('Choose a positive passport revision.');
 const previousDigest=options.previousDigest??null;if(previousDigest!==null&&!hashPattern.test(previousDigest))throw Error('Previous revision digest is invalid.');
 const plan={id:options.planId??crypto.randomUUID(),revision,title:(options.title??'Southwark campus action proposal').slice(0,120),state,previousDigest,survey:options.survey??{},reviewNotes:(options.reviewNotes??'').slice(0,5000),measuredEvidence:options.measuredEvidence??[]};
 const payload:CampusPassportPayload={schema:'terratrace-campus-action-v1',observationIdentity:await passportIdentity(inputs,plan,attachments),plan,inputs,outputs:{waterRuns,route,forecast:ensemble?runForecast(study,ensemble,scenario.water):null},models:{water:CAMPUS_WATER_MODEL_VERSION,shade:SHADE_MODEL_VERSION},attachments,extras:{...extras,...(options.additional??{})},limits:['This passport records a proposed public-data study, not an approved installation or university partnership.','Daily gauge rainfall and mapped roof areas produce modeled storage estimates, not measured campus savings or drainage flood predictions.','Route shade is geometric, not a prediction of air temperature, health outcomes, or accessibility.','Survey checks and review notes are human declarations. A signature proves who signed the digest; a hash or blockchain anchor does not certify environmental truth.','Measured reading attachments do not establish achieved savings or causal intervention effects.']};
 // Do not seal stale UI output. Independently rerun models against the supplied frozen inputs.
 const expected=archive.acceptedYears.map(year=>runAnnual(study,archive,scenario.water,year));
 if(await portableDigest(expected)!==await portableDigest(waterRuns)||await portableDigest(compareRoutes(study,scenario,true))!==await portableDigest(route))throw Error('The results changed. Wait for the current proposal to finish recalculating.');
 await checkedPlanning(inputs,payload.extras.planningComparison);
 return makeReceipt(portable(payload) as unknown as Record<string,unknown>,payload.observationIdentity);
}
export type PassportVerification={valid:boolean;integrityValid:boolean;calculationsValid:boolean|null;attachmentsValid:boolean|null;signatureValid:boolean|null;legacy:boolean;receipt:CampusPassportReceipt;checks:string[];errors:string[]};
export async function verifyCampusPassportCore(value:unknown):Promise<PassportVerification>{
 const generic=await verifyReceipt(value),receipt=generic.receipt as CampusPassportReceipt;
 const result:PassportVerification={valid:generic.valid,integrityValid:generic.valid,calculationsValid:null,attachmentsValid:null,signatureValid:null,legacy:receipt.payload.schema!=='terratrace-campus-action-v1',receipt,checks:[],errors:[]};
 if(!generic.valid){result.errors.push('The payload or observation identity differs from its SHA-256 digest.');return result;}
 result.checks.push('Payload and observation identity digests match.');
 if(result.legacy){result.checks.push('Supported legacy receipt: integrity checked; campus calculations do not apply.');return result;}
 try{
  const payload=receipt.payload as unknown as CampusPassportPayload;validInputs(payload.inputs);
  if(!payload.plan||!Array.isArray(payload.attachments)||!PASSPORT_STATES.includes(payload.plan.state)||!Number.isInteger(payload.plan.revision)||payload.plan.revision<1)throw Error('Passport plan metadata is invalid.');
  if(payload.plan.state==='Measured evidence attached'&&!payload.plan.measuredEvidence?.length)throw Error('Measured-evidence state lacks a reading manifest.');
  if(canonical(await passportIdentity(payload.inputs,payload.plan,payload.attachments))!==canonical(payload.observationIdentity))throw Error('Source, scenario, or attachment manifest differs from the observation identity.');
  result.attachmentsValid=await checkedAttachments(payload.attachments);if(!result.attachmentsValid)throw Error('An attachment fingerprint or image format does not match.');
  if(!await checkedMeasurements(payload.plan.measuredEvidence))throw Error('Measured readings do not match their source manifest.');
  result.checks.push('Frozen source snapshots, assumptions, and attachment manifest match.');
  const {study,archive,ensemble,scenario}=payload.inputs;
  const computed={waterRuns:archive.acceptedYears.map(year=>runAnnual(study,archive,scenario.water,year)),route:compareRoutes(study,scenario,true),forecast:ensemble?runForecast(study,ensemble,scenario.water):null};
  result.calculationsValid=payload.models.water===CAMPUS_WATER_MODEL_VERSION&&payload.models.shade===SHADE_MODEL_VERSION&&await portableDigest(computed)===await portableDigest(payload.outputs);
  if(!result.calculationsValid)throw Error('Calculated results or model versions do not reproduce from the frozen inputs.');
  result.checks.push('Annual water, forecast-member storage, and journey shade reproduce.');
  const operation=payload.extras?.operatingComparison as {task?:FlexibleTask;schema?:string;studyId?:string;settings?:unknown;forecastSource?:unknown;comparison?:{task:FlexibleTask}}|undefined;
  if(operation?.schema==='terratrace-flexible-use-v1'&&operation.task&&ensemble){
   if(await portableDigest(compareFlexibleUse(study,ensemble,scenario.water,operation.task))!==await portableDigest(operation))throw Error('Flexible-use comparison does not reproduce.');
   result.checks.push('The flexible-use timing comparison reproduces.');
  }else if(operation?.schema==='terratrace-operation-evidence-v1'&&operation.comparison?.task&&ensemble){
   if(operation.studyId!==study.id||await portableDigest(operation.settings)!==await portableDigest(scenario.water)||await portableDigest(operation.forecastSource)!==await portableDigest(ensemble.source)||await portableDigest(compareFlexibleUse(study,ensemble,scenario.water,operation.comparison.task))!==await portableDigest(operation.comparison))throw Error('Flexible-use evidence or its frozen settings do not reproduce.');
   result.checks.push('The flexible-use timing comparison and source settings reproduce.');
  }else if(operation)result.checks.push('Additional operating notes are integrity protected, without a supported calculation replay.');
  if(await checkedPlanning(payload.inputs,payload.extras?.planningComparison))result.checks.push('Portfolio frontier, targets, and selected proposal reproduce. Cost sources remain human declarations.');
  if(receipt.walletSignature){result.signatureValid=await verifyPassportSignature(receipt);if(!result.signatureValid)throw Error('The wallet signature does not match this passport digest.');result.checks.push('Wallet signature matches its declared signer and this digest.');}
 }catch(error){result.valid=false;result.errors.push(error instanceof Error?error.message:'The passport could not be reproduced.');}
 result.valid=result.valid&&result.calculationsValid===true&&result.attachmentsValid===true;return result;
}
const SIGN_TYPES={ActionPassport:[{name:'observationId',type:'bytes32'},{name:'digest',type:'bytes32'}]};
export async function signCampusPassportCore(receipt:CampusPassportReceipt,ethereum:unknown,verify:(value:unknown)=>Promise<PassportVerification>=verifyCampusPassportCore):Promise<CampusPassportReceipt>{
 receipt=portable(receipt);
 if(receipt.payload.schema!=='terratrace-campus-action-v1')throw Error('Choose a supported campus passport to sign.');
 // A previous signature may be replaced, but the underlying data and calculations
 // must pass before a wallet is asked to sign their declared digest.
 const unsigned={...receipt};delete unsigned.walletSignature;
 const verification=await verify(unsigned);if(!verification.valid)throw Error('Verify the passport data and calculations before signing: '+verification.errors.join(' '));
 const {BrowserProvider}=await import('ethers');if(!ethereum)throw Error('Connect an Ethereum browser wallet to sign this passport.');
 const provider=new BrowserProvider(ethereum as ConstructorParameters<typeof BrowserProvider>[0]);if((await provider.getNetwork()).chainId!==BigInt(11155111))throw Error('Choose Ethereum Sepolia in your wallet.');
 await provider.send('eth_requestAccounts',[]);const signer=await provider.getSigner(),domain={name:'TerraTrace Campus Action Passport',version:'1',chainId:11155111};
 const signature=await signer.signTypedData(domain,SIGN_TYPES,{observationId:receipt.observationId,digest:receipt.digest});
 const signed:CampusPassportReceipt={...receipt,walletSignature:{schema:'terratrace-passport-signature-v1',address:await signer.getAddress(),signature,domain,signedAt:new Date().toISOString()}};
 if(!await verifyPassportSignature(signed))throw Error('The wallet response did not match this passport and signer.');
 return signed;
}
export async function verifyPassportSignature(receipt:CampusPassportReceipt):Promise<boolean>{
 const signed=receipt.walletSignature;if(!signed)return false;
 if(signed.schema!=='terratrace-passport-signature-v1'||signed.domain?.name!=='TerraTrace Campus Action Passport'||signed.domain.version!=='1'||signed.domain.chainId!==11155111)return false;
 try{const {verifyTypedData}=await import('ethers');return verifyTypedData(signed.domain,SIGN_TYPES,{observationId:receipt.observationId,digest:receipt.digest},signed.signature).toLowerCase()===signed.address.toLowerCase()}catch{return false}
}
const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function campusPassportBrief(receipt:CampusPassportReceipt):string{
 const p=receipt.payload as unknown as CampusPassportPayload;if(p.schema!=='terratrace-campus-action-v1')throw Error('Choose a campus passport.');
 const roofs=p.inputs.scenario.water.roofs.map(r=>`<li>${escape(p.inputs.study.buildings.find(b=>b.id===r.buildingId)?.name??r.buildingId)}: ${escape(r.capacityM3)} m³ proposed storage; ${escape(r.connectedFraction*100)}% connected.</li>`).join('');
 const water=p.outputs.waterRuns.map(r=>`<tr><td>${escape(r.year)}</td><td>${r.coveragePercent.toFixed(1)}%</td><td>${r.reuseM3.toFixed(1)} m³</td><td>${r.overflowM3.toFixed(1)} m³</td></tr>`).join('');
 const planning=p.extras.planningComparison as CampusPlanningEvidence|undefined,chosen=planning?.result.candidates.find(candidate=>candidate.id===planning.selectedCandidateId);
 const shortlist=planning?[...(chosen?[chosen]:[]),...planning.result.candidates.filter(candidate=>candidate.id!==chosen?.id)].slice(0,6):[];
 const planningBrief=planning?`<h2>Compared projects and selected choice</h2><p>${planning.result.evaluated} bounded combinations evaluated; ${planning.result.candidates.length} nondominated alternatives retained. Targets: ${planning.targets.waterCoverage}% worst-year water coverage and ${planning.targets.sunReduction}% less modeled direct sun. ${chosen?.meetsTargets?'The selected option meets these model targets.':'The selected option does not meet all stated targets.'}</p><p>${planning.result.recommended?.id===chosen?.id?'The algorithm recommends this option for fewest actions, then least storage among qualifying frontier options.':'This is a user-selected frontier option.'} ${escape(planning.result.reason??'')}</p><table><thead><tr><th>Choice</th><th>Storage</th><th>Water coverage</th><th>Sun reduction</th><th>Actions</th><th>Cost declaration</th></tr></thead><tbody>${shortlist.map(candidate=>`<tr><td>${candidate.id===chosen?.id?'Selected':'Alternative'}</td><td>${candidate.totalCapacityM3.toFixed(1)} m³</td><td>${candidate.worstCoverage.toFixed(1)}%</td><td>${candidate.sunReductionPercent===null?'Unavailable':candidate.sunReductionPercent.toFixed(1)+'%'}</td><td>${candidate.interventions}</td><td>${candidate.costGBP===null?'Unknown':'£'+candidate.costGBP.toFixed(0)}</td></tr>`).join('')}</tbody></table><p><small>${shortlist.length} alternatives shown; all alternatives and original planning inputs are preserved in passport.json. Cost evidence: ${escape(planning.costEvidence.kind)} — ${escape(planning.costEvidence.source||'No source supplied')}. Cost sources are human declarations, not independently authenticated quotes.</small></p>`:'';
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(p.plan.title)}</title><style>body{font:15px/1.55 system-ui,sans-serif;margin:40px auto;padding:0 24px;max-width:900px;color:#18313c}h1{font-size:32px;line-height:1.15}h2{font-size:20px;margin-top:28px}table{border-collapse:collapse;width:100%}th,td{padding:8px;border-bottom:1px solid #ccd8dc;text-align:left}code{overflow-wrap:anywhere;font-size:12px}small{color:#4e6570}@media print{body{margin:20px}} </style></head><body><small>TERRATRACE / ACTION PASSPORT / REVISION ${p.plan.revision}</small><h1>${escape(p.plan.title)}</h1><p>${escape(p.inputs.study.name)} · ${escape(p.plan.state)} · ${escape(receipt.createdAt)}</p><p>Public-data proposal. Survey and engineering review remain necessary.</p><h2>Proposed water system</h2><ul>${roofs}</ul><p>Assumed eligible demand: ${p.inputs.scenario.water.dailyDemandM3} m³/day. Rain source: ${escape(p.inputs.archive.station.name)}, ${p.inputs.archive.station.distanceKm.toFixed(1)} km from the study.</p><table><thead><tr><th>Observed year</th><th>Demand coverage</th><th>Modeled reuse</th><th>Roof overflow</th></tr></thead><tbody>${water}</tbody></table><h2>Journey shade</h2><p>${p.outputs.route.shadiest?`${p.outputs.route.shadiest.sunMinutes.toFixed(1)} modeled minutes in direct sun on a ${p.outputs.route.shadiest.durationMin.toFixed(1)} minute journey. Best among ${p.outputs.route.consideredCount} evaluated routes.`:escape(p.outputs.route.reason??'No available route.')}</p>${planningBrief}<h2>Survey and review</h2><ul>${Object.entries(p.plan.survey).map(([name,checked])=>`<li>${escape(name)}: ${checked?'recorded by user':'pending'}</li>`).join('')}</ul><p>${escape(p.plan.reviewNotes||'No review notes recorded.')}</p><h2>Sources</h2><ul>${[...p.inputs.study.sources,p.inputs.archive.source,...(p.inputs.ensemble?[p.inputs.ensemble.source]:[])].map(s=>`<li>${escape(s.title)} · ${escape(s.license)} · ${escape(s.retrievedAt)}<br><small>${escape(s.url)}</small></li>`).join('')}</ul><h2>Interpretation</h2><ul>${p.limits.map(limit=>`<li>${escape(limit)}</li>`).join('')}</ul><h2>Portable proof</h2><p><code>${escape(receipt.digest)}</code></p><p>Model versions: ${escape(p.models.water)} / ${escape(p.models.shade)}. Photos: ${p.attachments.length}. Signature: ${receipt.walletSignature?escape(receipt.walletSignature.address):'not signed'}. Chain metadata requires separate confirmation.</p></body></html>`;
}
// Standards-compliant stored ZIP. No additional runtime library is required.
export function storedZip(files:{name:string;data:Uint8Array}[]):Uint8Array{
 const chunks:Uint8Array[]=[],directory:Uint8Array[]=[],encoder=new TextEncoder();let offset=0;
 const crc=(bytes:Uint8Array)=>{let value=0xffffffff;for(const byte of bytes){value^=byte;for(let i=0;i<8;i++)value=value&1?(value>>>1)^0xedb88320:value>>>1}return (value^0xffffffff)>>>0};
 for(const file of files){if(!/^[a-zA-Z0-9_./-]+$/.test(file.name)||file.name.includes('..')||file.name.startsWith('/'))throw Error('Unsafe export filename.');const name=encoder.encode(file.name),checksum=crc(file.data),header=new Uint8Array(30+name.length),h=new DataView(header.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,33,true);h.setUint32(14,checksum,true);h.setUint32(18,file.data.length,true);h.setUint32(22,file.data.length,true);h.setUint16(26,name.length,true);header.set(name,30);
  const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,checksum,true);c.setUint32(20,file.data.length,true);c.setUint32(24,file.data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);chunks.push(header,file.data);directory.push(central);offset+=header.length+file.data.length;
 }
 const directorySize=directory.reduce((sum,part)=>sum+part.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,directorySize,true);e.setUint32(16,offset,true);const output=new Uint8Array(offset+directorySize+end.length);let pos=0;for(const part of [...chunks,...directory,end]){output.set(part,pos);pos+=part.length}return output;
}
export function campusPassportZip(receipt:CampusPassportReceipt):Uint8Array{
 const p=receipt.payload as unknown as CampusPassportPayload,encoder=new TextEncoder();
 if(p.schema!=='terratrace-campus-action-v1')throw Error('Choose a campus passport.');
 const files:{name:string;data:Uint8Array}[]=[{name:'passport.json',data:encoder.encode(JSON.stringify(receipt,null,2))},{name:'project-brief.html',data:encoder.encode(campusPassportBrief(receipt))},{name:'README.md',data:encoder.encode('# TerraTrace Action Passport\n\nImport passport.json in TerraTrace to verify hashes, attachments, model replay, and an optional signature.\n\nThe brief is printable. Source licensing and original timestamps remain embedded in the JSON. This is a proposed public-data study. An integrity match does not certify an environmental claim.\n')}];
 p.attachments.forEach((a,index)=>files.push({name:`attachments/photo-${index+1}.${a.mediaType==='image/png'?'png':a.mediaType==='image/webp'?'webp':'jpg'}`,data:base64Bytes(a.base64)}));p.plan.measuredEvidence.forEach((item,index)=>files.push({name:`measurements/daily-readings-${index+1}.csv`,data:encoder.encode(item.csv)}));return storedZip(files);
}
