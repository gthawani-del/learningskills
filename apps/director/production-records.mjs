import {hash} from './domain.mjs';
import {recordSnapshots} from './public/production-records-core.js';
export {applyProductionRecord,recordDependencies,normalizeProductionArchive} from './public/production-records-core.js';
export function recordArtifacts(project){return recordSnapshots(project).map(a=>({...a,content_hash:hash(a.content)}));}
