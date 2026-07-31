import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ServiceHealthPanel from "@/components/platform/ServiceHealthPanel";
import FeatureFlagsPanel from "@/components/platform/FeatureFlagsPanel";
import TimelinePanel from "@/components/platform/TimelinePanel";
import KnowledgePanel from "@/components/platform/KnowledgePanel";
import { Loader2, ShieldAlert } from "lucide-react";

export default function Platform() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  if (!user) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>;
  }

  if (user.role !== "admin") {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-6">
        <ShieldAlert className="w-10 h-10 text-stone-300 mx-auto" />
        <h1 className="font-display text-2xl text-stone-900 mt-4">Administrators only</h1>
        <p className="text-stone-500 mt-2">The platform foundation console is restricted to platform administrators.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="font-display text-3xl sm:text-4xl text-stone-900">Platform Foundation</h1>
      <p className="text-stone-500 mt-1 mb-6">
        Service health, configuration, audit history, and engineering knowledge.
      </p>

      <Tabs defaultValue="health">
        <TabsList className="mb-6">
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
        </TabsList>
        <TabsContent value="health"><ServiceHealthPanel /></TabsContent>
        <TabsContent value="config"><FeatureFlagsPanel /></TabsContent>
        <TabsContent value="timeline"><TimelinePanel /></TabsContent>
        <TabsContent value="knowledge"><KnowledgePanel /></TabsContent>
      </Tabs>
    </div>
  );
}