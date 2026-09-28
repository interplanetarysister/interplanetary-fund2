const enc = new TextEncoder();

function json(body, status = 200, origin = "") {
  const headers = { "content-type": "application/json", "cache-control": "no-store" };
  if (origin) { headers["access-control-allow-origin"] = origin; headers["access-control-allow-credentials"] = "true"; headers["vary"] = "Origin"; }
  return new Response(JSON.stringify(body), { status, headers });
}
function allowedOrigin(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = String(env.IFUND_ALLOWED_ORIGINS || "").split(",").map(v=>v.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : "";
}
async function sameSecret(a,b) {
  const aa=enc.encode(String(a||"")), bb=enc.encode(String(b||""));
  if (aa.length!==bb.length) return false;
  const key=await crypto.subtle.importKey("raw",enc.encode("ifund-admin-key-compare"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const [ha,hb]=await Promise.all([crypto.subtle.sign("HMAC",key,aa),crypto.subtle.sign("HMAC",key,bb)]);
  const x=new Uint8Array(ha), y=new Uint8Array(hb); let diff=0; for(let i=0;i<x.length;i++) diff|=x[i]^y[i]; return diff===0;
}
async function verifyPlatformAdmin(request, env) {
  const auth=request.headers.get("authorization") || request.headers.get("cookie") || "";
  if (!auth || !env.IFUND_ADMIN_VERIFY_URL) return null;
  const headerName=request.headers.get("authorization") ? "authorization" : "cookie";
  const r=await fetch(env.IFUND_ADMIN_VERIFY_URL,{headers:{[headerName]:auth,accept:"application/json"}});
  if(!r.ok) return null;
  const user=await r.json(); return user?.role==="admin" ? user : null;
}
function b64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
async function sessionSignature(payload,env){
  if(!env.IFUND_SESSION_SECRET) throw new Error("Session signing secret is not configured.");
  const key=await crypto.subtle.importKey("raw",enc.encode(env.IFUND_SESSION_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(payload))));
}
async function newSession(userId,env){
  const payload=b64url(enc.encode(JSON.stringify({uid:userId,exp:Date.now()+15*60*1000,nonce:crypto.randomUUID()})));
  return payload+"."+await sessionSignature(payload,env);
}
async function validSession(token,userId,env){
  const [payload,sig,...extra]=String(token||"").split(".");
  if(!payload||!sig||extra.length) return false;
  if(!(await sameSecret(sig,await sessionSignature(payload,env)))) return false;
  try{
    const raw=atob(payload.replace(/-/g,"+").replace(/_/g,"/"));
    const data=JSON.parse(new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0))));
    return data.uid===userId&&Number(data.exp)>Date.now();
  }catch{return false;}
}
async function audit(env,event){if(!env.IFUND_AUDIT_URL)return;await fetch(env.IFUND_AUDIT_URL,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${env.IFUND_SERVICE_TOKEN||""}`},body:JSON.stringify(event)}).catch(()=>{});}
export default { async fetch(request, env) {
  const origin=allowedOrigin(request,env);
  if(request.method==="OPTIONS") return origin?json({},204,origin):json({error:"Origin denied"},403);
  if(!origin) return json({error:"Origin denied"},403);
  const url=new URL(request.url);
  const user=await verifyPlatformAdmin(request,env);
  if(!user) return json({error:"Administrator authorization required."},403,origin);
  if(url.pathname==="/v1/admin/agents/session"&&request.method==="POST"){
    const body=await request.json().catch(()=>({}));
    if(!(await sameSecret(body.adminKey,env.IFUND_ADMIN_AGENT_KEY))){await audit(env,{type:"admin_agent_auth_failed",userId:user.id,at:new Date().toISOString()});return json({error:"Admin development key rejected."},403,origin);}
    const sessionId=await newSession(user.id,env); await audit(env,{type:"admin_agent_session",userId:user.id,agent:"chief_of_staff",at:new Date().toISOString()}); return json({sessionId,expiresIn:900},200,origin);
  }
  if(url.pathname==="/v1/admin/agents/message"&&request.method==="POST"){
    const body=await request.json().catch(()=>({}));
    if(!(await validSession(body.sessionId,user.id,env))) return json({error:"Admin development session expired."},401,origin);
    const allowed=new Set(["chief_of_staff","builder_agent","admin_agent","review_agent","verification_agent"]);
    if(!allowed.has(body.agent)) return json({error:"Agent is not approved for this gateway."},400,origin);
    if(!env.IFUND_AGENT_EXECUTE_URL) return json({error:"Development agent runtime is not configured on this host.","degraded":true},503,origin);
    const r=await fetch(env.IFUND_AGENT_EXECUTE_URL,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${env.IFUND_SERVICE_TOKEN||""}`},body:JSON.stringify({agent:body.agent,content:String(body.content||""),adminUserId:user.id})});
    const result=await r.json().catch(()=>({}));
    await audit(env,{type:"admin_agent_message",userId:user.id,agent:body.agent,status:r.ok?"accepted":"failed",at:new Date().toISOString()});
    return json(r.ok?{response:result.response||"Request accepted.",requestId:result.requestId}:{error:result.error||"Agent request failed."},r.status,origin);
  }
  return json({error:"Not found"},404,origin);
}};
