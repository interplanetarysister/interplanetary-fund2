const enc = new TextEncoder();
const DEFAULT_BASE44_ORIGIN = "https://interplanetaryfund.base44.app";

function json(body, status = 200, origin = "") {
  const headers = { "content-type": "application/json", "cache-control": "no-store" };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-credentials"] = "true";
    headers["access-control-allow-headers"] = "authorization, content-type";
    headers["access-control-allow-methods"] = "POST, OPTIONS";
    headers["vary"] = "Origin";
  }
  return new Response(JSON.stringify(body), { status, headers });
}
function allowedOrigin(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = String(env.IFUND_ALLOWED_ORIGINS || "").split(",").map(v=>v.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : "";
}
function base44Origin(env) {
  const raw = String(env.IFUND_BASE44_ORIGIN || DEFAULT_BASE44_ORIGIN).trim().replace(/\/+$/, "");
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("IFUND_BASE44_ORIGIN must use HTTPS.");
  return url.origin;
}
function isMcpProxyPath(pathname) {
  return pathname === "/api/mcp"
    || pathname.startsWith("/api/mcp/")
    || /^\/api\/apps\/[^/]+\/mcp(?:\/|$)/.test(pathname)
    || pathname === "/.well-known/oauth-protected-resource"
    || pathname.startsWith("/.well-known/oauth-protected-resource/")
    || pathname === "/.well-known/oauth-authorization-server"
    || pathname.startsWith("/.well-known/oauth-authorization-server/")
    || pathname === "/.well-known/openid-configuration";
}
async function proxyBase44Mcp(request, env) {
  const incoming = new URL(request.url);
  const upstreamOrigin = base44Origin(env);
  const upstreamUrl = new URL(incoming.pathname + incoming.search, upstreamOrigin);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
  headers.set("x-ifund-proxy", "cloudflare-mcp");

  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.arrayBuffer();

  const upstream = await fetch(new Request(upstreamUrl.toString(), init));
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("x-ifund-mcp-proxy", "base44");
  responseHeaders.set("cache-control", "no-store");
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
async function sameSecret(a,b) {
  const aa=enc.encode(String(a||"")), bb=enc.encode(String(b||""));
  if (aa.length!==bb.length) return false;
  const key=await crypto.subtle.importKey("raw",enc.encode("ifund-admin-key-compare"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const [ha,hb]=await Promise.all([crypto.subtle.sign("HMAC",key,aa),crypto.subtle.sign("HMAC",key,bb)]);
  const x=new Uint8Array(ha), y=new Uint8Array(hb); let diff=0; for(let i=0;i<x.length;i++) diff|=x[i]^y[i]; return diff===0;
}
function forwardedAdminAuth(request) {
  const authorization = request.headers.get("authorization");
  if (authorization) return { authorization };
  const cookie = request.headers.get("cookie");
  if (cookie) return { cookie };
  return {};
}
async function verifyPlatformAdmin(request, env) {
  const auth = forwardedAdminAuth(request);
  if (!Object.keys(auth).length || !env.IFUND_ADMIN_VERIFY_URL) return null;
  const r=await fetch(env.IFUND_ADMIN_VERIFY_URL,{headers:{...auth,accept:"application/json"}});
  if(!r.ok) return null;
  const user=await r.json(); return user?.role==="admin" && user?.super_admin===true ? user : null;
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
async function audit(env,event,request){
  if(!env.IFUND_AUDIT_URL)return;
  const auth=forwardedAdminAuth(request);
  const headers={"content-type":"application/json",...auth};
  if(!Object.keys(auth).length && env.IFUND_SERVICE_TOKEN) headers.authorization=`Bearer ${env.IFUND_SERVICE_TOKEN}`;
  await fetch(env.IFUND_AUDIT_URL,{method:"POST",headers,body:JSON.stringify(event)}).catch(()=>{});
}
async function callAgentRuntime(env, request, payload) {
  if(!env.IFUND_AGENT_EXECUTE_URL) {
    return { response: json({error:"Development agent runtime is not configured on this host.",degraded:true},503), result:null };
  }
  const auth=forwardedAdminAuth(request);
  if(!Object.keys(auth).length) {
    return { response: json({error:"Administrator authorization required."},401), result:null };
  }
  const r=await fetch(env.IFUND_AGENT_EXECUTE_URL,{
    method:"POST",
    headers:{"content-type":"application/json",...auth},
    body:JSON.stringify(payload),
  });
  const result=await r.json().catch(()=>({}));
  return { response:r, result };
}

export default { async fetch(request, env) {
  const url=new URL(request.url);

  if(url.pathname==="/api/health" || url.pathname.startsWith("/api/health/")){
    if(request.method!=="GET" && request.method!=="HEAD") return json({error:"Method not allowed"},405);
    return json({
      ok:true,
      service:"interplanetary-fund",
      runtime:"cloudflare-worker",
      mcp_proxy:"base44",
      status:"healthy"
    });
  }

  if(isMcpProxyPath(url.pathname)){
    try{return await proxyBase44Mcp(request,env);}
    catch{return json({error:"Interplanetary Fund MCP backend is unavailable.",degraded:true},502);}
  }

  const origin=allowedOrigin(request,env);
  if(request.method==="OPTIONS") return origin?json({},204,origin):json({error:"Origin denied"},403);
  if(!origin) return json({error:"Origin denied"},403);
  const user=await verifyPlatformAdmin(request,env);
  if(!user) return json({error:"Administrator authorization required."},403,origin);

  if(url.pathname==="/v1/admin/agents/session"&&request.method==="POST"){
    const body=await request.json().catch(()=>({}));
    if(!(await sameSecret(body.adminKey,env.IFUND_ADMIN_AGENT_KEY))){
      await audit(env,{type:"admin_agent_auth_failed",userId:user.id,at:new Date().toISOString()},request);
      return json({error:"Admin development key rejected."},403,origin);
    }
    const sessionId=await newSession(user.id,env);
    await audit(env,{type:"admin_agent_session",userId:user.id,agent:String(body.agent||"chief_of_staff"),at:new Date().toISOString()},request);
    return json({sessionId,expiresIn:900},200,origin);
  }

  if(url.pathname==="/v1/admin/agents/message"&&request.method==="POST"){
    const body=await request.json().catch(()=>({}));
    if(!(await validSession(body.sessionId,user.id,env))) return json({error:"Admin development session expired."},401,origin);
    const allowed=new Set(["chief_of_staff","builder_agent","admin_agent","review_agent","verification_agent","connection_discovery_agent"]);
    if(!allowed.has(body.agent)) return json({error:"Agent is not approved for this gateway."},400,origin);

    const runtime=await callAgentRuntime(env,request,{
      agent:body.agent,
      content:String(body.content||""),
      adminUserId:user.id,
    });
    if(runtime.response instanceof Response && runtime.result===null) {
      const fallback=await runtime.response.json().catch(()=>({}));
      return json(fallback,runtime.response.status,origin);
    }

    const result=runtime.result||{};
    await audit(env,{type:"admin_agent_message",userId:user.id,agent:body.agent,status:runtime.response.ok?"accepted":"failed",requestId:result.requestId,at:new Date().toISOString()},request);
    return json(runtime.response.ok?{
      response:result.response||"Request accepted.",
      requestId:result.requestId,
      activityId:result.activityId,
      conversationId:result.conversationId,
      execution_status:result.execution_status,
      degraded:result.degraded===true,
      tool_call:result.tool_call,
    }:{error:result.error||"Agent request failed."},runtime.response.status,origin);
  }

  if(url.pathname==="/v1/admin/agents/status"&&request.method==="POST"){
    const body=await request.json().catch(()=>({}));
    if(!(await validSession(body.sessionId,user.id,env))) return json({error:"Admin development session expired."},401,origin);
    const activityId=String(body.activityId||"").trim();
    if(!activityId) return json({error:"Activity ID is required."},400,origin);

    const runtime=await callAgentRuntime(env,request,{mode:"status",activityId,adminUserId:user.id});
    if(runtime.response instanceof Response && runtime.result===null) {
      const fallback=await runtime.response.json().catch(()=>({}));
      return json(fallback,runtime.response.status,origin);
    }

    const result=runtime.result||{};
    return json(runtime.response.ok?{
      response:result.response||"Agent execution is in progress.",
      requestId:result.requestId,
      activityId:result.activityId||activityId,
      conversationId:result.conversationId,
      execution_status:result.execution_status,
      degraded:result.degraded===true,
      tool_call:result.tool_call,
      tool_errors:result.tool_errors===true,
    }:{error:result.error||"Agent status check failed."},runtime.response.status,origin);
  }

  return json({error:"Not found"},404,origin);
}};

