import { useState, useEffect } from "react";

const TERMS_KEY = "if_terms_accepted_v1";
const TERMS_DATE = "August 3, 2026";

// Legal gate — shown once to new visitors. Acceptance is stored in
// localStorage so the modal doesn't re-appear on subsequent visits.
export default function TermsAcceptance({ children }) {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(TERMS_KEY) === "true") setAccepted(true);
    } catch {
      // Storage unavailable; show the gate on each visit.
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(TERMS_KEY, "true");
    } catch {
      // ignore
    }
    setAccepted(true);
  };

  if (accepted) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tos-title"
        aria-describedby="tos-desc"
        className="max-w-md w-full bg-white rounded-2xl p-6 border border-stone-200 shadow-2xl my-auto"
      >
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
            IF
          </div>
          <h2 id="tos-title" className="font-display text-xl text-stone-900">Terms of Service</h2>
          <p className="text-stone-500 text-sm mt-1">Last updated {TERMS_DATE}</p>
        </div>
        <p id="tos-desc" className="text-stone-600 text-sm mb-4">
          By using Interplanetary Fund, you agree to our Terms of Service and
          Privacy Policy.
        </p>
        <div className="text-stone-500 text-xs mb-5 space-y-2 bg-stone-50 rounded-xl p-4 border border-stone-100">
          <p>The platform is provided "AS IS" without warranties of any kind.</p>
          <p>Michelle Rogers is not liable for losses exceeding $50 per claim.</p>
          <p>Users assume all risk. Donations are voluntary and may not reach campaign goals.</p>
          <p>The Interplanetary Fund name and code are proprietary — copying is prohibited.</p>
        </div>
        <button
          onClick={accept}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white font-semibold text-base hover:opacity-90 transition-opacity"
        >
          I Agree — Continue
        </button>
      </div>
    </div>
  );
}
