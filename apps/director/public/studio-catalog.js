// Shared product vocabulary. A format declaration never enables a paid route.
export const PRODUCTION_TYPES = Object.freeze([
 {id:'short_film',label:'Movie / short film',choice:'Short film',description:'Develop a story, cast, storyboard and finished sequence.',placeholder:'Describe a story, a scene, or upload your script…'},
 {id:'advertisement',label:'Advertisement',choice:'Advertisement',description:'Build a product or brand story around a clear objective.',placeholder:'What are we advertising, and what should viewers feel or do?'},
 {id:'documentary',label:'Documentary',choice:'Documentary',description:'Start with a subject, evidence and a factual narrative.',placeholder:'Describe the subject and upload any sources or interview material…'},
 {id:'docuseries',label:'Docuseries',choice:'Docuseries',description:'Develop a connected documentary story across episodes.',placeholder:'What connects the episodes? Describe the subject and available sources…'},
 {id:'micro_series',label:'Microseries / drama',choice:'Microseries / drama',description:'Plan recurring characters, episode arcs and continuity.',placeholder:'Describe the series premise, recurring characters or first episode…'},
 {id:'music_video',label:'Music video',choice:'Music video',description:'Shape a song into performance, lip sync and visual storytelling.',placeholder:'Upload your song and describe the performance, story or visual direction…'},
 {id:'talking_avatar',label:'Talking avatar',choice:'Talking avatar',description:'Direct a presenter with a script, voice and performance.',placeholder:'What should your presenter say? Add a script, audio or identity reference…'}
]);
export const MEDIA_TOOLS = Object.freeze([
 {id:'image',label:'Image',choice:'Image',description:'Develop a single image with references and visual direction.',placeholder:'Describe the image, or upload a reference to work from…'},
 {id:'video',label:'Video clip',choice:'Video clip',description:'Develop a clip with framing, motion and sound direction.',placeholder:'Describe the shot and movement, or upload a starting image…'},
 {id:'audio',label:'Audio',choice:'Audio',description:'Develop voice, music or sound with relevant references.',placeholder:'Describe the voice, music or sound you need…'}
]);
export const PROJECT_FORMATS = Object.freeze([...PRODUCTION_TYPES,...MEDIA_TOOLS].map(v=>v.id));
export const isProjectFormat = value => PROJECT_FORMATS.includes(value);
export const productionType = value => [...PRODUCTION_TYPES,...MEDIA_TOOLS].find(v=>v.id===value)||PRODUCTION_TYPES[0];
const common = [['brief','Brief'],['story','Story'],['cast','Cast & World'],['storyboard','Storyboard'],['production','Production'],['edit','Edit & Review'],['export','Export']];
const labels = {
 advertisement:{story:'Concept & script',cast:'Product, cast & voice'},
 documentary:{story:'Research & script',cast:'Subjects & locations',edit:'Edit & fact review'},
 docuseries:{story:'Research & episodes',cast:'Subjects & locations',storyboard:'Episode storyboard',edit:'Edit & fact review'},
 micro_series:{story:'Series & script',cast:'Cast & continuity',storyboard:'Episode storyboard'},
 music_video:{brief:'Brief & song',story:'Treatment & lyrics',cast:'Cast, look & voice',storyboard:'Storyboard & timing',production:'Performance & B-roll',edit:'Edit & sync review'},
 talking_avatar:{story:'Script',cast:'Presenter & voice',storyboard:'Framing & performance',production:'Performance & lip sync'},
 image:{cast:'Look & references',production:'Image production'},
 video:{production:'Video production'},
 audio:{cast:'Voice & references',production:'Audio production',edit:'Mix & review'}
};
export function productionSteps(format){
 const subset={image:['brief','cast','production','export'],video:['brief','storyboard','production','edit','export'],audio:['brief','cast','production','edit','export']}[format];
 return common.filter(([id])=>!subset||subset.includes(id)).map(([id,label])=>({id,label:labels[format]?.[id]||label}));
}
export const ASSET_CATEGORIES = Object.freeze(['images','videos','characters','audio']);
export function assetCategory(asset){
 if(asset.role==='character_identity')return 'characters';
 if(asset.mime?.startsWith('image/'))return 'images';
 if(asset.mime?.startsWith('video/'))return 'videos';
 if(asset.mime?.startsWith('audio/'))return 'audio';
 return null;
}
export function filterStudioAssets(rows,{category='images',query='',projectId=''}={}){
 const term=query.trim().toLocaleLowerCase();
 return rows.filter(row=>assetCategory(row)===category&&(!projectId||row.projectId===projectId)&&(!term||`${row.name||''} ${row.projectTitle||''} ${row.role||''}`.toLocaleLowerCase().includes(term)));
}
