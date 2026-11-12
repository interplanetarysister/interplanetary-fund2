import { useEffect, useMemo, useRef, useState } from "react";

// AG Charts Community UMD only; no Enterprise assets or license keys.
// Keep the optional visualization lazy so the financial ledger remains usable
// when a network policy or blocker prevents loading the chart script.
const CHART_URL = "https://cdn.jsdelivr.net/npm/ag-charts-community@14.2.0/dist/umd/ag-charts-community.min.js";
let loading;
function charts() {
  if (typeof window === "undefined") return Promise.reject(Error("Browser required"));
  if (window.agCharts?.AgCharts) return Promise.resolve(window.agCharts.AgCharts);
  if (!loading) loading = new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=CHART_URL;
    script.async=true;
    script.crossOrigin="anonymous";
    script.onload=()=>window.agCharts?.AgCharts
      ? resolve(window.agCharts.AgCharts) : reject(Error("AG Charts unavailable"));
    script.onerror=()=>reject(Error("Chart CDN unavailable"));
    document.head.appendChild(script);
  }).catch(e=>{loading=null;throw e;});
  return loading;
}
export default function FinanceDonutChart({ rows, title }) {
  const host=useRef(null);
  const [error,setError]=useState(false);
  const data=useMemo(()=>Array.isArray(rows)
    ? rows.filter(r=>typeof r?.name==="string" && Number.isFinite(r.value) && r.value>0)
    : [],[rows]);
  useEffect(()=>{
    if(!data.length)return;
    let alive=true,chart;
    charts().then(api=>{
      if(!alive||!host.current)return;
      chart=api.create({container:host.current,height:260,
        background:{fill:"#fff"},data,legend:{position:"bottom"},
        series:[{type:"donut",angleKey:"value",legendItemKey:"name",
          calloutLabelKey:"name",calloutLabel:{enabled:false},innerRadiusRatio:.72}]});
      setError(false);
    }).catch(()=>{if(alive)setError(true)});
    return ()=>{alive=false;chart?.destroy()};
  },[data]);
  return <section className="rounded-2xl border border-border bg-card p-5" aria-label={title}>
    <h2 className="mb-2 text-lg font-semibold">{title}</h2>
    {data.length ? <div ref={host} role="img" aria-label={title+" based on actual records"} /> :
      <p className="text-sm text-muted-foreground">No verified records to chart.</p>}
    {error && <p role="status" className="text-xs text-muted-foreground">Interactive chart unavailable. The figures remain accessible below.</p>}
    <ul className="mt-3 space-y-1 text-sm">{data.map(row=><li key={row.name} className="flex justify-between gap-3"><span>{row.name}</span><strong>{row.value.toLocaleString()}</strong></li>)}</ul>
  </section>;
}
