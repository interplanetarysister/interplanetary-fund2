import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { recordAgentInteraction } from "@/lib/recordAgentInteraction";

// Conversation UI for an in-app AI agent. Starts a new conversation when the
// agent changes, streams assistant replies via the agents SDK subscription,
// and persists a best-effort interaction summary to the authoritative agent runtime.
export default function AgentChat({ agentName, agentLabel, greeting }) {
  const convRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    setStarting(true);
    setMessages([]);
    convRef.current = null;
    (async () => {
      try {
        const conv = await base44.agents.createConversation({
          agent_name: agentName,
          metadata: { name: agentLabel },
        });
        if (cancelled) return;
        convRef.current = conv;
        setMessages(conv.messages || []);
        unsub = base44.agents.subscribeToConversation(conv.id, (data) => {
          setMessages(data.messages || []);
        });
      } catch (e) {
        console.error("Agent conversation start failed", e);
        setMessages([{ role: "assistant", content: `Couldn't start a conversation with ${agentLabel}. Please try again.` }]);
      }
      if (!cancelled) setStarting(false);
    })();
    return () => { cancelled = true; unsub(); };
  }, [agentName, agentLabel]);

  const send = async () => {
    const content = input.trim();
    if (!content || !convRef.current || sending) return;
    setInput("");
    setSending(true);
    try {
      await base44.agents.addMessage(convRef.current, { role: "user", content });
      await recordAgentInteraction({
        agentName,
        summary: content,
        outcome: "conversation",
      });
    } catch (e) {
      console.error("Agent message send failed", e);
      setMessages((m) => [...m, { role: "assistant", content: "I couldn't send that message. Please try again." }]);
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-[68vh]">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {starting ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="bg-muted text-muted-foreground border border-border rounded-2xl p-3 text-sm">{greeting}</div>
            {messages.filter((m) => m.content).map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={
                  m.role === "user"
                    ? "bg-gradient-to-r from-cyan-400 to-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[85%] text-sm whitespace-pre-wrap"
                    : "bg-card text-card-foreground border border-border rounded-2xl rounded-bl-sm px-4 py-2 max-w-[85%] text-sm"
                }>
                  {m.role === "user"
                    ? m.content
                    : <ReactMarkdown className="text-sm space-y-2">{m.content}</ReactMarkdown>}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-card text-muted-foreground border border-border rounded-2xl px-4 py-2 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> thinking…
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <div className="mt-3 flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask ${agentLabel}…`}
          rows={1}
          className="flex-1 resize-none rounded-xl"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <Button onClick={send} disabled={sending || !input.trim()} className="rounded-xl"><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}