import { useState, useEffect } from "react";
import BrandLogo from "@/components/brand/BrandLogo";

// Per-session permissions gate. Stored in sessionStorage so it re-appears
// every time a user opens the app in a new browser session. Does NOT auto-
// accept — the user must explicitly activate the agreement button. No
// timeout, focus, backdrop, navigation, or initialization dismissal.
const SESSION_KEY = "if_permissions_session_v1";

const PERMISSIONS = [
  { label: "Account & Profile", detail: "Create your account, set a username, and manage your identity." },
  { label: "Campaigns & Donations", detail: "Create fundraisers, receive donations, and process payments." },
  { label: "Social Publishing", detail: "Post to the Interplanetary Fund feed and connected social platforms." },
  { label: "Platform Connections", detail: "Connect external accounts (Google, Apple, Facebook, Instagram, TikTok) for cross-posting." },
  { label: "AI Agents & Automation", detail: "Authorize agents to draft content, schedule posts, and suggest outreach." },
  { label: "Notifications", detail: "Receive email and in-app updates about campaigns and activity." },
  { label: "Analytics & Insights", detail: "Track campaign performance, donor activity, and engagement metrics." },
];

export default function TermsAcceptance({ children }) {
  const [accepted, setAccepted] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    try {
      setAccepted(sessionStorage.getItem(SESSION_KEY) === "true");
    } catch {
      setAccepted(false);
    } finally {
      setInitialized(true);
    }
  }, []);

  const accept = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "true");
    } catch {
      // Storage failure must not block an explicit acceptance.
    }
    setAccepted(true);
  };

  // Embed routes and public iframe content bypass the per-session gate so
  // embedded campaign cards render on external sites without a click.
  const isEmbedRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/embed/");
  if (!initialized) return null;
  if (accepted || isEmbedRoute) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[60] deep-space flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg animate-fade-up my-auto">
        <div className="text-center mb-6">
          <BrandLogo size="lg" className="justify-center mb-4" nameClassName="text-slate-100" />
        </div>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="perm-title"
          className="glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl"
        >
          <div className="text-center mb-6">
            <h2 id="perm-title" className="font-display text-2xl text-white">
              Permissions & Agreement
            </h2>
            <p className="text-slate-400 text-sm mt-2">
              Interplanetary Fund needs the following permissions to operate.
              Review them each time you start a session.
            </p>
          </div>

          <div className="space-y-2 mb-6 max-h-[340px] overflow-y-auto pr-1 scrollbar-hide">
            {PERMISSIONS.map((p) => (
              <div
                key={p.label}
                className="flex gap-3 rounded-xl bg-white/5 border border-white/10 p-3"
              >
                <div className="mt-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-100">{p.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{p.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-slate-500 text-xs mb-5 leading-relaxed">
            By continuing, you agree to the Interplanetary Fund Terms of Service
            and Privacy Policy. The platform is provided "AS IS" without
            warranties. Campaign outcomes and third-party services may involve
            risks. Users are responsible for the campaigns, content, and actions
            they initiate.
          </p>

          <button
            type="button"
            onClick={accept}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 text-white font-semibold text-base hover:opacity-90 transition-opacity glow-primary"
          >
            I Agree — Enter Interplanetary Fund
          </button>
        </div>
      </div>
    </div>
  );
}