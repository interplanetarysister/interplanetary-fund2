import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const keyB64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEULHIdTiu+6Z0jkuABd0Gj483NXCk5EfjdPk9vBKgCmyGzCTpipzOOfqPvCwh4dOYqa/tm+lipTjopYKBZyQEWg==";
const encoder = new TextEncoder();
const bytes = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hexBytes = (s: string) => Uint8Array.from(s.match(/.{2}/g) || [], v => parseInt(v,16));
const answer = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const priority = new Set(["admin","contact","support","ifund","campaigns","help","developer","partner","crowdfund"]);
Deno.serve(async req => {
 if (req.method !== "POST") return answer({error:"Method not allowed"},405);
 const raw=await req.text();
 if(raw.length>65536) return answer({error:"Too large"},413);
 const stamp=req.headers.get("x-ifund-email-timestamp") || "";
 const signature=req.headers.get("x-ifund-email-signature") || "";
 if(!/^\d{10}$/.test(stamp)||!/^[a-f0-9]{128}$/i.test(signature)||Math.abs(Date.now()-Number(stamp)*1000)>300000) return answer({error:"Unauthorized"},401);
 try {
  const key=await crypto.subtle.importKey("spki",bytes(keyB64),{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
  const valid=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},key,hexBytes(signature),encoder.encode(stamp+"."+raw));
  if(!valid) return answer({error:"Unauthorized"},401);
  const data=JSON.parse(raw);
  const recipient=String(data.to||"").trim().toLowerCase();
  if(!/^[^\s@<>\u0000-\u001f]{1,64}@interplanetaryfund\.com$/.test(recipient)) return answer({error:"Bad recipient"},400);
  if(recipient.startsWith("verify-")) return answer({error:"Verification mailbox uses isolated handler"},422);
  const sender=String(data.from||"").slice(0,254),msgId=String(data.message_id||"").slice(0,254).replace(/[<>]/g,"");
  if(!sender || !msgId) return answer({error:"Missing metadata"},400);
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),url=Deno.env.get("SUPABASE_URL");
  if(!serviceKey||!url) return answer({error:"Mail intake unavailable"},503);
  const local=recipient.split("@")[0];
  const payload={recipient_address:recipient,sender_address:sender,message_id:msgId,subject:String(data.subject||"").slice(0,240),body_text:String(data.text||"").slice(0,12000),priority:priority.has(local)?"priority":"normal"};
  const response=await fetch(url+"/rest/v1/admin_inbound_email?on_conflict=recipient_address,message_id",{method:"POST",headers:{"apikey":serviceKey,"authorization":"Bearer "+serviceKey,"content-type":"application/json","prefer":"resolution=ignore-duplicates"},body:JSON.stringify(payload)});
  if(!response.ok) return answer({error:"Mail persistence unavailable"},503);
  return answer({ok:true});
 } catch (_) {return answer({error:"Mail intake rejected"},400);}
});