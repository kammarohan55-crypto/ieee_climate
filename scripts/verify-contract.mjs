import fs from 'node:fs';
import assert from 'node:assert/strict';
import solc from 'solc';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory,id,ZeroHash} from 'ethers';
const source=fs.readFileSync('contracts/ClimateEvidenceRegistry.sol','utf8').replace(/^\uFEFF/,'');
const input={language:'Solidity',sources:{'ClimateEvidenceRegistry.sol':{content:source}},settings:{evmVersion:'shanghai',optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input)));const errors=(output.errors??[]).filter(e=>e.severity==='error');if(errors.length)throw Error(errors.map(e=>e.formattedMessage).join('\n'));
const artifact=output.contracts['ClimateEvidenceRegistry.sol'].ClimateEvidenceRegistry;fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/ClimateEvidenceRegistry.json',JSON.stringify({compiler:solc.version(),abi:artifact.abi,bytecode:'0x'+artifact.evm.bytecode.object},null,2));
const chain=ganache.provider({logging:{quiet:true},chain:{chainId:1337,hardfork:'shanghai'}});const provider=new BrowserProvider(chain);const signer=await provider.getSigner(0),other=await provider.getSigner(1);const factory=new ContractFactory(artifact.abi,artifact.evm.bytecode.object,signer);const registry=await factory.deploy();await registry.waitForDeployment();
const obs=id('observation-1'),hash=id('evidence-1');const receipt=await(await registry.record(obs,hash,'urn:sha256:test')).wait();assert.equal(receipt.status,1);assert.equal(await registry.observationDigest(obs),hash);assert.equal(await registry.digestRecorded(hash),true);assert.equal(receipt.logs.length,1);
async function reverts(call,label){await assert.rejects(call,label)}
await reverts(()=>registry.record(obs,id('evidence-2'),'urn:test'),'same observation');await reverts(()=>registry.record(id('observation-2'),hash,'urn:test'),'same digest');await reverts(()=>registry.connect(other).record(id('other'),id('hash-other'),'urn:test'),'unauthorized wallet');await reverts(()=>registry.record(ZeroHash,id('hash-empty'),'urn:test'),'empty identifier');await reverts(()=>registry.record(id('obs-empty'),id('hash-empty'),''),'empty URI');assert.equal(await registry.observationDigest(id('observation-2')),ZeroHash);
await chain.disconnect();console.log('PASS: Solidity compiled; real local EVM deployment, event, state read-back, duplicate observation, duplicate digest, unauthorized publisher, empty identifier, URI guard, unchanged failed state.');
