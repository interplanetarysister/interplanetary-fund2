import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, Share2, ChevronDown, ChevronUp } from "lucide-react";
import { campaignPublicUrl } from "@/lib/campaignSharing";
import { buildSocialShareTargets } from "@/lib/socialShareTargets";
import { copyText } from "@/lib/copyText";

// Public sharing does not need a login, an account connection, or an agent.
// Opening a destination lets the visitor review and send the post themselves.
export default function CampaignSharePanel({ campaign }) {
  const url = campaignPublicUrl(campaign?.id);
  const targets = buildSocialShareTargets({
    url, title: campaign?.title, image: campaign?.cover_image_url,
  });
  const linkRef = useRef(null);
  const [showOutlets, setShowOutlets] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");

  if (!url) return null;

  const copyLink = async () => {
    const success = await copyText(url, linkRef.current);
    setCopied(success);
    setNotice(success ? "Campaign link copied." : "Select the link above and use your device's Copy command.");
  };

  const shareToApp = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: campaign?.title || "Campaign",
          text: "Explore this campaign on Interplanetary Fund.",
          url,
        });
        setNotice("");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return; // The visitor canceled.
      }
    }
    setShowOutlets(true);
    setNotice("Choose an outlet below, or copy the campaign link.");
  };

  return (
    <section aria-label="Share this campaign" className="bg-white rounded-2xl border border-stone-200/70 p-4 sm:p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-stone-900">
        <Share2 className="h-4 w-4 text-primary" /> Share this campaign
      </h2>
      <p className="mt-1 mb-3 text-xs text-stone-600">Help others discover this campaign. No IFund account needed.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={shareToApp} className="min-h-11">
          <Share2 className="h-4 w-4 mr-2" /> Share to an app
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={copyLink} className="min-h-11">
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      <label htmlFor={`share-campaign-link-${campaign.id}`} className="sr-only">Public campaign link</label>
      <input
        id={`share-campaign-link-${campaign.id}`}
        ref={linkRef}
        type="text"
        readOnly
        value={url}
        onFocus={event => event.target.select()}
        className="mt-3 w-full min-h-10 rounded-lg border border-stone-300 bg-slate-50 p-2 text-xs text-slate-800"
      />
      <button type="button" aria-expanded={showOutlets} onClick={() => setShowOutlets(value => !value)}
        className="mt-3 min-h-11 w-full flex items-center justify-between rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
        Choose a social outlet
        {showOutlets ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {showOutlets && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
            {targets.map(target => (
              <a key={target.id} href={target.href}
                target={target.external === false ? undefined : "_blank"}
                rel={target.external === false ? undefined : "noopener noreferrer"}
                className="flex min-h-11 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-2 py-2 text-center text-sm font-semibold text-blue-900 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
                {target.name}
              </a>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-600">
            Each outlet opens its sharing screen. You choose whether to publish or send.
            Other installed apps may appear under Share to an app.
          </p>
        </>
      )}
      {notice && <p role="status" className="mt-2 text-xs text-stone-700">{notice}</p>}
    </section>
  );
}
