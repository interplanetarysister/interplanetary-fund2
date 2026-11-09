import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

// One connect-accounts row: method badge, status chip, action and one helper
// line. A control that cannot work is disabled with its reason on screen.
export default function ConnectAccountRow({ row, onChoose, onNotice }) {
  const { platform, name, badge, chip, copy, readiness, checking, connection } = row;
  const [proAcknowledged, setProAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);

  const helper = copy?.helper || readiness?.disabled_reason ||
    (checking ? "Checking the available connection method…" : "No connection method is available for this platform yet.");

  const connectGoFundMePro = async () => {
    const vaultRef = String(connection?.credentials?.vault_ref || "");
    if (!vaultRef) {
      onNotice({ ok: false, text: "Save your GoFundMe Pro client credentials for this account first, then try again." });
      return;
    }
    setBusy(true);
    try {
      const { data } = await base44.functions.invoke("verifyGoFundMeProConnection", { vault_ref: vaultRef });
      onNotice(data?.ok
        ? { ok: true, text: `GoFundMe Pro verified${data?.organization_name ? ` for ${data.organization_name}` : ""}.` }
        : { ok: false, text: data?.reason || "GoFundMe Pro verification did not complete." });
    } catch {
      onNotice({ ok: false, text: "GoFundMe Pro verification could not be completed." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid={`conn-row-${platform}`}
      className="rounded-2xl border bg-card p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{name}</span>
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {badge}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${chip.className}`}>{chip.text}</span>

        {copy?.label && (
          <Button type="button" size="sm" onClick={() => onChoose(platform)}>{copy.label}</Button>
        )}

        {copy?.secondary && (
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={proAcknowledged}
                onChange={(event) => setProAcknowledged(event.target.checked)}
              />
              {copy.secondary.confirm}
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!proAcknowledged || busy}
              onClick={connectGoFundMePro}
              title={copy.secondary.helper}
            >
              {copy.secondary.label}
            </Button>
            <span className="text-xs text-muted-foreground sm:text-right">{copy.secondary.helper}</span>
          </div>
        )}

        {!copy?.label && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled
            title={readiness?.disabled_reason || undefined}
          >
            {readiness?.button_label || `Connect ${name}`}
          </Button>
        )}
      </div>
    </div>
  );
}