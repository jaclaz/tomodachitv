import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getMyProfile } from "@/lib/social.functions";
import { isCurrentUserAdmin } from "@/lib/reports.functions";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type AppNotification,
} from "@/lib/notifications.functions";
import logoUrl from "@/assets/onigiri-logo.svg";
import {
  Compass,
  Flame,
  ListVideo,
  BarChart3,
  Users,
  Download,
  CheckCircle2,
  CalendarDays,
  ShieldAlert,
  Bell,
  BellDot,
  Check,
  Trash,
  Settings2,
} from "lucide-react";
import { AccountMenu } from "@/components/account-menu";


const navItems = [
  { to: "/", icon: Compass, label: "Home" },
  { to: "/trending", icon: Flame, label: "Trending" },
  { to: "/watchlist", icon: ListVideo, label: "Watchlist" },
  { to: "/watched", icon: CheckCircle2, label: "Watched" },
  { to: "/calendar", icon: CalendarDays, label: "Calendar" },
  { to: "/social", icon: Users, label: "Tomodachi" },
  { to: "/stats", icon: BarChart3, label: "Stats" },
  { to: "/import", icon: Download, label: "Import" },
] as const;

export function SidebarPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyProfile(),
  });

  const { data: adminInfo } = useQuery({
    queryKey: ["me-admin"],
    queryFn: () => isCurrentUserAdmin(),
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = adminInfo?.admin ?? false;


  const sidebarContent = (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex h-16 items-center gap-3 px-6">
        <img
          src={logoUrl}
          alt="TomodachiTV logo"
          width={36}
          height={36}
          className="h-9 w-9"
        />
        <span className="font-display text-xl font-bold tracking-tight">TomodachiTV</span>
      </div>

      <ScrollArea className="flex-1 px-4">
        <nav className="flex flex-col gap-1 py-4">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              onClick={() => onNavigate?.()}

              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground [&[data-status=active]]:bg-primary/10 [&[data-status=active]]:text-primary"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/admin/reports"
              onClick={() => onNavigate?.()}

              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground [&[data-status=active]]:bg-primary/10 [&[data-status=active]]:text-primary"
            >
              <ShieldAlert className="h-5 w-5" />
              Reports
            </Link>
          )}
        </nav>
      </ScrollArea>

      {profile && (
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2 pr-1">
            <Link
              to="/u/$username"
              params={{ username: profile.username }}
              onClick={() => onNavigate?.()}

              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 transition-colors hover:bg-card"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback>
                  {(profile.display_name ?? profile.username).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {profile.display_name ?? profile.username}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{profile.username}
                </p>
              </div>
            </Link>
            <NotificationBell />
            <AccountMenu />

          </div>
        </div>
      )}
    </div>
  );

  return sidebarContent;
}


export function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-border bg-canvas lg:block">
      <SidebarPanel />
    </aside>
  );
}



export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getMyNotifications(),
    staleTime: 30_000,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasUnread = unreadCount > 0;

  const readMut = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readAllMut = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteNotification({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleClick = (n: AppNotification) => {
    if (!n.read) readMut.mutate(n.id);
    if (n.link) {
      router.navigate({ to: n.link as any }).catch(() => {});
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          {hasUnread ? (
            <BellDot className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {hasUnread && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <p className="font-semibold">Notifications</p>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => readAllMut.mutate()}
              disabled={readAllMut.isPending}
              className="h-8 text-xs"
            >
              <Check className="mr-1 h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-72">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`group flex cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-muted/50 ${
                    n.read ? "opacity-70" : "bg-primary/5"
                  }`}
                  onClick={() => handleClick(n)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMut.mutate(n.id);
                    }}
                    aria-label="Delete notification"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t border-border p-2">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings2 className="h-4 w-4" /> Notification center
          </Link>
        </div>
      </PopoverContent>

    </Popover>
  );
}
