/** Local planning boundary. Does not authorize jobs, select providers or call models. */
const TECHNIQUES = new Set(['thirds','center','negative-space','symmetry','layered-depth','hold','cut','static','tracking','push-in','rack-focus']);
const nonempty = v => typeof v === 'string' && v.trim().length > 0;
function require(condition, message) { if (!condition) throw new TypeError(message); }

export function compileProductionContract(input) {
  require(input && typeof input === 'object' && !Array.isArray(input), 'A structured brief is required.');
  require(nonempty(input.intent) && input.intent.length <= 5000, 'An intent of 1–5000 characters is required.');
  require(['photographic','stylized','mixed'].includes(input.style), 'Choose photographic, stylized or mixed style.');
  require(['narrative','avatar','music-video','commercial'].includes(input.product), 'An explicit product type is required.');
  require(Number.isFinite(input.durationSeconds) && input.durationSeconds > 0, 'A positive target duration is required.');
  require(Number.isSafeInteger(input.outputCount) && input.outputCount > 0, 'A positive final output count is required.');
  require(Array.isArray(input.shots) && input.shots.length > 0 && input.shots.length <= 200, 'Supply 1–200 planned shots for this contract version.');
  const ids = new Set();
  const shots = input.shots.map(s => {
    require(s && nonempty(s.id) && !ids.has(s.id), 'Each shot needs a unique stable ID.');
    ids.add(s.id);
    require(nonempty(s.action) && nonempty(s.purpose), 'Each shot needs an action and editorial purpose.');
    require(Number.isFinite(s.seconds) && s.seconds > 0, 'Each shot needs a positive duration.');
    require(['close','medium','wide'].includes(s.framing), 'Each shot needs close, medium or wide framing.');
    require(s.requiresHandAction === undefined || typeof s.requiresHandAction === 'boolean', 'Hand-action requirement must be boolean.');
    require(s.hideHands === undefined || typeof s.hideHands === 'boolean', 'Hand visibility must be boolean.');
    require(!(s.requiresHandAction && s.hideHands), 'A required hand action cannot be hidden.');
    const techniques = s.techniques ?? [];
    require(Array.isArray(techniques) && techniques.every(t => TECHNIQUES.has(t)), 'Unknown technique; review it before adding it to this compiler version.');
    require(s.gaze === undefined || nonempty(s.gaze), 'Gaze must be an explicit direction when supplied.');
    const modules = ['intent','continuity','editorial-purpose'];
    if (input.style === 'photographic' || input.style === 'mixed') modules.push('photographic-coherence');
    if (s.framing === 'close' && input.style === 'photographic') modules.push('scale-appropriate-human-detail');
    if (s.requiresHandAction) modules.push('visible-contact-review');
    return {
      id:s.id, action:s.action.trim(), purpose:s.purpose.trim(), seconds:s.seconds,
      framing:s.framing, gaze:s.gaze?.trim() ?? (input.product === 'avatar' ? 'toward-viewer' : 'unresolved'),
      techniques:[...new Set(techniques)], modules,
      requiredEvidence:['actual-playback','continuity-review',...(s.requiresHandAction ? ['hand-contact-review'] : [])],
      reviewStatus:'pending', routeStatus:'unselected'
    };
  });
  const plannedSeconds = shots.reduce((n,s) => n+s.seconds,0);
  require(Math.abs(plannedSeconds-input.durationSeconds) <= 0.001, 'Planned shot durations must match the target; revise the timing plan explicitly.');
  return {
    version:'production-contract-v1', intent:input.intent.trim(), product:input.product, style:input.style,
    deliverable:{count:input.outputCount,targetSeconds:input.durationSeconds}, shots,
    generationPolicy:{maximumRoundsPerWorkUnit:2,defaultCandidatesPerRound:1,resetOnRouteChange:false},
    authorization:{status:'not-authorized',canSubmitPaidJob:false},
    unresolved:shots.filter(s=>s.gaze==='unresolved').map(s=>({shotId:s.id,field:'gaze'})),
    limitations:['Structured-input compiler only; no natural-language extraction.','No provider, budget, approval or review checks have been performed.','Technique vocabulary is versioned and extendable, not a product-wide creative limit.']
  };
}
