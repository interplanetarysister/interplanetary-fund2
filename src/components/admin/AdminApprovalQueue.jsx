import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Check, X, Loader2, ShieldCheck } from "lucide-react";

export default function AdminApprovalQueue() {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = async () => setItems(await base44.entities.AdminApproval.filter({ status: "pending" }, "-requested_at", 200));
  useEffect(() => { load(); }, []);

  const resolve = async (item, status) => {
    setBusy(item.id);
    try {
      const me = await base44.auth.me();
      await base44.entities.AdminApproval.update(item.id, {
        status,
        resolved_at: new Date().toISOString(),
        resolved_by_user_id: me.id,
      });
      await load();
    } finally { setBusy(null); }
  };

  if (!items) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  return <div className="space-y-3">
    <div className="flex items-center gap-2 text-sm text-stone-600"><ShieldCheck className="w-4 h-4" />{items.length} automation action{items.length === 1 ? "" : "s"} awaiting admin decision.</div>
    {items.map((item) => <div key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-stone-900">{item.title}</p>
          <p className="text-sm text-stone-600 mt-1">{item.description}</p>
          {item.payload_summary && <p className="text-xs text-stone-500 mt-1">{item.payload_summary}</p>}
          <p className="text-xs text-stone-400 mt-2">{item.requested_by_agent || "Platform automation"} · {item.action_type} · {item.risk_level || "medium"} risk</p>
        </div>
        <div className="flex gap-2">
          <button disabled={busy === item.id} onClick={() => resolve(item, "approved")} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 text-white px-3 min-h-[44px] text-sm"><Check className="w-4 h-4"/>Approve</button>
          <button disabled={busy === item.id} onClick={() => resolve(item, "denied")} className="inline-flex items-center gap-1 rounded-xl bg-rose-600 text-white px-3 min-h-[44px] text-sm"><X className="w-4 h-4"/>Deny</button>
        </div>
      </div>
    </div>)}
    {!items.length && <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-stone-400">No automation approvals are waiting.</div>}
  </div>;
}
