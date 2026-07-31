import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { QrCode, Copy, Check, Download } from "lucide-react";

// A scannable code for the campaign. Supporters scan it and land directly on
// this campaign's page, where they can give with PayPal or Cash App.
export default function CampaignQRCode({ campaign }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/campaign/${campaign.id}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=12&data=${encodeURIComponent(url)}`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm">
      <h3 className="flex items-center gap-2 font-display text-lg text-stone-900 mb-1">
        <QrCode className="w-4 h-4 text-primary" /> Campaign QR code
      </h3>
      <p className="text-xs text-stone-500 mb-4">
        Print it, post it, or share it. Every scan opens this campaign's donation page.
      </p>
      <div className="rounded-xl bg-slate-50 border border-stone-200 p-3 flex justify-center mb-3">
        <img src={qrSrc} alt={`QR code linking to ${campaign.title}`} className="w-40 h-40" />
      </div>
      <div className="flex gap-2">
        <Button onClick={copy} variant="outline" size="sm" className="flex-1 rounded-xl">
          {copied ? <><Check className="w-3.5 h-3.5 mr-1" />Copied</> : <><Copy className="w-3.5 h-3.5 mr-1" />Copy link</>}
        </Button>
        <a href={qrSrc} target="_blank" rel="noopener noreferrer" download className="flex-1">
          <Button variant="outline" size="sm" className="w-full rounded-xl">
            <Download className="w-3.5 h-3.5 mr-1" />Download
          </Button>
        </a>
      </div>
    </div>
  );
}