import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

export default function OnboardingShell({ steps, current, onNext, onBack, children, onFinish, isLast }) {
  const progress = ((current + 1) / steps.length) * 100;
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display text-lg text-stone-900">Crowdfund Setup</span>
            <span className="text-xs text-stone-500">{current + 1} / {steps.length}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-stone-200 overflow-hidden">
            <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-center px-6 py-8">
        <div className="max-w-2xl mx-auto w-full">{children}</div>
      </main>
      <footer className="px-6 pb-8">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} disabled={current === 0} className="rounded-xl">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          {isLast ? (
            <Button onClick={onFinish} className="bg-orange-600 hover:bg-orange-500 text-white rounded-xl">
              <Sparkles className="w-4 h-4" /> Enter Mission Control
            </Button>
          ) : (
            <Button onClick={onNext} className="bg-orange-600 hover:bg-orange-500 text-white rounded-xl">
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}