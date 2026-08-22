import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import WelcomeStep from "@/components/onboarding/WelcomeStep";
import ProfileStep from "@/components/onboarding/ProfileStep";
import EngineStep from "@/components/onboarding/EngineStep";
import ConnectStep from "@/components/onboarding/ConnectStep";
import AutomateStep from "@/components/onboarding/AutomateStep";
import CompleteStep from "@/components/onboarding/CompleteStep";
import { useToast } from "@/components/ui/use-toast";

const STEPS = [
  { id: "welcome", render: () => <WelcomeStep /> },
  { id: "profile", render: (d, set) => <ProfileStep data={d} onChange={set} /> },
  { id: "engine", render: () => <EngineStep /> },
  { id: "connect", render: (d, set) => <ConnectStep data={d} onChange={set} /> },
  { id: "automate", render: (d, set) => <AutomateStep data={d} onChange={set} /> },
  { id: "complete", render: (d) => <CompleteStep data={d} /> },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [current, setCurrent] = useState(0);
  const [data, setData] = useState({ full_name: "", platforms: [], automation: {} });
  const [saving, setSaving] = useState(false);

  const isLast = current === STEPS.length - 1;

  const finish = async () => {
    setSaving(true);
    try {
      const updates = {
        onboarding: {
          ...data,
          platforms: Array.isArray(data.platforms) ? data.platforms : [],
          automation: data.automation && typeof data.automation === "object" ? data.automation : {},
        },
        onboarding_completed: true,
      };
      if (data.full_name?.trim()) updates.full_name = data.full_name.trim();
      await base44.auth.updateMe(updates);
      navigate("/mission");
    } catch (e) {
      toast({ title: "Couldn't save setup", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const step = STEPS[current];

  return (
    <OnboardingShell
      steps={STEPS}
      current={current}
      isLast={isLast}
      onBack={() => setCurrent((c) => Math.max(0, c - 1))}
      onNext={() => setCurrent((c) => Math.min(STEPS.length - 1, c + 1))}
      onSkip={() => navigate("/")}
      onFinish={finish}
    >
      {saving ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-stone-300 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        step.render(data, setData)
      )}
    </OnboardingShell>
  );
}