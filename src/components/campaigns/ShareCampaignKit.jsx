import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check, Code2, QrCode, Download } from "lucide-react";
import { buildEmbedMarkup, escapeHtml } from "./embedMarkup";

// The Universal Donation Button — the campaign's permanent Interplanetary Fund
// URL packaged as a branded button anyone can embed on websites, blogs, forums,
// and articles. Includes copy link, HTML embed, QR code, share, and a live preview.
export default function ShareCampaignKit({ campaign }) {
  const [copied, setCopied] = useState("");
  const campaignId = encodeURIComponent(String(campaign.id ?? ""));
  const url = `${window.location.origin}/campaign/${campaignId}`;
  const embedUrl = `${window.location.origin}/embed/campaign/${campaignId}`;
  const safeUrl = escapeHtml(url);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=12&data=${encodeURIComponent(url)}`;

  const embedHtml = [
    `<a href=\"${safeUrl}\" target=\"_blank\" rel=\"noopener noreferrer\"`,
    'style=\"display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#22d3ee,#3b82f6,#7c3aed);color:#ffffff;font-family:system-ui,sans-serif;font-weight:600;font-size:15px;padding:12px 24px;border-radius:12px;text-decoration:none;box-shadow:0 4px 14px rgba(59,130,246,.35);\">',
    "&#128640; Donate &mdash; Interplanetary Fund</a>",
  ].join("\n");

  const embedIframe = buildEmbedMarkup({
    campaignTitle: campaign.title,
    embedUrl,
  });

  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch (error) {
      console.error("ShareCampaignKit clipboard error:", error);
      setCopied("error");
    }
    setTimeout(() => setCopied(""), 2000);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: campaign.title, url });
      } catch {
        // User dismissal is intentionally silent.
      }
    } else {
      await copy("link", url);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm">
      <h3 className="flex items-center gap-2 font-display text-lg text-stone-900 mb-1">
        <Share2 className="w-4 h-4 text-primary" /> Universal Donation Button
      </h3>
      <p className="text-xs text-stone-500 mb-4">
        One permanent campaign URL. Embed the button anywhere — every click opens this donation page.
      </p>

      <div className="rounded-xl bg-slate-50 border border-stone-200 p-4 flex justify-center mb-3">
        <a href={url} className="inline-flex items-center gap-2 bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-blue-500/30">
          🚀 Donate — Interplanetary Fund
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Button onClick={() => copy("link", url)} variant="outline" size="sm" className="rounded-xl" aria-label="Copy campaign link">
          {copied === "link" ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy link</>}
        </Button>
        <Button onClick={() => copy("embed", embedHtml)} variant="outline" size="sm" className="rounded-xl" aria-label="Copy donation button embed code">
          {copied === "embed" ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Code2 className="w-3.5 h-3.5" />Copy embed</>}
        </Button>
        <Button onClick={share} variant="outline" size="sm" className="rounded-xl" aria-label="Share campaign">
          <Share2 className="w-3.5 h-3.5" />Share
        </Button>
        <a href={qrSrc} target="_blank" rel="noopener noreferrer" download>
          <Button variant="outline" size="sm" className="w-full rounded-xl"><Download className="w-3.5 h-3.5" />QR code</Button>
        </a>
      </div>
      {copied === "error" && <p role="status" className="text-xs text-red-600 mb-3">Copy failed. Please try again or copy the code manually.</p>}

      <div className="rounded-xl bg-slate-50 border border-stone-200 p-3 flex justify-center">
        <img src={qrSrc} alt={`QR code linking to ${campaign.title}`} className="w-32 h-32" />
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-stone-400 mt-2">
        <QrCode className="w-3 h-3" /> Works on websites, blogs, forums, articles, and print.
      </p>

      <div className="mt-4 pt-4 border-t border-stone-200">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 mb-1">
          <Code2 className="w-3.5 h-3.5" /> Embed campaign card
        </p>
        <p className="text-[11px] text-stone-500 mb-3">A responsive, live campaign card for blogs and websites.</p>
        <div className="rounded-xl bg-slate-50 border border-stone-200 p-3 mb-3 flex justify-center overflow-hidden">
          <iframe
            src={embedUrl}
            width="100%"
            height="420"
            title={`${campaign.title} preview`}
            loading="lazy"
            className="border-0 rounded-2xl overflow-hidden w-full max-w-[340px]"
          />
        </div>
        <Button onClick={() => copy("iframe", embedIframe)} variant="outline" size="sm" className="w-full rounded-xl" aria-label="Copy responsive campaign card embed code">
          {copied === "iframe" ? <><Check className="w-3.5 h-3.5" />Copied embed code</> : <><Copy className="w-3.5 h-3.5" />Copy embed code</>}
        </Button>
      </div>
    </div>
  );
}
