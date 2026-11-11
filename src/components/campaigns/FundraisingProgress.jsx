import React from "react";

const MILESTONES = [25, 50, 100];

// Real-time progress against the goal, with visible 25%, 50% and 100% markers.
export default function FundraisingProgress({ raised = 0, goal = 0 }) {
  const safeGoal = Number(goal) > 0 ? Number(goal) : 0;
  const pct = safeGoal > 0 ? Math.min(100, Math.max(0, (Number(raised) || 0) / safeGoal * 100)) : 0;
  return (
    <div>
      <div className="relative">
        <div className="h-3 w-full overflow-hidden rounded-full bg-stone-200/90" role="progressbar"
             aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
             aria-label={`${Math.round(pct)} percent of the fundraising goal raised`}>
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 transition-all duration-700 ease-out"
               style={{ width: `${pct}%` }} />
        </div>
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {MILESTONES.map((mark) => (
            <span key={mark}
                  className={`absolute top-0 h-3 w-0.5 rounded-full ${pct >= mark ? "bg-white/80" : "bg-stone-400/60"}`}
                  style={{ left: `${mark}%` }} />
          ))}
        </div>
      </div>
      <div className="relative mt-1.5 h-5 text-[11px] font-semibold">
        {MILESTONES.map((mark) => (
          <span key={mark}
                className={`absolute top-0 whitespace-nowrap ${pct >= mark ? "text-primary" : "text-stone-400"}`}
                style={{ left: `${mark}%`, transform: mark === 100 ? "translateX(-100%)" : "translateX(-50%)" }}>
            {pct >= mark ? "✓" : "○"} {mark}%
          </span>
        ))}
      </div>
    </div>
  );
}