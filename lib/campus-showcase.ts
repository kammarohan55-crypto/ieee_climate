export const CAMPUS_SHOWCASE_STEPS=[
 {id:'place',title:'Start with a real place',label:'Campus',seconds:7,description:'Inspect mapped buildings and tree locations. Height and crown assumptions remain visible.'},
 {id:'runoff',title:'See the existing runoff',label:'Existing water',seconds:8,description:'Replay observed rainfall with zero proposed storage. Follow runoff before adding a collection system.'},
 {id:'reuse',title:'Turn rainfall into useful water',label:'Water reuse',seconds:12,description:'Watch three proposed tanks fill, supply the shared demand, and overflow. Dry intervals produce no collection.'},
 {id:'forecast',title:'Explore weather uncertainty',label:'Forecast',seconds:9,description:'Run every complete forecast member through the same tanks. The band shows member spread, not guaranteed probabilities.'},
 {id:'timing',title:'Compare a flexible task',label:'Operations',seconds:10,description:'Compare moving the same planned water use within its permitted window. The model can recommend keeping the existing time.'},
 {id:'walk',title:'Walk the existing journey',label:'Existing shade',seconds:9,description:'Trace the walking route at the selected departure time. Amber marks direct sun; mint marks modeled shade.'},
 {id:'shelters',title:'Add shade where it helps',label:'Shade plan',seconds:18,description:'Add two conceptual shelters on exposed route segments. Compare modeled sun minutes while the traveler moves.'},
 {id:'planner',title:'Compare practical projects',label:'Action planner',seconds:10,description:'Evaluate the bounded water and shelter combinations for 50% water coverage and 5% less direct sun. Prices remain unknown.'},
 {id:'selected',title:'Inspect the selected portfolio',label:'Selected plan',seconds:8,description:'Apply the qualifying portfolio with the fewest actions, then least storage. Site suitability still requires a survey.'},
 {id:'ai',title:'Test AI against measured demand',label:'Demand AI',seconds:15,description:'Compare frozen forecasts with held-out readings for three reference buildings. A simpler baseline remains visible when it performs better.'},
 {id:'proof',title:'Seal and independently verify',label:'Action Passport',seconds:10,description:'Create a temporary passport, then reproduce its source fingerprints, water, shade and planning results. Export it for review.'},
] as const;
export type CampusShowcaseStep=typeof CAMPUS_SHOWCASE_STEPS[number]['id'];
export function showcaseReady(stage:CampusShowcaseStep,analysis:boolean,planner:boolean,operation:boolean,proof:boolean,error:boolean,ensemble:boolean){
 if(error)return true;
 if(!analysis)return false;
 if(stage==='planner')return planner;
 if(stage==='timing')return !ensemble||operation;
 if(stage==='proof')return proof;
 return true;
}
export function advanceShowcaseTime(elapsed:number,deltaSeconds:number,duration:number,ready:boolean,paused:boolean){return ready&&!paused?Math.min(duration,elapsed+Math.max(0,deltaSeconds)):elapsed}
