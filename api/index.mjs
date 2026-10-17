import {createHandler} from '../apps/director/server.mjs';
let handler;
export default async function director(req,res){handler??=createHandler();return (await handler)(req,res);}
