// Shared shaping for live campaign demographics. Every value here comes from
// real published campaign records — never demo fixtures.

export const PALETTE = [
  "#22d3ee", "#818cf8", "#34d399", "#fbbf24", "#f472b6", "#60a5fa",
  "#a78bfa", "#4ade80", "#fb7185", "#38bdf8",
];

export const titleCase = (value) =>
  String(value || "not specified").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Groups campaigns by a derived key, keeping the largest slices and folding the
// remainder into "Other" so a donut stays readable.
export function groupBy(campaigns, keyFn, limit = 6) {
  const counts = new Map();
  for (const campaign of Array.isArray(campaigns) ? campaigns : []) {
    const key = String(keyFn(campaign) || "Not specified").trim() || "Not specified";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const sorted = [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  if (sorted.length <= limit) return sorted;
  const head = sorted.slice(0, limit - 1);
  const other = sorted.slice(limit - 1).reduce((sum, row) => sum + row.value, 0);
  return [...head, { name: "Other", value: other }];
}

// Funding progress of a live campaign, in bands a supporter can read at a glance.
export function progressBand(campaign) {
  const goal = Number(campaign?.goal_amount) || 0;
  const raised = Number(campaign?.raised_amount) || 0;
  if (goal <= 0) return "No goal set";
  if (raised <= 0) return "Not started";
  const pct = raised / goal;
  if (pct < 0.25) return "Under 25%";
  if (pct < 0.75) return "25–74%";
  return "75%+ funded";
}

// Goal size bands, so organizers can see how campaigns at their scale perform.
export function goalBand(campaign) {
  const goal = Number(campaign?.goal_amount) || 0;
  if (goal <= 0) return "No goal set";
  if (goal < 5000) return "Under $5k";
  if (goal < 25000) return "$5k–$25k";
  if (goal < 100000) return "$25k–$100k";
  return "$100k+";
}

export const placeOf = (campaign) => {
  const place = String(campaign?.location || "").trim();
  return place || "Not specified";
};

export const formatUsd = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export const progressPercent = (campaign) => {
  const goal = Number(campaign?.goal_amount) || 0;
  const raised = Number(campaign?.raised_amount) || 0;
  if (goal <= 0) return null;
  return Math.min(100, Math.round((raised / goal) * 100));
};