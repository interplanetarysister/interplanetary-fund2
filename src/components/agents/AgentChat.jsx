import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { recordAgentInteraction } from "@/lib/recordAgentInteraction";

async function safelyRecord(details) {
  try {
    await recordAgentInteraction(details);
  } catch (recordError) {
    console.warn("Agent interaction record failed", recordError);
  }
}

export default function AgentChat({ agentName, agentLabel, greeting }) {
  const convRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(true);
  const [sending, setSending] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [restart, setRestart] = useState(0);
  const [startError, setStartError] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    setStarting(true);
    setStartError(false);
    setWaitingForResponse(false);
    setMessages([]);
    convRef.current = null;
    (async () => {
      try {
        const conv = await base44.agents.createConversation({ agent_name: agentName, metadata: { name: agentLabel } });
        if (cancelled) return;
        convRef.current = conv;
        setMessages(conv.messages || []);
        void safelyRecord({ agentName, summary: `Conversation started with ${agentLabel}`, outcome: conv?.id ? `Conversation ${conv.id} created` : "Conversation created", approved: false });
        unsub = base44.agents.subscribeToConversation(conv.id, (data) => {
          if (cancelled) return;
          const next = data.messages || [];
          setMessages(next);
          const lastUserIndex = next.map((m) => m.role).lastIndexOf("user");
          const lastAssistantIndex = next.map((m) => m.role).lastIndexOf("assistant");
          if (lastAssistantIndex > lastUserIndex && next[lastAssistantIndex]?.content) setWaitingForResponse(false);
        });
      } catch (e) {
        console.error("Agent conversation start failed", e);
        setStartError(true);
        setMessages([{ role: "assistant", content: `Couldn't start a conversation with ${agentLabel}. Please try again.` }]);
      }
      if (!cancelled) setStarting(false);
    })();
    return () => { cancelled = true; unsub(); };
  }, [agentName, agentLabel, restart]);

  const send = async () => {
    const content = input.trim();
    if (!content || !convRef.current || sending) return;
    setInput("");
    setSending(true);
    setWaitingForResponse(true);
    try {
      await base44.agents.addMessage(convRef.current, { role: "user", content });
      void safelyRecord({ agentName, summary: content, outcome: "Message accepted; agent action not yet verified", approved: false });
    } catch (e) {
      console.error("Agent message send failed", e);
      setWaitingForResponse(false);
      setInput((current) => current || content);
      setMessages((m) => [...m, { role: "assistant", content: "I couldn't send that message. Please try again." }]);
    } finally { setSending(false); }
  };

  const lastMessage = [...messages].reverse().find((message) => message.role === "assistant");
  const calls = Array.isArray(lastMessage?.tool_calls) ? lastMessage.tool_calls : [];
  const needsInput = calls.some((call) => call.status === "waiting_for_user_input");
  const toolFailed = calls.some((call) => ["error", "stopped"].includes(call.status));
  const running = calls.some((call) => ["running", "pending"].includes(call.status));
  const workStatus = needsInput ? "The agent needs your input to continue." :
    toolFailed ? "An agent tool step failed; review its response before retrying." :
    waitingForResponse || running ? "IFund AI is working on your request…" :
    "External actions are complete only when verified by the provider or a successful tool result.";

  return <div className="flex flex-col h-[min(64dvh,36rem)] sm:h-[min(68dvh,40rem)]">
    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
      {starting ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div> : <>
        <div className="bg-muted text-foreground border border-border rounded-2xl p-3 text-sm">{greeting}</div>
        {messages.filter((m) => m.content).map((m, i) => <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
          <div className={m.role === "user" ? "bg-gradient-to-r from-cyan-400 to-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[85%] text-sm whitespace-pre-wrap" : "bg-card text-card-foreground border border-border rounded-2xl rounded-bl-sm px-4 py-2 max-w-[85%] text-sm"}>
            {m.role === "user" ? m.content : <ReactMarkdown className="text-sm space-y-2">{m.content}</ReactMarkdown>}
          </div>
        </div>)}
        {(sending || waitingForResponse || running) && <div className="flex justify-start"><div className="bg-card text-muted-foreground border border-border rounded-2xl px-4 py-2 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Working…</div></div>}
      </>}
    </div>
    <div className="mt-2 text-xs text-muted-foreground" role="status" aria-live="polite">{workStatus}</div>
    {startError && <Button type="button" size="sm" variant="outline" onClick={() => setRestart((n) => n + 1)}>Retry agent connection</Button>}
    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>Platform actions use your verified IFund connections.</span><Link to="/connections" className="font-semibold text-primary hover:underline shrink-0">Connect a platform</Link></div>
    <div className="mt-2 flex gap-2 items-end">
      <Textarea value={input} disabled={starting || !convRef.current} onChange={(e) => setInput(e.target.value)} placeholder={`Ask ${agentLabel}…`} rows={1} className="flex-1 resize-none rounded-xl min-h-[42px] max-h-28 py-2.5" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
      <Button size="icon" aria-label="Send message" onClick={send} disabled={sending || starting || !input.trim() || !convRef.current} className="rounded-xl h-11 w-11 shrink-0"><Send className="w-4 h-4" /></Button>
    </div>
  </div>;
}
