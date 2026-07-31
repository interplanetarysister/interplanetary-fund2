import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DiscussionsTab from "@/components/community/DiscussionsTab";
import VolunteerTab from "@/components/community/VolunteerTab";
import MembersTab from "@/components/community/MembersTab";
import { Users, MapPin, Loader2, LogOut, UserPlus } from "lucide-react";
import { communityTypes } from "@/components/community/communityTypes";

export default function CommunityDetail() {
  const { id } = useParams();
  const [community, setCommunity] = useState(null);
  const [members, setMembers] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [user, c, m] = await Promise.all([
      base44.auth.me(),
      base44.entities.Community.get(id),
      base44.entities.CommunityMember.filter({ community_id: id }),
    ]);
    setMe(user);
    setCommunity(c);
    setMembers(m);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!community) {
    return <p className="text-center text-stone-400 py-20">Community not found.</p>;
  }

  const myMembership = members.find((m) => m.user_id === me.id);
  const isMember = !!myMembership;
  const canManage = myMembership && ["owner", "moderator"].includes(myMembership.role);

  const join = async () => {
    setBusy(true);
    const { data } = await base44.functions.invoke("communityMembership", { action: "join", community_id: id });
    if (!data?.error) await load();
    else alert(data.error);
    setBusy(false);
  };

  const leave = async () => {
    setBusy(true);
    const { data } = await base44.functions.invoke("communityMembership", { action: "leave", community_id: id });
    if (!data?.error) await load();
    else alert(data.error);
    setBusy(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-stone-900">{community.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-stone-500">
            <Badge variant="secondary">{communityTypes[community.type] || community.type}</Badge>
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {community.member_count || members.length} members</span>
            {community.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {community.location}</span>}
          </div>
          {community.description && <p className="text-stone-600 mt-3 max-w-2xl">{community.description}</p>}
        </div>
        {isMember ? (
          myMembership.role !== "owner" && (
            <Button variant="outline" onClick={leave} disabled={busy} className="rounded-xl">
              <LogOut className="w-4 h-4" /> Leave
            </Button>
          )
        ) : (
          <Button onClick={join} disabled={busy} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Join community
          </Button>
        )}
      </div>

      <Tabs defaultValue="discussions">
        <TabsList className="mb-6">
          <TabsTrigger value="discussions">Discussions</TabsTrigger>
          <TabsTrigger value="volunteer">Volunteer</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>
        <TabsContent value="discussions">
          <DiscussionsTab communityId={id} isMember={isMember} />
        </TabsContent>
        <TabsContent value="volunteer">
          <VolunteerTab community={community} isMember={isMember} canManage={canManage} />
        </TabsContent>
        <TabsContent value="members">
          <MembersTab members={members} />
        </TabsContent>
      </Tabs>
    </div>
  );
}