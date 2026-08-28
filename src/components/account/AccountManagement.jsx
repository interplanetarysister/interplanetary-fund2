import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Trash2, Bell, Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Account management surface: global notification preferences (respected by
// the sendCommunication function), data export, and a durable deletion request.
export default function AccountManagement({ user, onUserChanged }) {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState(user?.comm_prefs || { email_updates: true, in_app_updates: true });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const savePref = async (key, value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSavingPrefs(true);
    try {
      await base44.auth.updateMe({ comm_prefs: next });
      onUserChanged?.({ ...user, comm_prefs: next });
      toast({ title: "Notification preference saved" });
    } catch (e) {
      toast({ title: "Couldn't save preference", description: "We couldn't save that preference. Please try again.", variant: "destructive" });
      setPrefs(prefs);
      console.error("Account preference save failed", e);
    }
    setSavingPrefs(false);
  };

  const downloadData = async () => {
    setExporting(true);
    try {
      const me = await base44.auth.me();
      const [campaigns, follows, notifications, connections, inbox, donations] = await Promise.all([
        base44.entities.Campaign.filter({ created_by_id: me.id }),
        base44.entities.FollowedCampaign.filter({ user_id: me.id }),
        base44.entities.Notification.filter({ user_id: me.id }, "-created_date", 200),
        base44.entities.PlatformConnection.filter({ created_by_id: me.id }, "-updated_date", 100),
        base44.entities.InboxItem.filter({ user_id: me.id }, "-created_date", 200),
        base44.entities.Donation.filter({ donor_user_id: me.id }, "-created_date", 200),
      ]);
      const safeConnections = connections.map((connection) => ({
        id: connection.id,
        platform: connection.platform,
        kind: connection.kind,
        display_name: connection.display_name,
        external_url: connection.external_url,
        campaign_id: connection.campaign_id,
        status: connection.status,
        automation_mode: connection.automation_mode,
        external_total: connection.external_total,
        external_donor_count: connection.external_donor_count,
        last_synced: connection.last_synced,
      }));
      const payload = { exported_at: new Date().toISOString(), profile: me, campaigns, followed_campaigns: follows, notifications, connections: safeConnections, inbox, donations };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-interplanetary-fund-data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Your data has been downloaded" });
    } catch (e) {
      toast({ title: "Couldn't export data", description: "We couldn't export your data. Please try again.", variant: "destructive" });
      console.error("Account data export failed", e);
    }
    setExporting(false);
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await base44.functions.invoke("deleteAccount", {});
      if (res.data?.error) throw new Error(res.data.error);
      const status = res.data?.status || "requested";
      toast({
        title: status === "processing" ? "Account deletion is already processing" : "Account deletion requested",
        description: "Your request has been recorded. We will complete the deletion workflow after the required retention and financial reconciliation steps.",
      });
      setDeleteOpen(false);
      setConfirmText("");
    } catch (e) {
      toast({ title: "Couldn't request account deletion", description: "We couldn't submit your account deletion request. Please try again.", variant: "destructive" });
      console.error("Account deletion request failed", e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-4"><Bell className="w-3.5 h-3.5" /> Notification preferences</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-sm font-medium text-stone-800">Email updates</p><p className="text-xs text-stone-500">Receive campaign updates and thank-you messages by email.</p></div>
            <Switch checked={prefs.email_updates !== false} onCheckedChange={(v) => savePref("email_updates", v)} disabled={savingPrefs} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-sm font-medium text-stone-800">In-app notifications</p><p className="text-xs text-stone-500">Receive alerts inside the Interplanetary Fund app.</p></div>
            <Switch checked={prefs.in_app_updates !== false} onCheckedChange={(v) => savePref("in_app_updates", v)} disabled={savingPrefs} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2"><Download className="w-3.5 h-3.5" /> Your data</p>
        <p className="text-sm text-stone-600 mb-4">Download a copy of your campaigns, donations, follows, and notifications.</p>
        <Button variant="outline" onClick={downloadData} disabled={exporting} className="rounded-xl">{exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Download my data</Button>
      </div>

      <div className="bg-white rounded-2xl border border-rose-200 p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-500 mb-2"><ShieldAlert className="w-3.5 h-3.5" /> Danger zone</p>
        <p className="text-sm text-stone-600 mb-4">Request permanent account deletion. The request is processed through required retention, financial, provider, and ownership-reconciliation steps before any destructive action.</p>
        <Button variant="outline" onClick={() => setDeleteOpen(true)} className="rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50"><Trash2 className="w-4 h-4 mr-2" /> Request account deletion</Button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) setConfirmText(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Request account deletion?</DialogTitle>
            <DialogDescription>
              This starts the account-deletion workflow. Your financial records, provider credentials, campaign ownership, and required retention obligations must be reconciled before any destructive or anonymizing step. Type <span className="font-semibold text-stone-800">DELETE</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2"><Label htmlFor="confirm">Type DELETE to confirm</Label><Input id="confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" className="rounded-xl" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="rounded-xl" disabled={deleting}>Cancel</Button>
            <Button onClick={deleteAccount} disabled={deleting || confirmText !== "DELETE"} className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white">{deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}Request deletion</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
