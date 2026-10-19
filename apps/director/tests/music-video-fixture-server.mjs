import {animaticFixture} from './animatic-fixture-server.mjs';
import {createServer} from '../server.mjs';
import {referenceSession} from './reference-fixture-server.mjs';
const f=await animaticFixture({audio:true});
const project={...f.project,format:'music_video',stage:'brief',version:f.project.version+1};await f.store.save(project,f.project.version);
const server=await createServer(f);server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({projectId:project.id,port:server.address().port,session:referenceSession})));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
