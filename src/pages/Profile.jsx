import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, Link2, Zap, User, Loader2 } from "lucide-react";
import { CAPABILITY_MODULES } from "@/components/onboarding/onboardingSteps";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import MediaUpload from "@/components/media/MediaUpload";
import { FALLBACK_IMAGE } from "@/components/brand/brand";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);
      } catch {
        /* not authenticated */
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const onboarding = user?.onboarding || {};
  const selectedPlatforms = onboarding.platforms || [];
  const photoUrl = user?.photo_url || FALLBACK_IMAGE;

  const savePhoto = async (url) => {
    if (!url) return;
    await base44.auth.updateMe({ photo_url: url });
    setUser((u) => ({ ...u, photo_url: url }));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="flex items-center gap-2.5 font-display text-3xl text-stone-900 mb-1">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </span>
        Profile
      </h1>
      <p className="text-stone-500 mb-8">Your account, AI configuration, and connected platforms.</p>

      <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Account</p>
        <div className="flex items-center gap-4">
          <Image src={photoUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover shrink-0" />
          <div>
            <p className="font-display text-lg text-stone-900">{user?.full_name || "Unnamed user"}</p>
            <p className="text-sm text-stone-500">{user?.email}</p>
          </div>
        </div>
        <div className="mt-4">
          <MediaUpload
            value={user?.photo_url || ""}
            onChange={savePhoto}
            label="Upload profile photo"
            accept="image/*"
            previewClassName="hidden"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">
          <Sparkles className="w-3.5 h-3.5" /> AI Configuration
        </p>
        {onboarding.goal ? (
          <p className="text-sm text-stone-700">Fundraising focus: <span className="font-medium">{onboarding.goal}</span></p>
        ) : (
          <p className="text-sm text-stone-500">Not configured yet.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {onboarding.automation && Object.entries(onboarding.automation).filter(([, v]) => v).map(([k]) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary text-xs px-2 py-1">
              <Zap className="w-3 h-3" /> {k.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">
          <Link2 className="w-3.5 h-3.5" /> Connected Platforms
        </p>
        {selectedPlatforms.length === 0 ? (
          <p className="text-sm text-stone-500">No platforms selected. Connect from Mission Control.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedPlatforms.map((id) => {
              const label = CAPABILITY_MODULES.flatMap((g) => g.items).find((i) => i.id === id)?.label || id;
              return (
                <span key={id} className="rounded-md bg-stone-100 text-stone-700 text-xs px-2 py-1">{label}</span>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6">
        <Link to="/onboarding"><Button variant="outline" className="rounded-xl">Revisit setup</Button></Link>
      </div>
    </div>
  );
}