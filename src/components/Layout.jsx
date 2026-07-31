import React, { useState } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";
import { LayoutDashboard, Compass, PlusCircle, HeartHandshake, MessageSquare, Sparkles, Users, Building2, BarChart3, Server, Menu, X, Bell, User, CreditCard, Wallet, Link2, MailOpen, Heart } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import BrandLogo from "@/components/brand/BrandLogo";
import { SLOGAN, SLOGAN_LONG } from "@/components/brand/brand";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/giving", label: "My Giving", icon: HeartHandshake },
  { to: "/communications", label: "Communications", icon: MessageSquare },
  { to: "/inbox", label: "Inbox", icon: MailOpen },
  { to: "/following", label: "Following", icon: Heart },
  { to: "/mission", label: "Mission Control", icon: Sparkles },
  { to: "/connections", label: "Connections", icon: Link2 },
  { to: "/community", label: "Community", icon: Users },
  { to: "/institutions", label: "Institutions", icon: Building2 },
  { to: "/analytics", label: "Command Center", icon: BarChart3 },
  { to: "/subscriptions", label: "Plans", icon: CreditCard },
  { to: "/withdrawals", label: "Withdrawals", icon: Wallet },
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
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col deep-space py-6 z-40">
        <div className="px-5 mb-8">
          <div className="flex items-start justify-between gap-2">
            <Link to="/profile" className="min-w-0" aria-label="Account settings">
              <BrandLogo size="sm" nameClassName="text-slate-100 text-[15px] leading-tight" />
            </Link>
            <NotificationBell />
          </div>
          <p className="mt-3 font-display text-lg brand-gradient-text">{SLOGAN}</p>
        </div>
        {nav}
        <p className="mt-auto px-6 text-[11px] leading-relaxed text-slate-500">{SLOGAN_LONG}</p>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between deep-space px-4 py-3">
        <Link to="/profile" className="min-w-0" aria-label="Account settings">
          <BrandLogo size="sm" nameClassName="text-slate-100 text-[15px] truncate" />
        </Link>
        <div className="flex items-center gap-1">
        <NotificationBell />
        <button onClick={() => setOpen(!open)} className="text-stone-300 p-2" aria-label="Toggle menu">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        </div>
      </header>
      {open && <div className="md:hidden fixed inset-x-0 top-14 z-40 deep-space pb-4 pt-2 shadow-xl">{nav}</div>}

      {/* Mobile bottom navigation — one-handed access to core surfaces */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 deep-space border-t border-white/10 flex">
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