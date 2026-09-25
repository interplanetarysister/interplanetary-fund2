import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { STATUS_BADGE, AUTH_TYPE_LABEL, ENV_LABEL } from "@/lib/integrationRegistryUi";
import { Loader2, RefreshCw, ShieldOff, ShieldCheck, GitFork } from "lucide-react";

const SAFE_INTEGRATION_ERROR = "The integration action could not be completed. Please retry or contact an administrator.";

function Row({ label, children }) {
  return (
    <div className="flex gap-3 py-2 border-b border-stone-100 last:border-0">
      <span className="text-xs uppercase tracking-wide text-stone-400 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-stone-700 flex-1 break-words">{children}</span>
    </div>
  );
}

export default function IntegrationDetailPanel({ entry, onClose, onUpdated }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);
  if (!entry) return null;
  const badge = STATUS_BADGE[entry.status] || STATUS_BADGE.ACTIVE;

  const run = async (action, payload = {}) => {
    setBusy(action);
    try {
      await base44.functions.invoke("managePlatformAccess", { action, platform: entry.platform, ...payload });
      toast({ title: "Updated", description: `${entry.platform}: ${action}` });
      onUpdated?.();
    } catch {
      toast({ title: "Couldn't update", description: SAFE_INTEGRATION_ERROR, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const syncGitHub = async (direction) => {
    setBusy(`github-sync-${direction}`);
    try {
      const res = await base44.functions.invoke("syncGitHub", { direction });
      const data = res?.data || res;
      if (data?.ok) {
        const details = Object.entries(data.results || {})
          .map(([k, v]) => `${k}: ${v.detail}`)
          .join(" · ");
        toast({ title: "GitHub status verified", description: details || "GitHub connection verified." });
      } else {
        const reason =
          data?.reason ||
          Object.values(data?.results || {}).find((r) => !r.ok)?.detail ||
          "GitHub connection verification failed.";
        toast({ title: "GitHub verification issue", description: reason, variant: "destructive" });
      }
    } catch {
      toast({ title: "GitHub verification failed", description: SAFE_INTEGRATION_ERROR, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={!!entry} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {entry.platform}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
          </DialogTitle>
          <DialogDescription>{entry.purpose}</DialogDescription>
        </DialogHeader>

        <div className="px-1">
          <Row label="Kind">{entry.integration_kind}</Row>
          <Row label="Account">{entry.account_identifier || "—"}</Row>
          <Row label="Auth type">{AUTH_TYPE_LABEL[entry.auth_type] || entry.auth_type}</Row>
          <Row label="Secret refs">{(entry.secret_refs || []).length ? entry.secret_refs.join(", ") : <span className="text-stone-400">none / platform-managed</span>}</Row>
          <Row label="Environment">{ENV_LABEL[entry.environment] || entry.environment}</Row>
          <Row label="Authorized agents">{(entry.authorized_agents || []).length ? entry.authorized_agents.join(", ") : <span className="text-stone-400">service-role only</span>}</Row>
          <Row label="Dependencies">{(entry.dependencies || []).join(", ") || "—"}</Row>
          <Row label="Admin owner">{entry.admin_owner || "unassigned"}</Row>
          <Row label="Last verified">{entry.last_verified ? new Date(entry.last_verified).toLocaleString() : "never"}</Row>
          <Row label="Last success">{entry.last_successful_verification ? new Date(entry.last_successful_verification).toLocaleString() : "—"}</Row>
          {entry.last_failure ? <Row label="Last failure"><span className="text-red-600">{entry.last_failure}</span></Row> : null}
          {(entry.cleanup_flags || []).length ? <Row label="Flags">{entry.cleanup_flags.join(", ")}</Row> : null}
          {entry.reauth_instructions ? <Row label="Reauth steps">{entry.reauth_instructions}</Row> : null}
        </div>

        {/* GitHub source-connection controls. Actual source application is handled by Base44’s native GitHub sync, not by deployed app code. */}
        {entry.platform === "github" && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 mt-1">
            <p className="text-xs font-medium text-blue-700 mb-2">GitHub source connection</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncGitHub("pull")}
                disabled={!!busy}
                className="rounded-lg border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                {busy === "github-sync-pull" ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <GitFork className="w-3.5 h-3.5 mr-1.5" />
                )}
                Verify GitHub source status
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncGitHub("push")}
                disabled={!!busy}
                className="rounded-lg border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                {busy === "github-sync-push" ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <GitFork className="w-3.5 h-3.5 mr-1.5 rotate-180" />
                )}
                Verify GitHub destination status
              </Button>
              <Button
                size="sm"
                onClick={() => syncGitHub("both")}
                disabled={!!busy}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                {busy === "github-sync-both" ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                Verify GitHub connection
              </Button>
            </div>
            <p className="text-xs text-blue-500 mt-2">
              These authenticated admin checks confirm connected GitHub access and the current remote HEAD.
              They do not move files, create commits, or replace Base44’s native source synchronization.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => run("reauthorize")} disabled={!!busy} className="rounded-lg">
            {busy === "reauthorize" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}Mark reauthorized
          </Button>
          <Button size="sm" variant="outline" onClick={() => run("revoke")} disabled={!!busy} className="rounded-lg text-red-600 hover:text-red-700">
            {busy === "revoke" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5 mr-1.5" />}Revoke access
          </Button>
          {entry.status === "REVOKED" && (
            <Button size="sm" onClick={() => run("reauthorize")} disabled={!!busy} className="rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />Restore
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
