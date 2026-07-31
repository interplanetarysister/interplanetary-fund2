import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { applicationStatuses } from "./institutionTypes";
import { format } from "date-fns";

export default function ApplicationsTab({ institution }) {
  const [apps, setApps] = useState(null);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    base44.entities.GrantApplication.filter({ institution_id: institution.id }, "-created_date").then(setApps);
  }, [institution.id]);

  if (!apps) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const decide = async (app, status) => {
    setBusy(app.id);
    const decision_note = notes[app.id] || "";
    await base44.entities.GrantApplication.update(app.id, { status, decision_note });
    if (app.applicant_user_id) {
      await base44.entities.Notification.create({
        user_id: app.applicant_user_id,
        title: status === "awarded" ? "Your application was awarded" : `Application ${applicationStatuses[status].label.toLowerCase()}`,
        body: `${institution.name} updated your application for "${app.opportunity_title}"${decision_note ? `: ${decision_note}` : ""}`,
        type: "system",
        link: "/institutions",
      });
    }
    setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status, decision_note } : a)));
    setBusy(null);
  };

  if (apps.length === 0) {
    return <p className="text-sm text-stone-400 text-center py-10">No applications received yet.</p>;
  }

  return (
    <div className="space-y-4">
      {apps.map((a) => {
        const s = applicationStatuses[a.status] || applicationStatuses.submitted;
        const pending = ["submitted", "under_review"].includes(a.status);
        return (
          <div key={a.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-stone-900">{a.campaign_title}</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {a.applicant_name} · {a.opportunity_title} · {format(new Date(a.created_date), "MMM d, yyyy")}
                </p>
              </div>
              <Badge className={`shrink-0 ${s.className}`}>{s.label}</Badge>
            </div>
            {a.requested_amount ? <p className="text-sm text-stone-700 mt-2 font-medium">Requested: ${a.requested_amount.toLocaleString()}</p> : null}
            {a.narrative && <p className="text-sm text-stone-600 mt-2 whitespace-pre-line">{a.narrative}</p>}
            {a.decision_note && <p className="text-xs text-stone-500 mt-2"><span className="font-semibold">Decision note:</span> {a.decision_note}</p>}
            {pending && (
              <div className="mt-4 space-y-2">
                <Input value={notes[a.id] || ""} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} placeholder="Decision note (optional)" />
                <div className="flex flex-wrap gap-2">
                  {a.status === "submitted" && (
                    <Button size="sm" variant="outline" onClick={() => decide(a, "under_review")} disabled={busy === a.id} className="rounded-lg">
                      Mark under review
                    </Button>
                  )}
                  <Button size="sm" onClick={() => decide(a, "awarded")} disabled={busy === a.id} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg">
                    {busy === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Award"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide(a, "declined")} disabled={busy === a.id} className="rounded-lg text-red-600 hover:text-red-600">
                    Decline
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}