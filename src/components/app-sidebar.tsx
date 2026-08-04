import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
import logoUrl from "@/assets/logo.png";
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
} from "lucide-react";
import { EditProfileDialog } from "@/components/edit-profile-dialog";

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

export function AppSidebar() {
  const [open, setOpen] = useState(false);
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
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground [&[data-status=active]]:bg-primary/10 [&[data-status=active]]:text-primary"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/admin/reports"
              onClick={() => setOpen(false)}
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
              onClick={() => setOpen(false)}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Account menu"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer">
                  <Pencil className="mr-2 h-4 w-4" /> Edit profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setConfirmLogout(true)} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <div className="fixed left-4 top-4 z-50 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-surface">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-r border-border p-0">
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-border bg-canvas lg:block">
        {sidebarContent}
      </aside>

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out of your account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your profile, lists, watch history, follows and
              everything else tied to your account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? "Deleting..." : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {profile && (
        <EditProfileDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          currentDisplayName={profile.display_name}
          currentUsername={profile.username}
        />
      )}
    </>
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
      </PopoverContent>
    </Popover>
  );
}
