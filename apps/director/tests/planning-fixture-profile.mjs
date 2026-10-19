// Synthetic reviewed planning evidence for offline tests only; never a production profile.
export const fixturePlanningOperations=['interpret_brief','initial_plan','revise_plan','write_script','revise_script'];
export const fixturePlanningTasks={interpret_brief:'brief_interpretation',initial_plan:'film_planning',revise_plan:'film_plan_revision',write_script:'screenplay_writing',revise_script:'screenplay_revision',plan_departments:'department_planning',revise_departments:'department_revision',plan_storyboard:'storyboard_planning'};
export function reviewedPlanningFixture(model,{operations=fixturePlanningOperations,evaluatedAt='2026-10-01T00:00:00.000Z',expiresAt='2099-01-01T00:00:00.000Z'}={}){
 const next=structuredClone(model),caps=next.capabilities??={},planning=caps.planning??={},tasks=operations.map(operation=>fixturePlanningTasks[operation]);
 const evidence={modelId:next.id,provider:next.provider,endpoint:next.endpoint,modelVersion:next.model_version,version:'synthetic-review-v1',sourceUrl:'https://example.test/reviewed-synthetic-evidence',evaluatedAt,expiresAt,sampleCount:1,tasks:[...tasks],operations:[...operations]};
 planning.operations=[...operations];planning.operationBindings=operations.map(operation=>({operation,reviewed:true,modelId:next.id,provider:next.provider,endpoint:next.endpoint,modelVersion:next.model_version,version:'synthetic-binding-v1',sourceUrl:'https://example.test/reviewed-synthetic-binding',evaluatedAt,expiresAt}));planning.formats=['short_film','music_video','advertisement'];
 caps.tasks=tasks;caps.languages=['English','Hindi','Hinglish'];caps.planning=planning;caps.reviewEvidence={execution:structuredClone(evidence),quality:structuredClone(evidence)};
 next.capabilities=caps;next.routing_profiles??=[];return next;
}
