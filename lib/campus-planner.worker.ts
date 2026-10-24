import {planPortfolios,type PlanTargets} from './campus-planner';
import type {CampusScenario,RainArchive,StudyArea} from './campus-types';
const scope=self as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(message:unknown)=>void};
scope.onmessage=(event:MessageEvent<{study:StudyArea;archive:RainArchive;scenario:CampusScenario;targets:PlanTargets}>)=>{try{const {study,archive,scenario,targets}=event.data;scope.postMessage({type:'result',result:planPortfolios(study,archive,scenario,targets,value=>scope.postMessage({type:'progress',value}))})}catch(error){scope.postMessage({type:'error',message:error instanceof Error?error.message:'Portfolio comparison could not finish.'})}};
