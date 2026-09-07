import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { getMyProfile } from "@/lib/social.functions";
import { isCurrentUserAdmin } from "@/lib/reports.functions";
import { deleteMyAccount } from "@/lib/account.functions";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type AppNotification,
} from "@/lib/notifications.functions";
import { toast } from "sonner";
import logoUrl from "@/assets/onigiri-logo.svg";
import {
  Compass,
  Flame,
  ListVideo,
  BarChart3,
  Users,
  LogOut,
  Menu,
  Download,
  CheckCircle2,
  CalendarDays,
  ShieldAlert,
  MoreVertical,
  Trash2,
  Pencil,
  Bell,
  BellDot,
  Check,
  Trash,
  Settings2,

} from "lucide-react";
import { EditProfileDialog } from "@/components/edit-profile-dialog";
import { lovable } from "@/integrations/lovable/index";

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

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
  const [confirmLogout, setConfirmLogout] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const router = useRouter();
  const qc = useQueryClient();

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

  const { data: googleLinked, refetch: refetchIdentities } = useQuery({
    queryKey: ["google-identity"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return (
        data.user?.identities?.some((i) => i.provider === "google") ?? false
      );
    },
    staleTime: 60_000,
  });

  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const handleConnectGoogle = async () => {
    setLinkingGoogle(true);
    try {
      const { data: before } = await supabase.auth.getSession();
      const previousSession = before.session;
      const previousUserId = previousSession?.user.id ?? null;

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      if (result.redirected) return;

      const { data: after } = await supabase.auth.getUser();
      const newUserId = after.user?.id ?? null;

      if (previousUserId && newUserId && newUserId !== previousUserId) {
        // Different Google email → Supabase signed us into another account.
        // Restore the original session instead of silently switching users.
        if (previousSession) {
          await supabase.auth.setSession({
            access_token: previousSession.access_token,
            refresh_token: previousSession.refresh_token,
          });
        } else {
          await supabase.auth.signOut();
        }
        toast.error(
          "That Google account uses a different email. Sign in with the Google account that matches your TomodachiTV email to link it.",
        );
        return;
      }

      await refetchIdentities();
      await qc.invalidateQueries();
      toast.success("Google account connected");
    } finally {
      setLinkingGoogle(false);
    }
  };


  const handleLogout = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await router.navigate({ to: "/auth", replace: true });
  };

  const deleteMut = useMutation({
    mutationFn: () => deleteMyAccount(),
    onSuccess: async () => {
      toast.success("Account deleted");
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      await router.navigate({ to: "/auth", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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



function NotificationBell() {
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
