import { Link } from "react-router-dom";

// Legal footer — copyright, disclaimer, and trust page links shown at the bottom of the platform.
export default function LegalFooter() {
  return (
    <footer className="text-center text-[11px] text-stone-400 py-4 px-4 border-t border-stone-100">
      <div className="flex items-center justify-center gap-2 mb-1">
        <Link to="/about" className="hover:text-stone-600 transition-colors">About</Link>
        <span>·</span>
        <Link to="/contact" className="hover:text-stone-600 transition-colors">Contact</Link>
      </div>
      © 2026 Michelle Rogers · Interplanetary Fund · All Rights Reserved ·{" "}
      <span className="italic">Donations are voluntary and may not reach campaign goals.</span>
    </footer>
  );
}