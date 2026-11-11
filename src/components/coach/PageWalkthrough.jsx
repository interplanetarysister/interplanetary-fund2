import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import CoachMarks from "./CoachMarks";
import { coachTours } from "./coachTours";
import { pageTips } from "./pageTips";

export default function PageWalkthrough() {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const page = location.pathname.split("/").filter(Boolean)[0] || "home";
  const tour = useMemo(() => {
    if (coachTours[page]?.steps.length >= 3) return coachTours[page];
    const title = page.replace(/-/g, " ");
    const tips = pageTips[page]?.items || [
      `Welcome to ${title}. Start by reading the page heading and current status.`,
      "Use the available controls to view details or choose your next action. If something is unavailable, check its status before continuing.",
      "Review any changes before confirming. Use the navigation to return to your dashboard or open Help for more guidance.",
    ];
    return { name: `${title} walkthrough`, steps: Array.from({ length: Math.max(3, tips.length) }, (_, i) => ({
      title: i === 0 ? `Explore ${title}` : i === 1 ? "Choose your next step" : "Review and continue",
      body: tips[i] || "You can revisit this page anytime from the navigation.",
    })) };
  }, [page]);
  if (!isAuthenticated || user?.email?.toLowerCase() !== "user@interplanetaryfund.com") return null;
  return <CoachMarks key={location.key + location.pathname} tourId={`page:${location.pathname}`} tour={tour} repeatOnVisit />;
}
