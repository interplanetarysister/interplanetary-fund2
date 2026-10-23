// IFund independent workforce bootstrap: fail-closed until verified execution adapters exist.
// No user memory, secrets, or tool permissions are exposed by this endpoint.
const reply=(payload,status=200)=>Response.json(payload,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/health'&&request.method==='GET')return reply({service:'ifund-workforce',runtime:'cloudflare-worker',alive:true,ready:false,execution:'disabled',reason:'tool_memory_auth_adapters_unverified'});
  if(!url.pathname.startsWith('/v1/workforce/'))return reply({error:'not_found'},404);
  if(request.method==='OPTIONS')return reply({error:'not_found'},404);
  // Never allow a configuration toggle to bypass missing verified authorization and tool execution.
  return reply({error:'service_unavailable',code:'workforce_not_ready',message:'Agent workforce migration is in progress; no agent action was executed.'},503);
 }
};
