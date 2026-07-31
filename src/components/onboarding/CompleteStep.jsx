import React from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";

export default function CompleteStep({ data }) {
  const summary = [
    data.goal && "Personalized AI profile",
    (data.platforms || []).length > 0 && `${(data.platforms || []).length} platform${(data.platforms || []).length > 1 ? "s" : ""} selected`,
    data.automation && "Automation preferences set",
  ].filter(Boolean);

  return (
    <div className="text-center max-w-md mx-auto">
      <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 mb-5">
        <Sparkles className="w-7 h-7 text-white" />
      </span>
      <h2 className="font-display text-2xl sm:text-3xl text-stone-900 mb-3">You're ready to fundraise smarter</h2>
      <p className="text-stone-600 mb-6">
        Crowdfund is now configured as your intelligent fundraising operating system. Mission Control is
        standing by to run your first analysis.
      </p>
      <div className="inline-flex flex-col gap-2 mb-2">
        {summary.map((s) => (
          <div key={s} className="flex items-center gap-2 text-sm text-stone-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}