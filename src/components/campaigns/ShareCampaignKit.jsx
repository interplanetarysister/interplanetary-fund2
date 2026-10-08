import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check, Code2, QrCode, Download } from "lucide-react";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";
import { buildCampaignEmbed } from "@/lib/campaignSharing";
import { copyText } from "@/lib/copyText";

// Both embed snippets are always visible, selectable, and copyable even when
// mobile browsers block clipboard permissions. Never put preview/editor URLs
// in code pasted outside IFund: use the canonical public domain.
export default function ShareCampaignKit({ campaign }) {
  const platformOnlyMode = !usePublicCampaignFundraising();
  const [copied, setCopied] = useState("");
  const [warning, setWarning] = useState("");
  const cardRef = useRef(null);
  const buttonRef = useRef(null);
  const linkRef = useRef(null);
  const embed = buildCampaignEmbed(campaign, platformOnlyMode);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=12&data=${encodeURIComponent(embed.url)}`;

  const copy = async (which, text, ref) => {
    const success = await copyText(text, ref?.current);
    setCopied(success ? which : "");
    setWarning(success ? "" : "Clipboard access is unavailable. Tap the code field, select its text and use Copy.");
    if (success) setTimeout(() => setCopied(""), 2200);
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: campaign.title || "Campaign", url: embed.url }); return; }
      catch { /* user canceled or native share unavailable */ }
    }
    await copy("link", embed.url, linkRef);
  };

  return (
    <section className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm" aria-label="Share and embed campaign">
      <h3 className="flex items-center gap-2 font-display text-lg text-stone-900 mb-1">
        <Share2 className="w-4 h-4 text-primary" /> Share & embed campaign
      </h3>
      <p className="text-xs text-stone-500 mb-4">
        {platformOnlyMode ? "Your campaign stays public and shareable. Individual campaign donations are currently paused." :
          "Copy a permanent IFund link or paste the campaign card into a website, blog or profile."}
      </p>

      <label htmlFor="ifund-campaign-link" className="block text-xs font-semibold text-stone-700 mb-1">Permanent campaign link</label>
      <textarea id="ifund-campaign-link" ref={linkRef} readOnly value={embed.url}
        onFocus={e => e.target.select()} rows={2}
        className="w-full rounded-lg border border-stone-300 bg-slate-50 p-3 text-sm text-slate-900 break-all resize-y" />
      <div className="flex flex-wrap gap-2 mt-2 mb-4">
        <Button type="button" variant="outline" size="sm" onClick={() => copy("link", embed.url, linkRef)}>
          {copied === "link" ? <Check /> : <Copy />} {copied === "link" ? "Link copied" : "Copy link"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={share}><Share2 /> Share</Button>
      </div>

      <label htmlFor="ifund-campaign-card-code" className="block text-xs font-semibold text-stone-700 mb-1">Embed campaign card — copy all HTML</label>
      <textarea id="ifund-campaign-card-code" ref={cardRef} readOnly rows={6}
        value={embed.card} onFocus={e => e.target.select()}
        className="w-full rounded-lg border border-stone-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 resize-y" />
      <Button type="button" variant="outline" size="sm" className="w-full mt-2 rounded-xl"
        onClick={() => copy("card", embed.card, cardRef)}>
        {copied === "card" ? <Check /> : <Code2 />} {copied === "card" ? "Card HTML copied" : "Copy campaign card HTML"}
      </Button>

      <div className="rounded-xl bg-slate-50 border border-stone-200 p-3 mt-4 flex justify-center">
        <a href={embed.url} target="_blank" rel="noopener noreferrer"
          aria-label={`Open the campaign: ${campaign.title || "Campaign"}`}
          className="block w-full max-w-[320px] rounded-2xl overflow-hidden bg-white border border-stone-200 shadow-lg text-stone-900 hover:shadow-xl">
          <img src={embed.previewImage} alt={campaign.title || "Campaign image"}
            loading="lazy" className="h-40 w-full object-cover" />
          <div className="p-4 space-y-2">
            <h4 className="font-display text-lg font-bold break-words">{campaign.title || "Campaign"}</h4>
            {campaign.summary && <p className="text-xs text-stone-500 line-clamp-3">{campaign.summary}</p>}
            <p className="text-xs text-slate-700">{(Number(campaign.raised_amount) || 0).toLocaleString("en-US", {style:"currency",currency:"USD"})} raised</p>
            <span className="block rounded-lg bg-blue-600 p-3 text-center text-sm font-semibold text-white">
              {platformOnlyMode ? "View campaign" : "Support campaign"}
            </span>
          </div>
        </a>
      </div>
      <p className="text-[11px] text-stone-500 mt-2">
        Copy the HTML for websites that allow custom HTML. This card works without iframes or scripts.
        It shows a snapshot of progress; clicking it opens current details and payment options on IFund.
      </p>

      <label htmlFor="ifund-campaign-button-code" className="block text-xs font-semibold text-stone-700 mt-4 mb-1">Embed a smaller campaign button</label>
      <textarea id="ifund-campaign-button-code" ref={buttonRef} readOnly rows={4}
        value={embed.button} onFocus={e => e.target.select()}
        className="w-full rounded-lg border border-stone-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 resize-y" />
      <Button type="button" variant="outline" size="sm" className="w-full mt-2"
        onClick={() => copy("button", embed.button, buttonRef)}>
        {copied === "button" ? <Check /> : <Code2 />} {copied === "button" ? "Button HTML copied" : "Copy button HTML"}
      </Button>
      {warning && <p role="status" className="text-sm text-amber-700 mt-3">{warning}</p>}
      <div className="mt-4 flex items-center justify-between gap-3">
        <img src={qrSrc} alt="QR code linking to this campaign" className="w-28 h-28 rounded-lg border border-stone-200" />
        <a href={qrSrc} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-700 underline">
          <Download className="w-4 h-4" /> Open QR code <QrCode className="w-4 h-4" />
        </a>
      </div>
    </section>
  );
}
