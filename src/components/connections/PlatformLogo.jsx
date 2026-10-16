import React, { useState } from "react";

// Decorative brand marks are for recognition, not proof of a live integration.
// Show legible initials when a mark is unavailable (including offline mode).
const BRAND_SLUGS = {
  gofundme: "gofundme", kickstarter: "kickstarter", indiegogo: "indiegogo",
  givesendgo: "givesendgo", justgiving: "justgiving", fundrazr: "fundrazr",
  kofi: "kofi", buymeacoffee: "buymeacoffee", patreon: "patreon",
  eventbrite: "eventbrite", gumroad: "gumroad", donorbox: "donorbox",
  facebook: "facebook", instagram: "instagram", threads: "threads",
  x: "x", linkedin: "linkedin", tiktok: "tiktok", pinterest: "pinterest",
  reddit: "reddit", youtube: "youtube", discord: "discord",
  mastodon: "mastodon", bluesky: "bluesky", wordpress_com: "wordpress",
  gmail: "gmail", googledrive: "googledrive", googlecalendar: "googlecalendar",
  google_contacts: "googlecontacts", google_photos: "googlephotos",
  googlesheets: "googlesheets", googledocs: "googledocs",
  googleforms: "googleforms", wix: "wix", paypal: "paypal",
};

export default function PlatformLogo({ platform, className = "" }) {
  const [failed, setFailed] = useState(false);
  const name = String(platform?.name || platform?.id || "Platform");
  const id = String(platform?.id || "").toLowerCase();
  const slug = BRAND_SLUGS[id];
  const initials = name.replace(/[^a-zA-Z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || name.slice(0, 2).toUpperCase();
  return (
    <span className={`ifund-platform-logo inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/70 bg-white text-sm font-extrabold text-slate-700 shadow-sm ${className}`}
          style={{ "--brand-accent": platform?.color || "#7059d7" }} aria-hidden="true">
      {slug && !failed
        ? <img src={`https://cdn.simpleicons.org/${slug}`} alt="" loading="lazy" referrerPolicy="no-referrer"
               onError={() => setFailed(true)} className="h-7 w-7 object-contain" />
        : <span>{initials}</span>}
    </span>
  );
}
