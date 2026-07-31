import React from "react";
import { Sparkles, Compass, Zap, LifeBuoy } from "lucide-react";

export default function WelcomeStep() {
  const pillars = [
    { icon: Compass, title: "Unify", text: "Bring every fundraising effort into one dashboard." },
    { icon: Sparkles, title: "Understand", text: "AI explains what's working and what to do next." },
    { icon: Zap, title: "Automate", text: "Publish and update across platforms in one move." },
    { icon: LifeBuoy, title: "Support", text: "Mission Control watches your campaigns around the clock." },
  ];
  return (
    <div className="text-center max-w-xl mx-auto">
      <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 mb-5">
        <Sparkles className="w-7 h-7 text-white" />
      </span>
      <h2 className="font-display text-2xl sm:text-3xl text-slate-900 mb-3">Welcome to Crowdfund</h2>
      <p className="text-slate-600 mb-8">
        Crowdfund isn't another crowdfunding website. It's an intelligent fundraising operating system —
        unifying fundraising, automation, and AI assistance into one seamless experience.
      </p>
      <div className="grid grid-cols-2 gap-3 text-left">
        {pillars.map(({ icon: Icon, title, text }) => (
          <div key={title} className="bg-white rounded-xl border border-stone-200 p-4">
            <Icon className="w-5 h-5 text-primary mb-2" />
            <p className="font-medium text-stone-800 text-sm">{title}</p>
            <p className="text-xs text-stone-500">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}