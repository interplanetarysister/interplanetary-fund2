import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, LockKeyhole, Send } from "lucide-react";
import { createAdminAgentSession, sendAdminAgentMessage } from "@/lib/adminAgentGateway";
import { getFrontendIdentity } from "@/lib/adminBootstrap";

const DEVELOPMENT_AGENTS = [
  ["chief_of_staff", "Chief of Staff"],
  ["builder_agent", "Builder"],
  ["admin_agent", "Admin"],
  ["review_agent", "Reviewer"],
  ["verification_agent", "Verification"],
  ["connection_discovery_agent", "Connection Discovery"],
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
    } catch (e) { console.error("Admin development session failed:", e?.name || "UnknownError"); setError("Admin development session could not be started."); } finally { setBusy(false); }
  };

  const send = async () => {
    const content = input.trim();
    if (!content || !sessionId || busy) return;
    setInput(""); setBusy(true); setError("");
    setMessages(m => [...m, { role: "user", content }]);
    try {
      const result = await sendAdminAgentMessage({ sessionId, content, agent });
      setMessages(m => [...m, { role: "assistant", content: result.response || "Request recorded." }]);
    } catch (e) { console.error("Admin development message failed:", e?.name || "UnknownError"); setError("The development-agent request could not be completed safely."); setInput(content); } finally { setBusy(false); }
  };

  if (!sessionId) return <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
    <div className="flex items-center gap-2 font-semibold"><LockKeyhole className="w-4 h-4" /> Super admin development access</div>
    <p className="text-sm text-muted-foreground">Enter the admin development key to connect Chief of Staff to the protected development-agent gateway.</p>
    <div className="flex gap-2"><Input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} placeholder="Admin key" /><Button onClick={unlock} disabled={!key || busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin"/> : "Unlock"}</Button></div>
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>;

  return <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
    <div className="flex flex-wrap gap-2">{DEVELOPMENT_AGENTS.map(([id,label])=><Button key={id} size="sm" variant={agent===id?"default":"outline"} onClick={()=>setAgent(id)}>{label}</Button>)}</div>
    <div className="max-h-72 overflow-y-auto space-y-2">{messages.map((m,i)=><div key={i} className={m.role==="user"?"text-right":"text-left"}><span className="inline-block max-w-[90%] rounded-xl border border-border px-3 py-2 text-sm whitespace-pre-wrap">{m.content}</span></div>)}</div>
    {error && <p className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2 items-end"><Textarea value={input} onChange={e=>setInput(e.target.value)} placeholder={`Message ${DEVELOPMENT_AGENTS.find(([id])=>id===agent)?.[1]}…`} rows={1} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}/><Button size="icon" onClick={send} disabled={busy||!input.trim()}>{busy?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>}</Button></div>
  </div>;
}
