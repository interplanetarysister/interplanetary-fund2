import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Megaphone, Sparkles, Rocket, CheckCircle2, Clipboard } from "lucide-react";
import { Link } from "react-router-dom";
import DistributedPostCard from "./DistributedPostCard";
import { platformName } from "@/components/connections/platformCatalog";

const directReady = (c) => {
  const cr = c.credentials || {};
  return (c.platform === "bluesky" && cr.bluesky_handle && cr.bluesky_app_password) ||
    (c.platform === "mastodon" && cr.mastodon_instance && cr.mastodon_access_token);
};
const aiReady = (c) => c.status === "connected" && c.obo_consent?.granted === true && c.agent_access?.shared_with_agents === true && c.automation_mode !== "manual";
const approvedReady = (c) => c.status === "connected" && c.obo_consent?.granted === true && directReady(c);

function DestinationGroup({ title, hint, icon: Icon, connections, selected, setSelected }) {
  if (!connections.length) return null;
  return <div className="rounded-xl border border-stone-200 p-3">
    <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-primary"/><p className="text-sm font-semibold text-stone-800">{title}</p></div>
    <p className="text-xs text-stone-500 mt-1 mb-2">{hint}</p>
    <div className="flex flex-wrap gap-2">{connections.map(c => <label key={c.id} className="flex items-center gap-2 text-sm rounded-lg border border-stone-200 px-3 py-2 text-stone-700">
      <Checkbox checked={selected.includes(c.id)} onCheckedChange={(v)=>setSelected(prev=>v?[...new Set([...prev,c.id])]:prev.filter(x=>x!==c.id))}/>{platformName(c.platform)}
    </label>)}</div>
  </div>;
}

export default function DistributionPanel({ campaign }) {
  const [connections,setConnections]=useState(null), [posts,setPosts]=useState([]), [selected,setSelected]=useState([]);
  const [generating,setGenerating]=useState(false), [broadcasting,setBroadcasting]=useState(false), [error,setError]=useState("");
  const {toast}=useToast();
  useEffect(()=>{(async()=>{const [r,p]=await Promise.all([base44.functions.invoke("listConnections",{}),base44.entities.DistributedPost.filter({campaign_id:campaign.id},"-created_date",30)]);const cs=(r.data?.connections||[]).filter(c=>!c.campaign_id||c.campaign_id===campaign.id);setConnections(cs);setSelected(cs.filter(aiReady).map(c=>c.id));setPosts(p)})()},[campaign.id]);
  if(!connections)return null;
  const pending=posts.filter(p=>["pending_approval","draft","approved","failed"].includes(p.status));
  const ai=connections.filter(aiReady), approved=connections.filter(c=>!aiReady(c)&&approvedReady(c)), copy=connections.filter(c=>!aiReady(c)&&!approvedReady(c));
  const generate=async()=>{setGenerating(true);setError("");try{const {data}=await base44.functions.invoke("generateDistributionContent",{campaign_id:campaign.id,connection_ids:selected});if(data?.error)setError(data.error);else setPosts(prev=>[...(data.posts||[]),...prev])}catch(e){setError(e.response?.data?.error||"Couldn't prepare the posts. Please try again.")}setGenerating(false)};
  const broadcast=async()=>{setBroadcasting(true);setError("");try{const {data}=await base44.functions.invoke("broadcastPosts",{campaign_id:campaign.id});if(data?.error)setError(data.error);else{const m=new Map(posts.map(p=>[p.id,p]));for(const u of(data.posts||[]))m.set(u.id,u);setPosts([...m.values()].sort((a,b)=>new Date(b.created_date)-new Date(a.created_date)));toast({title:"Posts prepared",description:`${data.published} sent · ${data.manual} ready for you to copy and post${data.failed?` · ${data.failed} need attention`:""}.`})}}catch(e){setError(e.response?.data?.error||"Couldn't send the posts. Please try again.")}setBroadcasting(false)};
  return <div className="bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm">
    <h3 className="flex items-center gap-2 font-display text-xl text-stone-900 mb-1"><Megaphone className="w-5 h-5 text-primary"/>Broadcast your campaign</h3>
    <p className="text-sm text-stone-500 mb-4">Let AI fill in platform-ready versions of your campaign update, review them, then send what can be sent and copy the rest.</p>
    {!connections.length?<p className="text-sm text-stone-500">No platforms connected yet. <Link to="/connections" className="text-primary hover:underline">Connect your accounts</Link>.</p>:<div className="space-y-3">
      <DestinationGroup title="AI can prepare these" hint="AI can write a version suited to each of these accounts. You stay in control according to your posting choice." icon={Sparkles} connections={ai} selected={selected} setSelected={setSelected}/>
      <DestinationGroup title="You approve, then we can send" hint="These accounts can receive a post after you approve it. AI won't take over the wording unless you choose it." icon={CheckCircle2} connections={approved} selected={selected} setSelected={setSelected}/>
      <DestinationGroup title="Ready to copy and paste" hint="We'll prepare the post here, but this destination needs you to paste it into the other site." icon={Clipboard} connections={copy} selected={selected} setSelected={setSelected}/>
      <div className="flex flex-wrap gap-3 pt-1"><Button onClick={generate} disabled={generating||!selected.length} className="rounded-xl">{generating?<Loader2 className="w-4 h-4 animate-spin"/>:<Sparkles className="w-4 h-4"/>} Fill posts with AI</Button>{pending.length>0&&<Button onClick={broadcast} disabled={broadcasting} variant="outline" className="rounded-xl">{broadcasting?<Loader2 className="w-4 h-4 animate-spin"/>:<Rocket className="w-4 h-4"/>} Approve & send ({pending.length})</Button>}</div>
      {error&&<p className="text-sm text-red-600">{error}</p>}
    </div>}
    {!!posts.length&&<div className="space-y-3 mt-4">{posts.map(p=><DistributedPostCard key={p.id} post={p} onChanged={u=>setPosts(prev=>prev.map(x=>x.id===u.id?u:x))} onRemoved={id=>setPosts(prev=>prev.filter(x=>x.id!==id))}/>)}</div>}
  </div>;
}
