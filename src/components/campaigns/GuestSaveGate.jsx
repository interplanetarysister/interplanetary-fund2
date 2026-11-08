import React from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, Users } from "lucide-react";

// Guests can build a full campaign without an account. Only saving, launching,
// and account-backed AI work need one — this gate routes them to sign up or to
// the founding waitlist instead of silently failing.
const COPY = {
  save: {
    title: "Create an account to save this campaign",
    body: "You can build and preview everything as a guest. Saving a private draft needs a free account — or join the founding waitlist and we'll invite you in early.",
  },
  launch: {
    title: "Create an account to launch this campaign",
    body: "Campaigns go live from a real account so donations and payouts reach the right person. Create a free account, or join the founding waitlist for early access.",
  },
  image: {
    title: "Create an account for AI campaign art",
    body: "AI cover art is generated on your own account. Create a free account, or join the founding waitlist for early access.",
  },
};

export default function GuestSaveGate({ open, onOpenChange, intent = "save" }) {
  const navigate = useNavigate();
  const copy = COPY[intent] || COPY.save;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{copy.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">{copy.body}</DialogDescription>
        </DialogHeader>
        <p className="rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Your work on this page is not saved yet. Keep this tab open while you decide.
        </p>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full min-h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white"
            onClick={() => navigate(`/register?returnTo=${encodeURIComponent("/create")}`)}
          >
            <UserPlus className="w-4 h-4" /> Create a free account
          </Button>
          <Button type="button" variant="outline" className="w-full min-h-12 rounded-xl" onClick={() => navigate("/founding-members")}>
            <Users className="w-4 h-4" /> Join the founding waitlist
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Keep exploring without an account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}