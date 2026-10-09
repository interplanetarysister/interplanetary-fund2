import React, { useState, useEffect } from "react";
import { Outlet, NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Compass, PlusCircle, HeartHandshake, MessageSquare, Sparkles, Users, Building2, BarChart3, Server, Menu, X, User, CreditCard, Wallet, Link2, MailOpen, Heart, ChevronLeft, Globe2, Bot, Satellite, Plug, Radio, BookOpen, House, CircleHelp } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import BrandLogo from "@/components/brand/BrandLogo";
import { SLOGAN, SLOGAN_LONG } from "@/components/brand/brand";
import useSwipeBack from "@/hooks/useSwipeBack";
import { AnimatePresence, motion } from "framer-motion";
import OfflineBanner from "@/components/mobile/OfflineBanner";
import { hapticTap } from "@/lib/haptics";
import LegalFooter from "@/components/LegalFooter";
import ErrorBoundary from "@/components/ErrorBoundary";
import BackToTop from "@/components/BackToTop";
import QuickActions from "@/components/QuickActions";
import { useAuth } from "@/lib/AuthContext";
import { owningNavigationTab, navigationBackFallback, canReturnWithinApp } from "@/lib/navigation";
import { hasPlanLevel } from "@/lib/subscriptionEntitlements";
import { LifeBuoy, ArrowUpRight } from "lucide-react";

const PAGE_TITLES = {
  "/dashboard": "Overview", "/help": "Help Center", "/devices": "Connected Devices",
  "/discover": "Discover", "/globe": "Global Globe", "/giving": "My Giving", "/communications": "Messages", "/agents": "AI Agents",
  "/inbox": "Inbox", "/following": "Following", "/mission": "Mission Control", "/ops": "Ops Center",
  "/connections": "Connections", "/community": "Community", "/institutions": "Institutions",
  "/analytics": "Command Center", "/subscriptions": "Plans", "/withdrawals": "Withdrawals",
  "/platform": "Platform", "/create": "New Campaign", "/profile": "Profile", "/notifications": "Notifications",
  "/social": "Social", "/devices": "Connected Devices", "/donors": "Supporters", "/ledger": "Financial Ledger", "/connect": "Connect AI Assistant", "/admin/external-accounts": "Connections", "/admin/integrations": "Connections", "/admin/audit": "Audit Log",
};
function pageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/campaign/")) return "Campaign";
  if (pathname.startsWith("/community/")) return "Community";
  if (pathname.startsWith("/institutions/")) return "Institution";
  return "Interplanetary Fund";
}

const navSections = [
  {
    label: "Fundraise",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/create", label: "New Campaign", icon: PlusCircle },
      { to: "/donors", label: "Supporters", icon: Users },
      { to: "/discover", label: "Discover", icon: Compass },
      { to: "/globe", label: "Global Globe", icon: Globe2 },
    ],
  },
  {
    label: "Giving",
    items: [
      { to: "/giving", label: "My Giving", icon: HeartHandshake },
      { to: "/following", label: "Following", icon: Heart },
      { to: "/withdrawals", label: "Withdrawals", icon: Wallet },
      { to: "/ledger", label: "Financial Ledger", icon: BookOpen },
      { to: "/subscriptions", label: "Plans", icon: CreditCard },
    ],
  },
  {
    label: "Engage",
    items: [
      { to: "/social", label: "Interplanetary Social", icon: Radio },
      { to: "/community", label: "Community", icon: Users },
      { to: "/institutions", label: "Institutions", icon: Building2 },
      { to: "/communications", label: "Messages", icon: MessageSquare },
      { to: "/inbox", label: "Inbox", icon: MailOpen },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/mission", label: "Mission Control", icon: Sparkles },
      { to: "/agents", label: "AI Agents", icon: Bot },
      { to: "/ops", label: "Ops Center", icon: Satellite },
      { to: "/analytics", label: "Command Center", icon: BarChart3 },
      { to: "/connect", label: "Connect Assistant", icon: Plug },
      { to: "/admin/audit", label: "Audit Log", icon: Server },
    ],
  },
  {
    label: "Settings",
    items: [
      { to: "/connections", label: "Connections", icon: Link2 },
      { to: "/platform", label: "Platform", icon: Server },
      { to: "/profile", label: "Profile", icon: User },
    ],
  },
];

// Flat list kept for backward-compatible lookups (e.g. mobile menu).
const navItems = navSections.flatMap((s) => s.items);

const publicNavItems = [
  { to: "/", label: "Home", icon: House },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/globe", label: "Global Globe", icon: Globe2 },
  { to: "/community", label: "Community", icon: Users },
  { to: "/help", label: "Help", icon: CircleHelp },
];

const bottomNavItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/discover", label: "Campaigns", icon: Compass },
  { to: "/social", label: "Social Media", icon: Radio },
  { to: "/inbox", label: "Inbox", icon: MailOpen },
  { to: "/profile", label: "Profile", icon: User },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user: currentUser, isAuthenticated } = useAuth();
  const user = isAuthenticated ? currentUser : null;
  const isAdmin = user?.role === "admin";
  const hasAiAgents = hasPlanLevel(user, 1);
  const { pathname } = useLocation();
  const title = pageTitle(pathname);
  const section = pathname.startsWith("/admin/") ? "Administration"
    : ["/discover", "/campaign", "/community", "/help"].some(v => pathname.startsWith(v)) ? "Explore"
    : "Your workspace";
  const navigate = useNavigate();
  const activeTab = owningNavigationTab(pathname, !!user);
  const isRoot = ["/", "/dashboard", "/discover", "/social", "/inbox",
    "/profile", "/community", "/help", "/globe"].includes(pathname);
  const goBack = () => {
    if (canReturnWithinApp(window.history.state)) navigate(-1);
    else navigate(navigationBackFallback(pathname, !!user), { replace: true });
  };
  useSwipeBack(!isRoot, goBack);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const nav = (
    <nav aria-label="Main navigation" className="flex min-h-0 flex-1 flex-col gap-3 px-3 overflow-y-auto overscroll-contain scrollbar-hide pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {!user ? (
        <div>
          <p className="ifund-nav-section-title px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400/90">Explore</p>
          <div className="flex flex-col gap-0.5">
            {publicNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)} className={({ isActive }) => `ifund-nav-link flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:text-slate-100 hover:bg-white/5"}`}>
                <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} /><span className="truncate">{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ) : navSections.map((section) => (
        <div key={section.label}>
          <p className="ifund-nav-section-title px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400/90">{section.label}</p>
          <div className="flex flex-col gap-0.5">
            {section.items.filter(({ to }) => {
              if (to === "/agents") return hasAiAgents;
              const adminOnly = ["/analytics", "/connect", "/ops", "/platform"].includes(to) || to.startsWith("/admin/");
              return isAdmin || !adminOnly;
            }).map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                `ifund-nav-link flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
                }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="ifund-shell h-dvh w-full min-w-0 overflow-hidden bg-background text-foreground flex flex-col">
      <aside className="ifund-sidebar hidden md:flex fixed inset-y-0 left-0 w-60 flex-col deep-space py-6 z-40">
        <div className="px-5 mb-8">
          <div className="flex items-start justify-between gap-2">
            <Link to={user ? "/dashboard" : "/"} className="min-w-0 cursor-pointer" aria-label={user ? "Go to dashboard" : "Go home"}>
              <BrandLogo size="sm" nameClassName="text-slate-100 text-[15px] leading-tight" />
            </Link>
            {user && <NotificationBell />}
          </div>
          <p className="mt-3 font-display text-base brand-gradient-text">{SLOGAN}</p>
          <p className="mt-2 text-[10px] uppercase tracking-[.17em] text-slate-400">Fundraising, connected.</p>
        </div>
        {nav}
        <p className="mt-auto px-6 text-[11px] leading-relaxed text-slate-500">{SLOGAN_LONG}</p>
      </aside>

      <header className="ifund-mobile-header md:hidden sticky top-0 z-40 flex items-center justify-between gap-2 deep-space px-3 py-3 pt-safe">
        <div className="flex items-center gap-1 min-w-0">
          {!isRoot && (
            <button onClick={goBack} aria-label="Back" className="text-stone-300 p-2 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center hover:text-white transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <Link to={user ? "/dashboard" : "/"} className="min-w-0 cursor-pointer" aria-label={user ? "Go to dashboard" : "Go home"}>
            <BrandLogo size="sm" showName={isRoot} nameClassName="text-slate-100 text-[15px] truncate" />
          </Link>
          {!isRoot && <span className="font-display text-slate-100 text-lg truncate">{pageTitle(pathname)}</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {user && <NotificationBell />}
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-menu" className="text-stone-300 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Toggle menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>
      <OfflineBanner />
      {open && (
        <>
          <div className="md:hidden fixed inset-0 top-14 z-30 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div id="mobile-menu" className="ifund-sidebar md:hidden fixed inset-x-0 top-14 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-40 deep-space pt-2 shadow-xl flex flex-col overflow-hidden">{nav}</div>
        </>
      )}

      <nav aria-label="Bottom navigation" className="ifund-mobile-nav md:hidden fixed inset-x-0 bottom-0 z-40 deep-space border-t border-white/10 flex pb-safe">
        {(user ? bottomNavItems : publicNavItems).map(({ to, label, icon: Icon }) => {
          const active = activeTab === to;
          return (
            <NavLink
              key={to}
              to={to}
              end
              onClick={() => { hapticTap(); setOpen(false); }}
              aria-current={active ? "page" : undefined}
              className={active
                ? "flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 py-2 min-h-[48px] text-[10px] font-medium text-cyan-400"
                : "flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 py-2 min-h-[48px] text-[10px] font-medium text-slate-400"}
            >
              <Icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              <span className="max-w-full truncate px-0.5 text-center">{label}</span>
            </NavLink>
          );
        })}
      </nav>

      <main data-page-scroll className="ifund-experience ifund-stage flex-1 min-h-0 w-full min-w-0 md:pl-60 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0 overflow-x-hidden overflow-y-auto overscroll-y-contain text-foreground">
        <div className="ifund-workspace-bar sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 sm:px-7">
          <div className="min-w-0">
            <p className="ifund-workspace-kicker">{section}</p>
            <p className="ifund-workspace-title truncate">{title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/help" className="ifund-workspace-utility inline-flex min-h-10 items-center gap-2 px-3 text-xs font-semibold" aria-label="Visit IFund Help Center">
              <LifeBuoy className="h-4 w-4" />
              <span className="hidden sm:inline">Help Center</span>
            </Link>
            {user && (
              <Link to="/create" className="hidden lg:inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800" aria-label="Create a campaign">
                New campaign <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full min-w-0 max-w-full overflow-x-hidden"
          >
            <ErrorBoundary key={pathname}>
              <Outlet />
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
        {user && <QuickActions />}
        <BackToTop />
        <div className="md:block hidden"><LegalFooter /></div>
      </main>
    </div>
  );
}