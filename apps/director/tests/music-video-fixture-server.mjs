import {saveMusicVideo,MUSIC_VIDEO_KIND} from '../public/music-video-core.js';
import {animaticFixture} from './animatic-fixture-server.mjs';
import {createServer} from '../server.mjs';
import {referenceSession} from './reference-fixture-server.mjs';
const timing=process.env.DIRECTOR_MUSIC_TIMING_FIXTURE==='1';
const f=await animaticFixture({audio:true,...(timing?{projectSettings:{format:'music_video',duration:1.5}}:{})});
let project={...f.project,format:'music_video',stage:timing?'storyboard':'brief',version:f.project.version+1};await f.store.save(project,f.project.version);
if(timing){const asset=f.audio,document={kind:MUSIC_VIDEO_KIND,master:{assetId:asset.id,assetVersion:asset.version,checksum:asset.checksum,durationMs:3000,timingBasis:'user_reviewed'},range:{startMs:1000,endMs:2500},fps:24,sections:[{id:'excerpt',label:'Reviewed excerpt',startMs:1000,endMs:2500,timingBasis:'user_reviewed'}],shots:project.shots.map((s,i)=>({shotId:s.id,shotVersion:s.version,contractVersion:project.storyboardHandoff.shots.find(x=>x.id===s.id).currentVersion,startMs:i?1750:1000,endMs:i?2500:1750,role:'broll',syncClass:'no_sync',performers:[],timingBasis:'user_reviewed'}))};const next=saveMusicVideo(project,{expectedVersion:project.version,document,acknowledgePlanning:true},await f.store.records('assets',project.id));project=await f.store.save(next,project.version);}
const server=await createServer(f);server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({projectId:project.id,port:server.address().port,session:referenceSession})));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
