import React from "react";
import { Switch } from "@/components/ui/switch";
import { Link2, Send, UserPlus, Wrench } from "lucide-react";

const CAPABILITIES = [
  { icon: Link2, title: "Connect your fundraising pages", description: "Tap Connect and IFund can do the connection steps for you." },
  { icon: UserPlus, title: "Create an account for you", description: "Tap Create account and IFund can fill in the allowed setup steps using the information you gave us." },
  { icon: Send, title: "Share with one tap", description: "Tap Publish and IFund can send your update to the connected accounts that can receive it." },
  { icon: Wrench, title: "Keep connections working", description: "IFund can use the working connection steps it has learned when a connected service needs attention." },
];

export default function AutomateStep({ data, onChange }) {
  const enabled = !!data.delegated_operations_enabled;
  const setEnabled = (value) => onChange({
    ...data,
    delegated_operations_enabled: value,
    automation: value ? { delegated_operations: true } : {},
  });

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="font-display text-2xl text-stone-900 mb-2">Would you like IFund to do these steps for you?</h2>
      <p className="text-stone-600 mb-5">
        You only choose this once. You can change it anytime. When it is on, your taps tell IFund what to do. When it is off, you do the steps and posting yourself.
      </p>
      <div className="flex items-start justify-between gap-4 bg-white rounded-xl border border-stone-200 p-4 mb-5">
        <div>
          <p className="font-medium text-stone-900">Let IFund help me do things</p>
          <p className="text-xs text-stone-500 mt-1">{enabled ? "On — your Connect, Create account, and Publish taps can tell IFund to do the covered steps." : "Off — IFund will not do these steps for you."}</p>
        </div>
        <Switch aria-label="Let IFund help me do things" checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <div className="space-y-3">
        {CAPABILITIES.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex gap-3 bg-white rounded-xl border border-stone-200 p-4">
            <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div><p className="font-medium text-stone-800 text-sm">{title}</p><p className="text-xs text-stone-500 mt-0.5">{description}</p></div>
          </div>
        ))}
      </div>
      <p className="text-xs text-stone-500 mt-5">Some outside websites may still ask you to sign in or confirm something on their own page. IFund will not keep asking you for this same IFund permission.</p>
    </div>
  );
}
