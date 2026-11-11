import { useMemo, useState } from "react";
import FinanceDataGrid from "@/components/finance/FinanceDataGrid";
import { formatUsd, progressPercent, titleCase } from "@/components/insights/donutData";

const columns = [
  { field: "title", headerName: "Live campaign", minWidth: 230 },
  { field: "category", headerName: "Cause", minWidth: 130 },
  { field: "location", headerName: "Based in", minWidth: 140 },
  { field: "goal", headerName: "Goal", minWidth: 120, valueFormatter: ({ value }) => formatUsd(value) },
  { field: "raised", headerName: "Raised", minWidth: 120, valueFormatter: ({ value }) => formatUsd(value) },
  { field: "donors", headerName: "Donors", minWidth: 100 },
  {
    field: "progress", headerName: "Progress", minWidth: 110,
    valueFormatter: ({ value }) => (value == null ? "No goal" : value + "%"),
  },
];

// AG Grid Community over real campaign records. Sortable, filterable, paginated.
export default function LiveCampaignGrid({ campaigns = [], label = "Live campaign records", csvName = "ifund-live-campaigns.csv" }) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => (Array.isArray(campaigns) ? campaigns : []).map((campaign) => ({
    id: campaign.id,
    title: campaign.title || "Untitled campaign",
    category: titleCase(campaign.category),
    location: campaign.location || "Not specified",
    goal: Number(campaign.goal_amount) || 0,
    raised: Number(campaign.raised_amount) || 0,
    donors: Number(campaign.donor_count) || 0,
    progress: progressPercent(campaign),
  })), [campaigns]);

  return <div className="space-y-3">
    <label className="block text-sm font-semibold text-slate-200">
      Search live campaigns
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Filter by campaign, cause or city"
        className="mt-2 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-900 p-3 text-base text-white placeholder:text-slate-400"
      />
    </label>
    <FinanceDataGrid
      rows={rows}
      columns={columns}
      label={label}
      search={search}
      allowExport
      csvName={csvName}
    />
  </div>;
}