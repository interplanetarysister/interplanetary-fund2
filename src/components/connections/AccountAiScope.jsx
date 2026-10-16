import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck } from "lucide-react";

const CAPABILITY_GROUPS = [
  ["Campaigns and posts", "Create, update, share and manage campaign posts, updates, images, videos and approved publicity."],
  ["Community interactions", "Comment and reply, handle relevant messages and direct-message responses, pages, groups, memberships, invitations and supported interactions."],
  ["Events and streams", "Set up and manage events, livestreams, videos and auctions when the connected service offers those functions."],
  ["Fundraising information", "Read donation information, import or reconcile campaign records, and prepare migration steps where supported."],
  ["Maintenance and insights", "Maintain connections, review engagement and analytics, identify account issues and prepare corrections."]
];
export const ACCOUNT_AI_SCOPE_VERSION = "2026-10-16-account-obo-v1";
export default function AccountAiScope({ platform, checked, onChange, existing = false }) {
  return <section className="rounded-2xl border-2 border-cyan-300 bg-card p-4 space-y-3" aria-label="AI account permissions">
    <h3 className="text-base font-bold flex gap-2 items-center"><ShieldCheck className="w-5 h-5 text-cyan-600" /> AI permissions for {platform.name}</h3>
    <p className="text-sm text-muted-foreground">You decide whether IFund AI can act on this specific account. This is separate from signing in or saving passwords.</p>
    <div className="rounded-xl border border-border p-3 space-y-2">
      <div className="flex items-start gap-3">
        <Checkbox id={"connection-ai-" + platform.id} checked={checked} onCheckedChange={value => onChange(value === true)} className="mt-1 shrink-0" />
        <label htmlFor={"connection-ai-" + platform.id} className="text-base font-semibold leading-relaxed cursor-pointer">Allow IFund AI to help connect and use all supported nonfinancial account functions on {platform.name}</label>
      </div>
      <p className="text-sm text-muted-foreground">When checked, IFund may perform approved categories of actions below on your behalf, but only with capabilities actually granted by the platform and supported by IFund. Some activities can still require your approval.</p>
    </div>
    <details className="rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-sm font-bold">See all requested AI activity categories</summary>
      <ul className="mt-3 space-y-3">
        {CAPABILITY_GROUPS.map(([heading, description]) => <li key={heading} className="text-sm"><strong>{heading}:</strong> {description}</li>)}
      </ul>
      <p className="text-sm font-semibold mt-3">Not included: withdrawals, moving or transferring donations or funds, spending, purchases, financial payouts, or bypassing provider security. Financial migrations require separate approval for each monetary action.</p>
    </details>
    <p className="text-sm text-muted-foreground">{existing ? "Unchecking and saving turns off AI permission for this account. You can also turn it off later." : "Unchecked by default. You can connect an account without allowing AI actions."} Provider permissions can be independently withdrawn in provider account settings.</p>
  </section>;
}
