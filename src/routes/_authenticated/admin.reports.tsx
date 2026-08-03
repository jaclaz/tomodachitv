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
import { Loader2, ShieldAlert, ExternalLink, Trash2, Check, X } from "lucide-react";

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

type StatusFilter = "pending" | "reviewed" | "dismissed" | "all";

function AdminReportsPage() {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["admin-reports", status],
    queryFn: () => listProfileReports({ data: { status } }),
  });

  const resolveMut = useMutation({
    mutationFn: (vars: { id: string; status: "reviewed" | "dismissed" }) =>
      resolveProfileReport({ data: vars }),
    onSuccess: () => {
      toast.success("Report updated");
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearMut = useMutation({
    mutationFn: (user_id: string) => clearReportedProfileImages({ data: { user_id } }),
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

      <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
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
                  onResolve={(s) => resolveMut.mutate({ id: r.id, status: s })}
                  onClear={() => clearMut.mutate(r.reported_user_id)}
                  busy={resolveMut.isPending || clearMut.isPending}
                />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportCard({
  report,
  onResolve,
  onClear,
  busy,
}: {
  report: AdminReport;
  onResolve: (status: "reviewed" | "dismissed") => void;
  onClear: () => void;
  busy: boolean;
}) {
  const displayName =
    report.reported_display_name ?? report.reported_username ?? report.reported_user_id;
  const initials = (report.reported_display_name ?? report.reported_username ?? "?")
    .slice(0, 2)
    .toUpperCase();

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
            <Badge variant="outline">{report.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(report.created_at).toLocaleString()} · reporter:{" "}
            {report.reporter_display_name ?? report.reporter_username ?? report.reporter_id}
          </p>
          {report.details && (
            <p className="rounded-md bg-muted p-2 text-sm text-foreground/90">{report.details}</p>
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
            title="Clear the user's avatar and banner"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear images
          </Button>
          <Button size="sm" onClick={() => onResolve("reviewed")} disabled={busy}>
            <Check className="mr-1 h-3.5 w-3.5" /> Mark reviewed
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onResolve("dismissed")} disabled={busy}>
            <X className="mr-1 h-3.5 w-3.5" /> Dismiss
          </Button>
        </div>
      )}
    </li>
  );
}
