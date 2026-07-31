import React, { useState } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";
import { Droplet, LayoutDashboard, Compass, PlusCircle, HeartHandshake, MessageSquare, Sparkles, Users, Building2, BarChart3, Server, Menu, X, Bell, User, CreditCard } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/giving", label: "My Giving", icon: HeartHandshake },
  { to: "/communications", label: "Communications", icon: MessageSquare },
  { to: "/mission", label: "Mission Control", icon: Sparkles },
  { to: "/community", label: "Community", icon: Users },
  { to: "/institutions", label: "Institutions", icon: Building2 },
  { to: "/analytics", label: "Command Center", icon: BarChart3 },
  { to: "/subscriptions", label: "Plans", icon: CreditCard },
  { to: "/platform", label: "Platform", icon: Server },
  { to: "/create", label: "New Campaign", icon: PlusCircle },
];

// One-handed mobile navigation. AI Assistant surfaces Mission Control — the
// platform's central intelligence hub — under its most user-friendly label.
const bottomNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/discover", label: "Campaigns", icon: Compass },
  { to: "/mission", label: "AI Assistant", icon: Sparkles },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

export default function Layout() {
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
          `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
            isActive ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
          }`
          }
        >
          <Icon className="w-4 h-4" strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-slate-950 py-6 z-40">
        <div className="flex items-center justify-between px-6 mb-10">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
              <Droplet className="w-5 h-5 text-white" strokeWidth={2} />
            </span>
            <span className="font-display text-xl text-slate-100 tracking-tight">Crowdfund</span>
          </Link>
          <NotificationBell />
        </div>
        {nav}
        <p className="mt-auto px-6 text-[11px] text-slate-500">AI-powered fundraising OS</p>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between bg-slate-950 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Droplet className="w-4 h-4 text-white" />
          </span>
          <span className="font-display text-lg text-slate-100">Crowdfund</span>
        </Link>
        <div className="flex items-center gap-1">
        <NotificationBell />
        <button onClick={() => setOpen(!open)} className="text-stone-300 p-2" aria-label="Toggle menu">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        </div>
      </header>
      {open && <div className="md:hidden fixed inset-x-0 top-14 z-40 bg-slate-950 pb-4 pt-2 shadow-xl">{nav}</div>}

      {/* Mobile bottom navigation — one-handed access to core surfaces */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-slate-950 border-t border-white/10 flex">
        {bottomNavItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                isActive ? "text-cyan-400" : "text-slate-400"
              }`
            }
          >
            <Icon className="w-5 h-5" strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>

      <main className="md:pl-60 pb-16 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}