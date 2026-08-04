import { useEffect } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  syncMediaNotifications,
  type AppNotification,
  type NotificationPreferences,
} from "@/lib/notifications.functions";
import { toast } from "sonner";
import { Bell, Check, RefreshCw, Trash } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
  head: () => ({
    meta: [
      { title: "Notifications — TomodachiTV" },
      {
        name: "description",
        content:
          "Your TomodachiTV notification center: new followers, new episodes and releases from your library.",
      },
      { property: "og:title", content: "Notifications — TomodachiTV" },
      {
        property: "og:description",
        content:
          "Manage your TomodachiTV alerts for followers, new episodes and upcoming releases.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PREF_ITEMS: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}[] = [
  {
    key: "follows",
    label: "New followers",
    description: "When someone starts following you.",
  },
  {
    key: "new_episodes",
    label: "New episodes",
    description: "When a new episode of a show in your library airs.",
  },
  {
    key: "new_releases",
    label: "New releases",
    description: "When a movie in your library comes out.",
  },
  {
    key: "moderation",
    label: "Moderation alerts",
    description: "When a moderator takes action on your content.",
  },
];

function NotificationsPage() {
  const qc = useQueryClient();
  const router = useRouter();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getMyNotifications(),
  });

  const { data: prefs } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => getNotificationPreferences(),
  });

  const syncMut = useMutation({
    mutationFn: () => syncMediaNotifications(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Refresh episode/release notifications at most once every 6 hours.
  useEffect(() => {
    const key = "tomodachi:last-notif-sync";
    const last = Number(localStorage.getItem(key) ?? 0);
    if (Date.now() - last > 6 * 60 * 60 * 1000) {
      localStorage.setItem(key, String(Date.now()));
      syncMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prefMut = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      updateNotificationPreferences({ data: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-prefs"] });
      toast.success("Preferences saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const readMut = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readAllMut = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteNotification({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = notifications.filter((n) => !n.read).length;

  const open = (n: AppNotification) => {
    if (!n.read) readMut.mutate(n.id);
    if (n.link) router.navigate({ to: n.link as never }).catch(() => {});
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Followers, new episodes and releases from your library.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`}
            />
            Check for updates
          </Button>
          {unread > 0 && (
            <Button size="sm" onClick={() => readAllMut.mutate()} disabled={readAllMut.isPending}>
              <Check className="mr-2 h-4 w-4" /> Mark all read
            </Button>
          )}
        </div>
      </header>

      <section className="mt-8 rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">Inbox</h2>
          {unread > 0 && <Badge variant="secondary">{unread} unread</Badge>}
        </div>
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Nothing here yet. New followers, episodes and releases will show up in this list.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((n) => (
              <li
                key={n.id}
                onClick={() => open(n)}
                className={`group flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-muted/50 ${
                  n.read ? "opacity-70" : "bg-primary/5"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  aria-label="Delete notification"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMut.mutate(n.id);
                  }}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h2 className="font-display text-lg font-semibold">What you want to receive</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Turn off anything you don't care about — it applies from now on.
          </p>
        </div>
        <ul className="divide-y divide-border">
          {PREF_ITEMS.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={prefs?.[item.key] ?? true}
                disabled={!prefs || prefMut.isPending}
                onCheckedChange={(checked) => prefMut.mutate({ [item.key]: checked })}
                aria-label={item.label}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
