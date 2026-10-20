import {spawn, execFileSync} from 'node:child_process';
import {readFile, mkdir, writeFile, access} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve, relative, dirname, extname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {once} from 'node:events';

const root=resolve(import.meta.dirname,'..');
export const browsers=['account-recovery-browser','studio-navigation-browser','ftue-browser','music-video-redteam-browser','music-video-browser','creative-brief-browser','v2-workspace','mobile-footer-browser','compact-proposal-browser','registry-browser','writing-browser','planning-ui-browser','department-browser','department-revision-browser','storyboard-browser','reference-browser','storyboard-production-browser','animatic-browser','animatic-audio-browser','animatic-audio-mp3-browser'];
const sharedUI=/public\/(app\.js|.*\.css|index\.html|api-client\.js|device-drafts\.js)$/;
async function nodeTests(){const source=await readFile(resolve(root,'scripts/test-director.mjs'),'utf8');return [...source.matchAll(/import\(['"]([^'"]+\.test\.mjs)['"]\)/g)].map(m=>relative(root,resolve(root,'scripts',m[1])));}
async function imports(path,seen=new Set()){
 if(seen.has(path))return seen;seen.add(path);let source;try{source=await readFile(resolve(root,path),'utf8');}catch{return seen;}
 for(const match of source.matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+)['"]/g)){
  const child=relative(root,resolve(root,dirname(path),match[1]));if(['.js','.mjs'].includes(extname(child)))await imports(child,seen);
 }return seen;
}
export async function selectChecks(changed){
 const all=await nodeTests();const paths=changed.map(p=>relative(root,resolve(root,p)).replaceAll('\\','/'));
 if(paths.some(p=>p.startsWith('../')))throw Error('Changed paths must be inside this repository.');
 const tooling=paths.some(p=>/^(scripts\/|\.github\/|package(?:-lock)?\.json$|requirements-qa\.txt$|vercel\.json$|docs\/evidence\/)/.test(p));
 const behavioral=paths.filter(p=>!/^(docs\/|README\.md$|\.gitignore$)/.test(p));
 let tests=[];const covered=new Set();for(const test of all){const deps=await imports(test);for(const path of paths)if(deps.has(path)){covered.add(path);if(!tests.includes(test))tests.push(test);}}
 const unknown=behavioral.some(p=>!covered.has(p)&&!/\.(css|html|py)$/.test(p));
 if(tooling||unknown)tests=all;
 const chosen=new Set();
 for(const p of behavioral){
  if(tooling||sharedUI.test(p)||/^(api\/|apps\/director\/(api|server|store|domain|spending|production-state)\.)/.test(p)){for(const b of browsers)chosen.add(b);continue;}
  const rules=[[/account-recovery/,['account-recovery-browser','ftue-browser']],[/studio-shell|studio-catalog|studio-navigation/,['studio-navigation-browser']],[/ftue/,['ftue-browser']],[/music-video/,['music-video-browser','music-video-redteam-browser']],[/creative-brief/,['creative-brief-browser','compact-proposal-browser']],[/screenplay|writing|originality/,['writing-browser']],[/department-revision/,['department-revision-browser']],[/department/,['department-browser','department-revision-browser']],[/reference/,['reference-browser','storyboard-production-browser']],[/storyboard-handoff/,['storyboard-browser','storyboard-production-browser']],[/storyboard-production|storyboard-frame|storyboard-pricing/,['storyboard-production-browser']],[/registry/,['registry-browser']],[/planning/,['planning-ui-browser']],[/animatic/,['animatic-browser','animatic-audio-browser','animatic-audio-mp3-browser']]];
  for(const[pattern,names]of rules)if(pattern.test(p))for(const name of names)if(browsers.includes(name))chosen.add(name);
  if(p.endsWith('.py')){const name=p.split('/').at(-1).slice(0,-3);if(browsers.includes(name))chosen.add(name);}
 }
 if(unknown&&!chosen.size)for(const b of browsers)chosen.add(b);
 return {tests,browsers:[...chosen],sql:paths.some(p=>p.startsWith('database/')||/storyboard-production-store|reference-store|spending-store/.test(p)),reason:tooling||unknown?'Conservative fallback for tooling or an unclassified dependency.':'Existing checks selected from module imports and affected browser surfaces.'};
}
export async function main(args=process.argv.slice(2)){
 const fast=args.includes('--fast'),changed=[];let base;
 for(let i=0;i<args.length;i++){if(args[i]==='--changed'){while(args[i+1]&&!args[i+1].startsWith('--'))changed.push(args[++i]);}else if(args[i]==='--base')base=args[++i];else if(args[i]!=='--fast')throw Error('Use --fast [--changed paths... | --base git-ref].');}
 if(base){if(base.startsWith('-'))throw Error('Invalid base ref.');changed.push(...execFileSync('git',['diff','--name-only','--diff-filter=ACDMRT',`${base}...HEAD`,'--'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean));}
 if(fast&&!changed.length)throw Error('Fast QA requires --changed paths... or --base git-ref. Full release QA is npm run qa.');
 const selected=fast?await selectChecks(changed):{tests:await nodeTests(),browsers:[...browsers],sql:true,reason:'Full release checks.'};
 const out=resolve(root,'test-results/qa');await mkdir(out,{recursive:true});
 const env={...process.env,NODE_ENV:'test',PYTHONDONTWRITEBYTECODE:'1'};
 for(const name of ['FAL_API_KEY','OPENAI_API_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_URL','VERCEL','APP_ORIGIN'])delete env[name];
 const python=process.env.PYTHON||'python3',steps=[];let server,failed;
 async function run(name,bin,argv,extra={},timeout=240000){
  console.log(`QA: ${name}`);const started=Date.now(),lines=[];
  const child=spawn(bin,argv,{cwd:root,env:{...env,...extra},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
  child.stdout.on('data',b=>lines.push(b.toString()));child.stderr.on('data',b=>lines.push(b.toString()));
  const stop=()=>{try{process.kill(process.platform==='win32'?child.pid:-child.pid,'SIGKILL');}catch{}};
  const timer=setTimeout(stop,timeout);let code;try{[code]=await once(child,'close');}finally{clearTimeout(timer);stop();}
  const log=lines.join('');await writeFile(resolve(out,name+'.log'),log);
  steps.push({name,code,seconds:Math.round((Date.now()-started)/10)/100,log:`test-results/qa/${name}.log`});
  if(code!==0)throw Error(`${name} failed (${code??'timeout/signal'}).\n${log.split('\n').slice(-35).join('\n')}`);
 }
 try{
  await run('syntax','npm',['run','check']);
  if(selected.tests.length)await run('node-tests',process.execPath,fast?['--test','--test-concurrency=1',...selected.tests]:['scripts/test-director.mjs']);
  await run('build','npm',['run','build']);
  if(selected.browsers.length){
   const supplied=env.DIRECTOR_CHROMIUM_PATH;
   env.DIRECTOR_CHROMIUM_PATH=supplied||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':execFileSync(python,['-c','from playwright.sync_api import sync_playwright\nwith sync_playwright() as p: print(p.chromium.executable_path)'],{env,encoding:'utf8'}).trim());
   await access(env.DIRECTOR_CHROMIUM_PATH);execFileSync('ffmpeg',['-version'],{stdio:'ignore'});execFileSync('ffprobe',['-version'],{stdio:'ignore'});
   const {createServer}=await import('../apps/director/server.mjs');server=await createServer({env:{NODE_ENV:'test'}});server.listen(0,'127.0.0.1');await once(server,'listening');
   env.DIRECTOR_TEST_URL=`http://127.0.0.1:${server.address().port}`;
   for(const name of selected.browsers)await run(name,python,[`apps/director/tests/${name==='animatic-audio-mp3-browser'?'animatic-audio-browser':name}.py`],name==='writing-browser'?{DIRECTOR_WRITING_STAGE_FAILURE:'1'}:name==='animatic-audio-mp3-browser'?{DIRECTOR_ANIMATIC_AUDIO_FORMAT:'mp3'}:{});
  }
  if(selected.sql){env.PGLITE_PACKAGE=fileURLToPath(import.meta.resolve('@electric-sql/pglite'));await run('sql-proof',process.execPath,['database/checks/storyboard-production-pglite.mjs'],{PROOF_OUTPUT:resolve(out,'sql-proof.json')});}
 }catch(error){failed=error;console.error(error.message);}finally{
  if(server){server.closeAllConnections();await new Promise(done=>server.close(done));}
  const report={mode:fast?'fast':'full',changed,selected,steps,passed:!failed,error:failed?.message,paidProviderCalls:0,deployedWebsiteTested:false,physicalMobileTested:false};
  await writeFile(resolve(out,'summary.json'),JSON.stringify(report,null,2)+'\n');console.log(`QA ${failed?'FAILED':'PASSED'} (${fast?'affected checks':'full release checks'}). Report: test-results/qa/summary.json`);
 }
 if(failed)throw failed;return {selected,steps};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(error=>{console.error(error.message);process.exitCode=1;});
