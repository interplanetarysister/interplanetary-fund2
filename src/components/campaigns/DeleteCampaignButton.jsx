import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

export default function DeleteCampaignButton({ campaign }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDelete = async () => {
    setBusy(true);
    try {
      await base44.functions.invoke("deleteCampaign", { campaign_id: campaign.id });
      toast({ title: "Campaign deleted", description: "Your campaign and its related data have been removed." });
      navigate("/dashboard", { replace: true });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not delete", description: "Please try again or contact support." });
    }
    setBusy(false);
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-stone-500 hover:text-red-600 hover:bg-red-50">
          <Trash2 className="w-4 h-4 mr-2" /> Delete campaign
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{campaign.title}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the campaign, its updates, posts, and agent activity. Financial records are preserved for audit. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting…</> : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}