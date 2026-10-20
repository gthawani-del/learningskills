// Reuse existing authenticated HTTP/store/storage fixture. No external services.
import {referenceFixture,referenceSession} from './reference-fixture-server.mjs';
import {createServer} from '../server.mjs';
const f=await referenceFixture();
const user={id:f.project.ownerId,email:'creator@example.test'};
const session={access_token:referenceSession,refresh_token:'ftue-fixture-refresh',expires_in:3600,user};
f.store.login=async(email,password)=>{if(password!=='fixture-password')throw Object.assign(Error('Check your email and password.'),{status:401});return session;};
f.store.signup=async()=>({id:user.id,email:user.email});
f.store.refresh=async()=>session;
f.store.request=async()=>null;
const server=await createServer(f);
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:server.address().port})));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
