// Deterministic project-source comparison. No global corpus or legal clearance is implied.
export const ORIGINALITY_POLICY_VERSION='director-originality-project-v1';
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':plain(x)?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
const common=new Set(['once upon a time in a land far away','and they all lived happily ever after','thank you very much for your time and attention','i do not know what you are talking about','at the end of the day we will see']);
function boundedText(text,limit,label){if(typeof text!=='string'||text.length>limit)fail(label+' must be bounded text.');return text;}
export function normalizeOriginalityText(text){
 boundedText(text,150000,'Comparison text');
 // Ignore invisible formatting controls only in the matching view. Keep UTF-16
 // source offsets so every finding still points into the unchanged original.
 const characters=[],offsets=[];let cursor=0,ignoredFormatControls=0;
 for(const character of text){if(/\p{Cf}/u.test(character)){ignoredFormatControls++;}else{characters.push(character);for(let i=0;i<character.length;i++)offsets.push(cursor+i);}cursor+=character.length;}
 const matchingView=characters.join('');
 const tokens=[...matchingView.matchAll(/[\p{L}\p{N}\p{M}]+/gu)].map(m=>({value:m[0].normalize('NFKC').toLocaleLowerCase('und'),start:offsets[m.index],end:offsets[m.index+m[0].length-1]+1}));
 return {normalized:tokens.map(t=>t.value).join(' '),tokens,ignoredFormatControls};
}
function sourcesFor(sources){
 if(!Array.isArray(sources)||sources.length>20)fail('Only a bounded project-scoped source collection may be checked.');
 const ids=new Set();let total=0;
 return sources.map(s=>{if(!plain(s)||typeof s.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(s.id)||ids.has(s.id)||typeof s.title!=='string'||!s.title.trim()||s.title.length>200||!['reference_only','adaptation','user_owned'].includes(s.permittedUse))fail('Comparison sources require unique IDs, names and declared use.');ids.add(s.id);boundedText(s.text,100000,'Source text');total+=s.text.length;if(total>300000)fail('Project source comparison text is too large.');return {id:s.id,title:s.title,text:s.text,permittedUse:s.permittedUse};});
}
export function originalityInputSignature(text,sources){boundedText(text,150000,'Script text');return canonical({policyVersion:ORIGINALITY_POLICY_VERSION,text,sources:sourcesFor(sources)});}
const gram=(tokens,start,n)=>tokens.slice(start,start+n).map(t=>t.value).join(' ');
function distinctive(tokens){const words=tokens.map(t=>t.value);return words.length>=8&&new Set(words).size>=6&&words.join(' ').length>=40&&!common.has(words.join(' '));}
function units(text,tokens){
 const out=[];let cursor=0;
 for(const sentence of text.matchAll(/[^.!?।\n]+[.!?।]?/gu)){
 const startOffset=sentence.index,endOffset=startOffset+sentence[0].length;
 while(cursor<tokens.length&&tokens[cursor].end<=startOffset)cursor++;
 const start=cursor;while(cursor<tokens.length&&tokens[cursor].start<endOffset)cursor++;
 const inside=tokens.slice(start,cursor).filter(t=>t.start>=startOffset&&t.end<=endOffset);
 if(inside.length<12)continue;
 for(let offset=0;offset<inside.length;offset+=30){const part=inside.slice(offset,offset+60);if(part.length>=12){if(out.length===600)return {windows:out,truncated:true};out.push(part);}}
 }return {windows:out,truncated:false};
}
function editDistance(a,b,limit){if(Math.abs(a.length-b.length)>limit)return limit+1;let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=Array(b.length+1).fill(limit+1);next[0]=i;let min=next[0];for(let j=Math.max(1,i-limit);j<=Math.min(b.length,i+limit);j++){next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+(a[i-1].value===b[j-1].value?0:1));min=Math.min(min,next[j]);}if(min>limit)return limit+1;row=next;}return row[b.length];}
export function scanOriginality(text,sources=[]){
 boundedText(text,150000,'Script text');const scoped=sourcesFor(sources),script=normalizeOriginalityText(text),findings=[],nonempty=[],scriptUnits=units(text,script.tokens),incompleteReasons=new Set();let truncated=false;
 const limited=reason=>{truncated=true;incompleteReasons.add(reason);};
 const add=(source,a,b,kind,tokenCount,distance=0)=>{const item={key:[source.id,a.start,a.end,b.start,b.end,kind].join(':'),sourceId:source.id,sourceTitle:source.title,declaredUse:source.permittedUse,kind,scriptStart:a.start,scriptEnd:a.end,sourceStart:b.start,sourceEnd:b.end,tokenCount,editDistance:distance,scriptExcerpt:text.slice(a.start,a.end),sourceExcerpt:source.text.slice(b.start,b.end)};if(findings.some(f=>f.sourceId===item.sourceId&&f.scriptStart<=item.scriptStart&&f.scriptEnd>=item.scriptEnd&&f.sourceStart<=item.sourceStart&&f.sourceEnd>=item.sourceEnd))return;if(findings.length>=200){limited('Finding limit reached.');return;}findings.push(item);};
 for(const source of scoped){
 const other=normalizeOriginalityText(source.text),index=new Map();if(other.tokens.length)nonempty.push(source);
 for(let j=0;j<=other.tokens.length-8;j++){const key=gram(other.tokens,j,8);if(new Set(other.tokens.slice(j,j+8).map(t=>t.value)).size<6)continue;const list=index.get(key)||[];if(list.length<20)list.push(j);else limited('Repeated contiguous-anchor candidate limit reached.');index.set(key,list);}
 let previousEnd=-1;
 for(let i=0;index.size&&i<=script.tokens.length-8;i++){
 if(i<previousEnd)continue;
 for(const j of index.get(gram(script.tokens,i,8))||[]){let left=0,right=8;while(i-left>0&&j-left>0&&script.tokens[i-left-1].value===other.tokens[j-left-1].value)left++;while(i+right<script.tokens.length&&j+right<other.tokens.length&&script.tokens[i+right].value===other.tokens[j+right].value)right++;
 const a=script.tokens.slice(i-left,i+right),b=other.tokens.slice(j-left,j+right);if(!distinctive(a))continue;
 const full=script.normalized===other.normalized;add(source,{start:a[0].start,end:a.at(-1).end},{start:b[0].start,end:b.at(-1).end},full?'exact':'contiguous',a.length);previousEnd=i+right;
 }
 }
 // Near-verbatim means bounded token edits within sentence units, not semantic similarity.
 const sourceUnitResult=units(source.text,other.tokens),sourceUnits=sourceUnitResult.windows,anchors=new Map();
 if(other.tokens.length&&scriptUnits.truncated)limited('Script near-verbatim sentence-window limit reached.');
 if(sourceUnitResult.truncated)limited('Source near-verbatim sentence-window limit reached: '+source.id);
 sourceUnits.forEach((u,idx)=>{for(let i=0;i<=u.length-4;i++){const key=gram(u,i,4),set=anchors.get(key)||new Set();if(set.size<100)set.add(idx);else limited('Repeated near-verbatim anchor candidate limit reached.');anchors.set(key,set);}});
 let comparisons=0;
 for(const a of scriptUnits.windows){const candidates=new Set();for(let i=0;i<=a.length-4;i++)for(const idx of anchors.get(gram(a,i,4))||[])candidates.add(idx);
 for(const idx of [...candidates].sort((a,b)=>a-b)){if(++comparisons>4000){limited('Near-verbatim comparison limit reached: '+source.id);break;}const b=sourceUnits[idx],limit=Math.min(3,Math.floor(Math.min(a.length,b.length)*.15));if(!distinctive(a)||!distinctive(b))continue;const distance=editDistance(a,b,limit);if(distance<1||distance>limit)continue;
 add(source,{start:a[0].start,end:a.at(-1).end},{start:b[0].start,end:b.at(-1).end},'near_verbatim',a.length,distance);
 }
 if(comparisons>4000)break;
 }
 }
 findings.sort((a,b)=>a.scriptStart-b.scriptStart||a.sourceId.localeCompare(b.sourceId)||a.sourceStart-b.sourceStart);
 const groups=new Map();for(const f of findings)if(f.kind==='contiguous'){const list=groups.get(f.sourceId)||[];list.push(f);groups.set(f.sourceId,list);}for(const list of groups.values())if(list.length>1)for(const f of list){f.kind='fragment';f.key=[f.sourceId,f.scriptStart,f.scriptEnd,f.sourceStart,f.sourceEnd,f.kind].join(':');}
 return {policyVersion:ORIGINALITY_POLICY_VERSION,inputSignature:originalityInputSignature(text,scoped),status:findings.length||truncated?'review_required':nonempty.length?'no_matches_within_coverage':'coverage_unavailable',coverage:{status:nonempty.length?'project_sources_only':'unavailable',sourceCount:nonempty.length,sourceIds:nonempty.map(s=>s.id),completeWithinPolicy:nonempty.length>0&&!truncated,externalCorpus:false,translatedOrSemanticCopyingChecked:false,matchingThresholds:{minimumExactTokens:8,minimumDistinctTokens:6,minimumNormalizedPassageCharacters:40,minimumNearVerbatimTokens:12,maxNearVerbatimTokenEdits:3,nearVerbatimEditFraction:.15,nearVerbatimAnchorTokens:4,nearVerbatimMethod:'Sentence windows up to sixty tokens, stepped by thirty; requires a shared four-token anchor.',thresholdMeaning:'Comparison heuristics, not a legal safe harbor.',shortQuotationsChecked:false},normalization:'Unicode NFKC, lowercase, ignored Unicode format controls and word-token punctuation normalization; original offsets retained; no transliteration or translation.'},findings,truncated,incompleteReasons:[...incompleteReasons].sort(),limits:{nearVerbatimSentenceWindowsPerText:600,nearVerbatimComparisonsPerSource:4000,contiguousCandidatesPerAnchor:20,nearVerbatimCandidatesPerAnchor:100,findings:200},legalClearance:false};
}
