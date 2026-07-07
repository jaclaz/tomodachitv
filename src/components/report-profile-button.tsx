import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createProfileReport, type ReportReason } from "@/lib/reports.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: "explicit_image", label: "Explicit or inappropriate image" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate_speech", label: "Hate speech or symbols" },
  { value: "spam", label: "Spam or scam" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
];

interface ReportProfileButtonProps {
  reportedUserId: string;
  username: string;
}

export function ReportProfileButton({ reportedUserId, username }: ReportProfileButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("explicit_image");
  const [details, setDetails] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createProfileReport({
        data: {
          reported_user_id: reportedUserId,
          reason,
          details: details.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Report submitted. Our team will review it.");
      setOpen(false);
      setDetails("");
      setReason("explicit_image");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Report @${username}`}
          title={`Report @${username}`}
        >
          <Flag className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report @{username}</DialogTitle>
          <DialogDescription>
            Let us know what's wrong. Reports are reviewed by moderators.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="report-reason">Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
              <SelectTrigger id="report-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-details">Details (optional)</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 500))}
              placeholder="Add any context that helps us understand the issue."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">{details.length}/500</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
