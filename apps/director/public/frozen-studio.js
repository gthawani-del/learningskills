// The seven approved October screens govern this presentation layer.
// These helpers render existing records; they never create jobs or approve spend.
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHTML;
const paths = {
 image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m4 17 5-5 4 3 3-4 5 6"/>',
 video:'<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
 audio:'<path d="M4 10v4m4-7v10m4-14v18m4-14v10m4-7v4"/>',
 studio:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 ratio:'<rect x="3" y="5" width="18" height="14" rx="2"/>',
 settings:'<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 revise:'<path d="M20 7v5h-5M20 12a8 8 0 1 0-2 6"/>',
 folder:'<path d="M3 6h7l2 3h9v11H3z"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 1-1 1-1 3m0 3h.01"/>',
 account:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M6 19a6 6 0 0 1 12 0"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 model:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9"/>'
};
export const uiIcon = name => `<svg class="ui-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.studio}</svg>`;
export const directorBrand = () => '<span class="director-symbol" aria-hidden="true"><svg viewBox="0 0 32 36"><path fill="#1d5bd5" d="M0 1h14v34H0z"/><path fill="#8bb4ff" d="M14 1a17 17 0 0 1 0 34z"/></svg></span><span>Director</span>';
export function mediaTabs(format, {studio = false} = {}) {
 const selected = ['image','video','audio'].includes(format) ? format : 'studio';
 const items = studio ? ['image','video','audio','studio'] : ['image','video','audio'];
 return `<div class="media-tabs" role="tablist" aria-label="Creation type">${items.map(id => `<button type="button" role="tab" data-media-tab="${id}" aria-selected="${id === selected || !studio && id === 'video' && selected === 'studio'}" tabindex="${id === selected || !studio && id === 'video' && selected === 'studio' ? 0 : -1}">${uiIcon(id)}${id[0].toUpperCase()+id.slice(1)}</button>`).join('')}</div>`;
}
export function mediaSettings({ratio = '16:9', duration = 5, prefix = 'creation', format = 'video'} = {}) {
 return `<div class="media-settings"><label>${uiIcon('ratio')}<span class="setting-label">Aspect ratio</span><select id="${prefix}-ratio" aria-label="Aspect ratio"><option ${ratio==='16:9'?'selected':''}>16:9</option><option ${ratio==='9:16'?'selected':''}>9:16</option><option ${ratio==='1:1'?'selected':''}>1:1</option></select></label><label ${format==='image'?'hidden':''}>${uiIcon('clock')}<span class="setting-label">Shot duration</span><select id="${prefix}-duration" aria-label="Shot duration">${[...new Set([5,10,15,Number(duration)||5])].sort((a,b)=>a-b).map(n=>`<option value="${n}" ${n===Number(duration)?'selected':''}>${prefix==='welcome'?n+'s / shot':n+' seconds'}</option>`).join('')}</select></label><label>${uiIcon('model')}<span class="setting-label">Model</span><select aria-label="Model selection" title="Auto uses the existing approved model registry. No model is activated here."><option>Auto</option></select></label></div>`;
}
export function referenceTiles(assets = [], {uploadId='frozen-upload', remove=false} = {}) {
 return `<div class="reference-tiles">${assets.slice(0,4).map(a=>`<div class="reference-tile">${a.mime?.startsWith('image/')&&a.url?`<img src="${e(a.url)}" alt="${e(a.name)}">`:a.mime?.startsWith('video/')&&a.url?`<video muted playsinline preload="metadata" src="${e(a.url)}" aria-label="${e(a.name)}"></video>`:`${uiIcon(a.mime?.startsWith('audio/')?'audio':'folder')}<small>${e(a.name)}</small>`}${remove?`<button type="button" data-remove-welcome="${e(a.index)}" aria-label="Remove ${e(a.name)}">×</button>`:''}</div>`).join('')}<button class="reference-upload" type="button" id="${uploadId}">${uiIcon('upload')}<span>${assets.length?'Add reference':'Upload'}</span></button></div>`;
}
// Display excerpts from the user's approved design artwork. These are inspiration,
// never customer media, generated takes, playable samples, or production evidence.
export function exampleImage(kind) {
 const boxes={portrait:[318,696,291,194],product:[628,696,290,194],road:[939,696,286,194],singer:[1247,696,288,194]};
 const box=boxes[kind]||boxes.product;
 return `<svg class="example-image" viewBox="${box.join(' ')}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><image href="/studio-examples.jpg" width="1586" height="992"/></svg>`;
}
export const exampleDirections = [
 {kind:'portrait',title:'Natural light portrait',subtitle:'Cinematic character piece',format:'short_film',prompt:'Create a cinematic character portrait in soft natural light, with believable skin texture and restrained performance.'},
 {kind:'product',title:'Fragrance product ad',subtitle:'Product film direction',format:'advertisement',prompt:'Create a cinematic 15-second product film. Warm afternoon light, natural reflections, quiet luxury.'},
 {kind:'road',title:'Cinematic road trip',subtitle:'Scenic travel film',format:'short_film',prompt:'Create a cinematic road trip along a coastal road at golden hour. Wide landscapes and a quiet sense of discovery.'},
 {kind:'singer',title:'Live performance',subtitle:'Music video direction',format:'music_video',prompt:'Create a music video mixing expressive live performance with cinematic B-roll. Preserve the original song.'}
];
export function homeScreen({format,prompt,files,accept,projects,deviceOption,types,settings}) {
 const type=types.find(t=>t.id===format)||types[0], uploaded=files.length>0;
 const cards=[['advertisement','Product film','Showcase your product','product'],['music_video','Music video','Bring your music to life','singer'],['talking_avatar','Talking avatar','Create a digital presenter','portrait'],['short_film','Short film','Tell a bigger story','road']];
 return `<section class="frozen-home ${uploaded?'has-upload':''}"><div class="home-create"><h1>What will you create?</h1><form id="start-form" class="home-composer">${mediaTabs(format,{studio:true})}<div class="home-composer-body">${referenceTiles(files,{uploadId:'welcome-upload',remove:true})}<label class="visually-hidden" for="premise">Your idea</label><textarea id="premise" placeholder="${e(type.placeholder)}">${e(prompt)}</textarea><input id="welcome-file" type="file" hidden multiple accept="${e(accept)}" aria-label="Choose reference files"></div><div class="home-composer-footer">${mediaSettings({...settings,prefix:'welcome',format})}<button type="submit" class="primary review-estimate">Review estimate ${uiIcon('arrow')}</button></div><p id="welcome-error" class="error-text" role="alert"></p></form><div class="home-context"><label class="format-select"><span>Studio format</span><select id="home-format" aria-label="Studio format">${types.map(t=>`<option value="${t.id}" ${t.id===format?'selected':''}>${e(t.choice||t.label)}</option>`).join('')}</select></label><span>No generation starts before cost approval.</span>${deviceOption?'<button type="button" id="start-device" class="text-button">Continue as a device draft</button>':''}</div>${!uploaded?`<div class="creation-shortcuts">${cards.map(([id,title,sub,kind])=>`<button type="button" data-format="${id}" aria-pressed="${format===id}">${exampleImage(kind)}<span><strong>${title}</strong><small>${sub}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div><section class="featured-examples"><header><h2>Featured examples</h2><span>Visual inspiration</span></header><div class="example-grid">${exampleDirections.map((x,i)=>`<button type="button" data-example="${i}">${exampleImage(x.kind)}<strong>${x.title}</strong><small>${x.subtitle}</small></button>`).join('')}</div></section>${projects.length?`<section class="recent-projects"><header><h2>Recent projects</h2><a href="#projects" data-studio-route="projects">View all projects →</a></header><div class="studio-project-grid">${projects.slice(0,3).map(p=>`<article class="studio-project-card"><small>${e(p.format.replaceAll('_',' '))}</small><h2>${e(p.title)}</h2><button type="button" data-open="${e(p.id)}">Open project</button></article>`).join('')}</div></section>`:''}`:''}</div>${uploaded?`<section class="entry-preview"><header><h2>Reference preview</h2><p>Original upload</p></header><div class="entry-reference-canvas">${mediaPreview(files[0])}</div><h2>Planned shots</h2><div class="empty-shot-plan">Your shots will appear after you review and plan this project.</div></section>`:''}</section>`;
}
export function mediaPreview(asset,{videoId='studio-player',imageId='studio-still'}={}) {
 if(!asset)return '<div class="viewer-empty"><h2>Your preview belongs here</h2><p>Upload a reference or select saved media to begin.</p></div>';
 if(asset.mime?.startsWith('image/'))return `<img id="${imageId}" src="${e(asset.url)}" alt="${e(asset.name||'Selected reference')}">`;
 if(asset.mime?.startsWith('video/'))return `<video id="${videoId}" controls playsinline preload="metadata" src="${e(asset.url)}" aria-label="${e(asset.name||'Selected clip')}"></video>`;
 if(asset.mime?.startsWith('audio/'))return `<div class="audio-preview">${uiIcon('audio')}<h2>${e(asset.name)}</h2><audio controls preload="metadata" src="${e(asset.url)}" aria-label="${e(asset.name)}"></audio></div>`;
 return `<div class="viewer-empty">${uiIcon('folder')}<h2>${e(asset.name)}</h2><a href="${e(asset.url)}" download="${e(asset.name)}">Download reference</a></div>`;
}
export function generationProgress(jobs = []) {
 const pending=jobs.filter(j=>['reserved','queued','submitted','running','unknown'].includes(j.status));
 if(!pending.length)return '';
 const job=pending[0],unknown=job.status==='unknown', reference=job.kind==='reference'||job.subjectId||job.subject_id;
 const name=reference?'reference image':job.kind==='storyboard'||job.shotId||job.shot_id?'storyboard frame':'media';
 return `<section class="generation-progress" aria-label="Generation progress" role="status"><h2>${unknown?'Checking generation status':`Creating ${name}`} <small>${pending.length} pending</small></h2><ol><li class="complete">Reference ready</li><li class="current">${unknown?'Awaiting confirmation':`Generating ${name}`}</li><li>Ready for review</li></ol><footer><button type="button" disabled title="Cancellation is not supported by this job interface">Cancel</button><span>${unknown?'The result is unconfirmed. Do not submit a duplicate request.':'Your saved job remains attached to this project.'}</span></footer></section>`;
}
