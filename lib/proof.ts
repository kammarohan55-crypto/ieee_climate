export type Receipt={payload:Record<string,unknown>;digest:string;observationId:string;algorithm:"SHA-256";canonicalization:"TerraTrace sorted-key JSON v1";createdAt:string;txHash?:string;contract?:string};
// Versioned deterministic JSON for JSON-compatible payloads; not a claim of full RFC 8785 compliance.
export function canonical(value: unknown): string {
  if(value===null || typeof value!=="object") { const encoded=JSON.stringify(value); if(encoded===undefined)throw new Error("Unsupported JSON value");return encoded; }
  if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical((value as Record<string,unknown>)[k])}`).join(",")}}`;
}
export async function digest(value: unknown) { const bytes=new TextEncoder().encode(canonical(value)); const hash=await crypto.subtle.digest("SHA-256",bytes);return "0x"+Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,"0")).join(""); }
export async function makeReceipt(payload: Record<string,unknown>, identity: Record<string,unknown>):Promise<Receipt> {return {payload,digest:await digest(payload),observationId:await digest(identity),algorithm:"SHA-256",canonicalization:"TerraTrace sorted-key JSON v1",createdAt:new Date().toISOString()};}
export async function verifyReceipt(value:unknown) {
  if(!value||typeof value!=="object")throw Error("Choose a TerraTrace JSON receipt.");
  const r=value as Receipt;if(r.algorithm!=="SHA-256"||r.canonicalization!=="TerraTrace sorted-key JSON v1"||!r.payload||!/^0x[0-9a-f]{64}$/.test(r.digest))throw Error("This file is not a supported receipt.");
  const identity=r.payload.observationIdentity;
  if(!identity||!/^0x[0-9a-f]{64}$/.test(r.observationId))throw Error("Receipt observation identity is missing.");
  return {valid:await digest(r.payload)===r.digest&&await digest(identity)===r.observationId,receipt:r};
}
export function download(value:unknown,name:string) { const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
