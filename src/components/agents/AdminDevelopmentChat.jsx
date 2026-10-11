import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, LockKeyhole, Send } from "lucide-react";
import { createAdminAgentSession, sendAdminAgentMessage, adminGatewayMode } from "@/lib/adminAgentGateway";
import { getFrontendIdentity } from "@/lib/adminBootstrap";

const adminErrorMessage = (error) => {
  const message = String(error?.message || "");
  if (/key rejected/i.test(message)) return "The admin development key was rejected. Check it and try again.";
  if (/forbidden|unauthorized|super.admin|administrator authorization/i.test(message))
    return "This signed-in account is not verified as a super-admin. Sign in with an authorized owner account.";
  if (/not configured|failed to fetch|network|unreachable/i.test(message))
    return "The admin gateway is unavailable on this host. Its server configuration needs repair.";
  return "Admin access could not be verified. Refresh your sign-in and try again.";
};

const DEVELOPMENT_AGENTS = [
  ["chief_of_staff", "Chief of Staff"],
  ["connection_discovery_agent", "Connection Discovery"],
  ["managed_connection_agent", "Managed Connections"],
  ["outreach_agent", "Outreach"],
];

export default function AdminDevelopmentChat({ user }) {
  const [key, setKey] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [agent, setAgent] = useState("chief_of_staff");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!getFrontendIdentity(user).superAdminOwner) return null;

  const unlock = async () => {
    setBusy(true); setError("");
    try {
      const result = await createAdminAgentSession({ adminKey: key, agent: "chief_of_staff" });
      setSessionId(result.sessionId);
      setKey("");
    } catch (e) { console.error("Admin development session failed:", e?.name || "UnknownError"); setError(adminErrorMessage(e)); } finally { setBusy(false); }
  };

  const send = async () => {
    const content = input.trim();
    if (!content || !sessionId || busy) return;
    setInput(""); setBusy(true); setError("");
    setMessages(m => [...m, { role: "user", content }]);
    try {
      const result = await sendAdminAgentMessage({ sessionId, content, agent });
      setMessages(m => [...m, { role: "assistant", content: result.response || "Request recorded." }]);
    } catch (e) { console.error("Admin development message failed:", e?.name || "UnknownError"); setError(adminErrorMessage(e)); setInput(content); } finally { setBusy(false); }
  };

  if (!sessionId) return <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
    <div className="flex items-center gap-2 font-semibold"><LockKeyhole className="w-4 h-4" /> Super admin development access</div>
    <p className="text-sm text-muted-foreground">{adminGatewayMode === "external"
      ? "Enter your admin development key to use the protected gateway."
      : "Use your current verified super-admin login. IFund will check your permissions securely on its Base44 backend."}</p>
    <div className="flex flex-wrap gap-2">
      {adminGatewayMode === "external" && <Input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} placeholder="Admin key" className="min-w-0 flex-1" />}
      <Button type="button" className="min-h-11" onClick={unlock} disabled={(adminGatewayMode === "external" && !key) || busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin"/> : adminGatewayMode === "external" ? "Unlock" : "Verify admin access"}</Button>
    </div>
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>;

  return <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
    <div className="flex flex-wrap gap-2">{DEVELOPMENT_AGENTS.map(([id,label])=><Button key={id} size="sm" variant={agent===id?"default":"outline"} onClick={()=>setAgent(id)}>{label}</Button>)}</div>
    <div className="max-h-[40dvh] min-h-12 overflow-y-auto overscroll-contain touch-pan-y space-y-2">{messages.map((m,i)=><div key={i} className={m.role==="user"?"text-right":"text-left"}><span className="inline-block max-w-[90%] rounded-xl border border-border px-3 py-2 text-sm whitespace-pre-wrap">{m.content}</span></div>)}</div>
    {error && <p className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2 items-end"><Textarea value={input} onChange={e=>setInput(e.target.value)} placeholder={`Message ${DEVELOPMENT_AGENTS.find(([id])=>id===agent)?.[1]}…`} rows={1} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}/><Button size="icon" onClick={send} disabled={busy||!input.trim()}>{busy?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>}</Button></div>
  </div>;
}
