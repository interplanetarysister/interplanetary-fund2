import React from "react";
import { Orbit } from "lucide-react";

// The Interplanetary Fund brand mark — an orbiting world rendered in the
// platform's electric blue / cyan / purple identity. Used everywhere the brand
// appears so the logo stays consistent across navigation, auth, and marketing.
export default function BrandLogo({ size = "md", showName = true, className = "", nameClassName = "" }) {
  const dims = {
    sm: { box: "w-8 h-8 rounded-lg", icon: "w-4 h-4", text: "text-base" },
    md: { box: "w-9 h-9 rounded-xl", icon: "w-5 h-5", text: "text-lg" },
    lg: { box: "w-14 h-14 rounded-2xl", icon: "w-7 h-7", text: "text-2xl" },
  }[size];

  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span className={`${dims.box} shrink-0 flex items-center justify-center bg-gradient-to-br from-cyan-300 via-blue-500 to-violet-600 shadow-lg shadow-blue-500/25`}>
        <Orbit className={`${dims.icon} text-white`} strokeWidth={2} />
      </span>
      {showName && (
        <span className={`font-display ${dims.text} tracking-tight leading-none ${nameClassName || "text-slate-100"}`}>
          Interplanetary Fund
        </span>
      )}
    </span>
  );
}