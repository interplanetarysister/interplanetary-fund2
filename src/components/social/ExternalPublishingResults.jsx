import React, { useState } from "react";
import { Check, Copy, ExternalLink, TriangleAlert } from "lucide-react";
import { safeExternalHttpsUrl } from "../../../base44/shared/safeExternalUrl.js";

export default function ExternalPublishingResults({ results = [], content = "" }) {
  const [copiedPlatform, setCopiedPlatform] = useState("");
  if (!results.length) return null;

  const copy = async (platform) => {
    await navigator.clipboard.writeText(content);
    setCopiedPlatform(platform);
    setTimeout(() => setCopiedPlatform(""), 2000);
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3" role="status" aria-live="polite">
      <p className="text-xs font-medium text-slate-200 mb-2">External publishing results</p>
      <div className="space-y-2">
        {results.map((result) => {
          const profileUrl = safeExternalHttpsUrl(result.profile_url);
          return <div key={`${result.platform}-${result.status}`} className="rounded-lg border border-white/10 p-2 text-xs">
            <div className="flex items-center gap-2">
              {result.status === "published" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <TriangleAlert className="w-3.5 h-3.5 text-amber-400" />}
              <span className="font-medium text-slate-200">{result.label || result.platform}</span>
              <span className={result.status === "published" ? "text-emerald-300" : result.status === "manual" ? "text-amber-300" : "text-rose-300"}>
                {result.status === "published" ? "Published" : result.status === "manual" ? "Manual step needed" : "Not published"}
              </span>
            </div>
            {result.reason && <p className="mt-1 text-slate-400">{result.reason}</p>}
            {result.status === "manual" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => copy(result.platform)} className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-cyan-200">
                  {copiedPlatform === result.platform ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedPlatform === result.platform ? "Copied" : "Copy post"}
                </button>
                {profileUrl && (
                  <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-cyan-200">
                    <ExternalLink className="w-3 h-3" /> Open profile
                  </a>
                )}
              </div>
            )}
          </div>;
        })}
      </div>
    </div>
  );
}
