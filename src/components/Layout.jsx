import React, { useState, useRef, useEffect } from "react";
import { Outlet, NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Compass, PlusCircle, HeartHandshake, MessageSquare, Sparkles, Users, Building2, BarChart3, Server, Menu, X, Bell, User, CreditCard, Wallet, Link2, MailOpen, Heart, ChevronLeft, Globe2, Bot, Satellite, Share2, Plug, ShieldCheck, Radio } from "lucide-react";
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
import { base44 } from "@/api/base44Client";

const PAGE_TITLES = {
  "/discover": "Discover", "/globe": "Global Globe", "/giving": "My Giving", "/communications": "Messages", "/agents": "AI Agents",
  "/inbox": "Inbox", "/following": "Following", "/mission": "Mission Control", "/ops": "Ops Center",
  "/connections": "Connections", "/community": "Community", "/institutions": "Institutions",
  "/analytics": "Command Center", "/subscriptions": "Plans", "/withdrawals": "Withdrawals",
  "/platform": "Platform", "/create": "New Campaign", "/profile": "Profile", "/notifications": "Notifications",
  "/social": "Social", "/facebook": "Facebook Outreach", "/connect": "Connect AI Assistant", "/admin/external-accounts": "External Accounts", "/admin/integrations": "Integrations",
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
      { to: "/facebook", label: "Facebook Outreach", icon: Share2 },
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
    ],
  },
  {
    label: "Settings",
    items: [
      { to: "/connections", label: "Connections", icon: Link2 },
      { to: "/admin/external-accounts", label: "External Accounts", icon: Link2 },
      { to: "/admin/integrations", label: "Integrations", icon: ShieldCheck },
      { to: "/platform", label: "Platform", icon: Server },
      { to: "/profile", label: "Profile", icon: User },
    ],
  },
];

// Flat list kept for backward-compatible lookups (e.g. mobile menu).
const navItems = navSections.flatMap((s) => s.items);

const bottomNavItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/discover", label: "Campaigns", icon: Compass },
  { to: "/mission", label: "AI Assistant", icon: Sparkles },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    base44.auth.me().then((u) => setIsAdmin(u?.role === "admin")).catch(() => setIsAdmin(false));
  }, []);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const TAB_ROOTS = ["/", "/dashboard", "/discover", "/mission", "/notifications", "/profile"];
  const isRoot = TAB_ROOTS.includes(pathname);
  useSwipeBack(!isRoot);

  const tabStacks = useRef(Object.fromEntries(TAB_ROOTS.map((r) => [r, r])));
  const TAB_SECTIONS = {
    "/dashboard": ["/dashboard"],
    "/discover": ["/discover", "/campaign", "/globe", "/create"],
    "/mission": ["/mission", "/agents", "/ops", "/analytics", "/community", "/institutions", "/connections"],
    "/notifications": ["/notifications", "/inbox", "/communications"],
    "/profile": ["/profile", "/giving", "/following", "/subscriptions", "/withdrawals", "/connect", "/admin/external-accounts", "/admin/integrations"],
  };
  const owningRoot = (p) => {
    if (p === "/") return "/";
    if (p === "/dashboard") return "/dashboard";
    const hit = Object.entries(TAB_SECTIONS).find(([, prefixes]) =>
      prefixes.some((pre) => p === pre || p.startsWith(pre + "/"))
    );
    return hit ? hit[0] : null;
  };
  const activeTab = useRef(owningRoot(pathname) || "/dashboard");
  const navDepth = useRef(0);
  useEffect(() => {
    navDepth.current += 1;
    const root = owningRoot(pathname);
    if (root) activeTab.current = root;
    tabStacks.current[activeTab.current] = pathname;
  }, [pathname]);
  const goTab = (root) => {
    hapticTap();
    if (activeTab.current === root) {
      tabStacks.current[root] = root;
      activeTab.current = root;
      navigate(root);
      return;
    }
    activeTab.current = root;
    navigate(tabStacks.current[root] || root);
  };
  const isTabActive = (root) =>
    root === "/dashboard"
      ? pathname === "/dashboard" || activeTab.current === "/dashboard"
      : pathname === root || pathname.startsWith(root + "/") || activeTab.current === root;

  const goBack = () => {
    if (navDepth.current > 1) navigate(-1);
    else navigate(owningRoot(pathname) || "/dashboard");
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const nav = (
    <nav className="flex flex-col gap-3 px-3 overflow-y-auto scrollbar-hide pb-4">
      {navSections.map((section) => (
        <div key={section.label}>
          <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500/80">{section.label}</p>
          <div className="flex flex-col gap-0.5">
            {section.items.filter(({ to }) => isAdmin || !to.startsWith("/admin/")).map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
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
    <div className="min-h-dvh w-full min-w-0 overflow-x-hidden bg-background text-foreground">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col deep-space py-6 z-40">
        <div className="px-5 mb-8">
          <div className="flex items-start justify-between gap-2">
            <Link to="/inbox" className="min-w-0 cursor-pointer" aria-label="Go to inbox">
              <BrandLogo size="sm" nameClassName="text-slate-100 text-[15px] leading-tight" />
            </Link>
            <NotificationBell />
          </div>
          <p className="mt-3 font-display text-lg brand-gradient-text">{SLOGAN}</p>
        </div>
        {nav}
        <p className="mt-auto px-6 text-[11px] leading-relaxed text-slate-500">{SLOGAN_LONG}</p>
      </aside>

      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-2 deep-space px-3 py-3 pt-safe">
        {isRoot ? (
          <Link to="/inbox" className="min-w-0 cursor-pointer" aria-label="Go to inbox">
            <BrandLogo size="sm" nameClassName="text-slate-100 text-[15px] truncate" />
          </Link>
        ) : (
          <div className="flex items-center gap-1 min-w-0">
            <button onClick={goBack} aria-label="Back" className="text-stone-300 p-2 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center hover:text-white transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="font-display text-slate-100 text-lg truncate">{pageTitle(pathname)}</span>
          </div>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <NotificationBell />
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-menu" className="text-stone-300 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Toggle menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>
      <OfflineBanner />
      {open && (
        <>
          <div className="md:hidden fixed inset-0 top-14 z-30 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div id="mobile-menu" className="md:hidden fixed inset-x-0 top-14 z-40 deep-space pb-4 pt-2 shadow-xl">{nav}</div>
        </>
      )}

      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 deep-space border-t border-white/10 flex pb-safe">
        {bottomNavItems.map(({ to, label, icon: Icon }) => {
          const active = isTabActive(to);
          return (
            <button
              key={to}
              onClick={() => goTab(to)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] text-[10px] font-medium transition-colors ${
                active ? "text-cyan-400" : "text-slate-400"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </nav>

      <main className="w-full min-w-0 md:pl-60 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0 overflow-x-hidden bg-background text-foreground">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full min-w-0 max-w-full overflow-x-hidden"
          >
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
        <QuickActions />
        <BackToTop />
        <div className="md:block hidden"><LegalFooter /></div>
      </main>
    </div>
  );
}