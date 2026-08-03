import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listProfileReports,
  resolveProfileReport,
  clearReportedProfileImages,
  isCurrentUserAdmin,
  getAdminStats,
  type AdminReport,
} from "@/lib/reports.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, ShieldAlert, ExternalLink, Trash2, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

function AdminStatsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getAdminStats(),
    staleTime: 60_000,
  });

  const cards: { label: string; value: number }[] = data
    ? [
        { label: "Users", value: data.totalUsers },
        { label: "New (7d)", value: data.newUsers7d },
        { label: "New (30d)", value: data.newUsers30d },
        { label: "Active (7d)", value: data.activeUsers7d },
        { label: "Shows tracked", value: data.totalShowsTracked },
        { label: "Movies tracked", value: data.totalMoviesTracked },
        { label: "Episodes watched", value: data.watchedEpisodes },
        { label: "Movies watched", value: data.watchedMovies },
        { label: "Lists", value: data.totalLists },
        { label: "Follows", value: data.totalFollows },
        { label: "Pending reports", value: data.pendingReports },
      ]
    : [];

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold">Overview</h2>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading stats…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {c.label}
              </p>
              <p className="mt-1 font-display text-2xl font-bold">
                {c.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Aggregated counts only — no personal data is shown here. Page-view
        analytics are not collected by the app.
      </p>
    </section>
  );
}

export const Route = createFileRoute("/_authenticated/admin/reports")({
  beforeLoad: async () => {
    try {
      const { admin } = await isCurrentUserAdmin();
      if (!admin) throw redirect({ to: "/" });
    } catch {
      throw redirect({ to: "/" });
    }
  },
  component: AdminReportsPage,
  head: () => ({
    meta: [{ title: "Reports · Admin" }],
  }),
});

type StatusFilter = "pending" | "actioned" | "dismissed" | "all";

function AdminReportsPage() {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [warnDialog, setWarnDialog] = useState<AdminReport | null>(null);
  const [warnMessage, setWarnMessage] = useState("");
  const [dismissConfirm, setDismissConfirm] = useState<AdminReport | null>(null);
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["admin-reports", status],
    queryFn: () => listProfileReports({ data: { status } }),
  });

  const resolveMut = useMutation({
    mutationFn: (vars: { id: string; resolution: "actioned" | "dismissed"; admin_notes?: string; notify_message?: string }) =>
      resolveProfileReport({ data: vars }),
    onSuccess: () => {
      toast.success("Report updated");
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      setWarnDialog(null);
      setWarnMessage("");
      setDismissConfirm(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearMut = useMutation({
    mutationFn: (vars: { user_id: string; report_id: string }) => clearReportedProfileImages({ data: vars }),
    onSuccess: () => {
      toast.success("Profile images cleared");
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold">Profile reports</h1>
          <p className="text-sm text-muted-foreground">
            Review user and auto-moderation reports.
          </p>
        </div>
      </header>

      <AdminStatsPanel />

      <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="actioned">Warned</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={status} className="mt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading reports…
            </div>
          ) : reports.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No reports here.
            </p>
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  onWarn={() => setWarnDialog(r)}
                  onDismiss={() => setDismissConfirm(r)}
                  onClear={() => clearMut.mutate({ user_id: r.reported_user_id, report_id: r.id })}
                  busy={resolveMut.isPending || clearMut.isPending}
                />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!warnDialog} onOpenChange={(open) => !open && setWarnDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Warn reported user
            </DialogTitle>
            <DialogDescription>
              The reported user will receive an in-app notification. Use the box below to add a custom message (optional).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="warn-message" className="text-sm font-medium">
              Custom message
            </label>
            <Textarea
              id="warn-message"
              value={warnMessage}
              onChange={(e) => setWarnMessage(e.target.value.slice(0, 500))}
              placeholder="Explain what was wrong and what they should change."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">{warnMessage.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWarnDialog(null)} disabled={resolveMut.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                warnDialog &&
                resolveMut.mutate({
                  id: warnDialog.id,
                  resolution: "actioned",
                  notify_message: warnMessage.trim() || undefined,
                })
              }
              disabled={resolveMut.isPending}
            >
              {resolveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Warn user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!dismissConfirm} onOpenChange={(open) => !open && setDismissConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss report?</AlertDialogTitle>
            <AlertDialogDescription>
              This means the reported content is acceptable and no action will be taken. The user will not be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDismissConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                dismissConfirm &&
                resolveMut.mutate({ id: dismissConfirm.id, resolution: "dismissed" })
              }
              disabled={resolveMut.isPending}
            >
              {resolveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReportCard({
  report,
  onWarn,
  onDismiss,
  onClear,
  busy,
}: {
  report: AdminReport;
  onWarn: () => void;
  onDismiss: () => void;
  onClear: () => void;
  busy: boolean;
}) {
  const displayName =
    report.reported_display_name ?? report.reported_username ?? report.reported_user_id;
  const initials = (report.reported_display_name ?? report.reported_username ?? "?")
    .slice(0, 2)
    .toUpperCase();

  const statusBadge =
    report.status === "actioned" ? (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> Warned
      </Badge>
    ) : report.status === "dismissed" ? (
      <Badge variant="outline" className="gap-1">
        <CheckCircle className="h-3 w-3" /> Dismissed
      </Badge>
    ) : (
      <Badge variant="secondary">Pending</Badge>
    );

  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar className="h-14 w-14">
          <AvatarImage src={report.reported_avatar_url ?? undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{displayName}</p>
            {report.reported_username && (
              <Link
                to="/u/$username"
                params={{ username: report.reported_username }}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                @{report.reported_username} <ExternalLink className="h-3 w-3" />
              </Link>
            )}
            <Badge variant={report.source === "auto_moderation" ? "destructive" : "secondary"}>
              {report.source === "auto_moderation" ? "auto" : "user"}
            </Badge>
            <Badge variant="outline">{report.reason}</Badge>
            {statusBadge}
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(report.created_at).toLocaleString()} · reporter:{" "}
            {report.reporter_display_name ?? report.reporter_username ?? report.reporter_id}
          </p>
          {report.details && (
            <p className="rounded-md bg-muted p-2 text-sm text-foreground/90">{report.details}</p>
          )}
          {report.admin_notes && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Admin note:</span> {report.admin_notes}
            </p>
          )}
          {report.reported_banner_url && (
            <img
              src={report.reported_banner_url}
              alt="Reported banner"
              className="mt-2 h-24 w-full max-w-md rounded-md object-cover"
            />
          )}
        </div>
      </div>
      {report.status === "pending" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={onClear}
            disabled={busy}
            title="Clear the user's avatar and banner and warn them"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear images
          </Button>
          <Button size="sm" variant="destructive" onClick={onWarn} disabled={busy}>
            <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Warn user
          </Button>
          <Button size="sm" variant="secondary" onClick={onDismiss} disabled={busy}>
            <XCircle className="mr-1 h-3.5 w-3.5" /> Dismiss
          </Button>
        </div>
      )}
    </li>
  );
}
