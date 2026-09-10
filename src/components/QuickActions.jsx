import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Megaphone, HeartHandshake, Bell, Compass, User, X } from "lucide-react";

// Restored from the earlier Base44 application and aligned to fund2's current
// routes. This component is navigation-only: it performs no privileged reads
// or writes and does not depend on legacy Convex/Vercel infrastructure.
const actions = [
  { to: "/create", label: "New Campaign", icon: Megaphone },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/giving", label: "My Giving", icon: HeartHandshake },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "My Profile", icon: User },
];

export default function QuickActions() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-24 md:bottom-6 left-4 md:left-auto md:right-6 z-30 flex flex-col items-start md:items-end gap-2">
      {open && (
        <div className="flex flex-col items-start md:items-end gap-2 mb-1">
          {actions.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} onClick={() => setOpen(false)} className="flex items-center gap-2 md:flex-row-reverse">
              <span className="text-xs font-medium text-slate-100 deep-space border border-white/10 rounded-lg px-2.5 py-1.5 shadow-md whitespace-nowrap">
                {label}
              </span>
              <span className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-slate-100 shadow-md backdrop-blur">
                <Icon className="w-4 h-4" />
              </span>
            </Link>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-12 h-12 rounded-full bg-cyan-400 text-slate-950 shadow-lg flex items-center justify-center hover:bg-cyan-300 transition-colors"
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        aria-expanded={open}
      >
        {open ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
      </button>
    </div>
  );
}
