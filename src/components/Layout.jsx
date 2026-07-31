import React, { useState } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";
import { Flame, LayoutDashboard, Compass, PlusCircle, HeartHandshake, MessageSquare, Sparkles, Users, Menu, X } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/giving", label: "My Giving", icon: HeartHandshake },
  { to: "/communications", label: "Communications", icon: MessageSquare },
  { to: "/mission", label: "Mission Control", icon: Sparkles },
  { to: "/community", label: "Community", icon: Users },
  { to: "/create", label: "New Campaign", icon: PlusCircle },
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
              isActive ? "bg-orange-600/15 text-orange-400" : "text-stone-400 hover:text-stone-100 hover:bg-white/5"
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
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-[#171310] py-6 z-40">
        <div className="flex items-center justify-between px-6 mb-10">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" strokeWidth={2} />
            </span>
            <span className="font-display text-xl text-stone-100 tracking-tight">FundForge</span>
          </Link>
          <NotificationBell />
        </div>
        {nav}
        <p className="mt-auto px-6 text-[11px] text-stone-600">AI-powered fundraising OS</p>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between bg-[#171310] px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <Flame className="w-4 h-4 text-white" />
          </span>
          <span className="font-display text-lg text-stone-100">FundForge</span>
        </Link>
        <div className="flex items-center gap-1">
        <NotificationBell />
        <button onClick={() => setOpen(!open)} className="text-stone-300 p-2" aria-label="Toggle menu">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        </div>
      </header>
      {open && <div className="md:hidden fixed inset-x-0 top-14 z-40 bg-[#171310] pb-4 pt-2 shadow-xl">{nav}</div>}

      <main className="md:pl-60">
        <Outlet />
      </main>
    </div>
  );
}