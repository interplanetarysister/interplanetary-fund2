import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";

const MAX_LIVE_CAMPAIGNS = 200;

// Reads live, published campaigns (publicly readable records) for the demo and
// the globe insights. Returns only what the database actually contains.
export default function useLiveCampaigns() {
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    base44.entities.Campaign.filter({ status: "active" }, "-raised_amount", MAX_LIVE_CAMPAIGNS)
      .then((result) => {
        if (!Array.isArray(result) || result.length > MAX_LIVE_CAMPAIGNS) throw new Error("invalid-campaign-payload");
        if (mounted.current) setCampaigns(result);
      })
      .catch(() => {
        if (mounted.current) {
          setCampaigns([]);
          setError("Live campaign data is unavailable right now.");
        }
      });
    return () => { mounted.current = false; };
  }, []);

  return { campaigns, error };
}