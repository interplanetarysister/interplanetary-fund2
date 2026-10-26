import React from "react";
import { Link } from "react-router-dom";
import PlatformLogo from "@/components/connections/PlatformLogo";
import { ALL_PLATFORMS } from "@/components/connections/platformCatalog";

// These are recognizable starting points, not claims that each provider's
// direct-publishing API is available. Connection capabilities and status are
// shown by the authoritative Connections screen after the member clicks.
export const POPULAR_CONNECTION_IDS = Object.freeze([
  "facebook", "instagram", "tiktok", "youtube", "x",
  "linkedin", "pinterest", "gofundme", "kofi", "patreon",
]);

const POPULAR_PLATFORMS = POPULAR_CONNECTION_IDS.map((id) =>
  ALL_PLATFORMS.find((platform) => platform.id === id)
).filter(Boolean);

export default function QuickConnectPlatforms() {
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card px-4 py-4 sm:px-5"
      aria-labelledby="dashboard-quick-connections-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="dashboard-quick-connections-heading" className="font-display text-lg font-semibold text-foreground">
            Connect your favorite platforms
          </h2>
          <p className="text-sm text-muted-foreground">Tap a logo to see your connection status or connect an account.</p>
        </div>
        <Link to="/connections" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
          All connections
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-2" role="list"
        aria-label="Popular fundraising and social platforms">
        {POPULAR_PLATFORMS.map((platform) => (
          <div role="listitem" className="shrink-0" key={platform.id}>
            <Link to={`/connections?view=${encodeURIComponent(platform.id)}`}
              aria-label={`View ${platform.name} connection status and setup`}
              title={`View ${platform.name} connection`}
              className="flex min-h-[76px] w-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border border-transparent text-foreground hover:border-primary/35 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <PlatformLogo platform={platform} size="sm" />
              <span className="w-full truncate px-1 text-center text-[11px] font-medium leading-tight">{platform.name}</span>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
