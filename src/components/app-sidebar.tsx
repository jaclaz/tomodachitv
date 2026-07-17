import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Youtube,
  ShieldAlert,
  MoreVertical,
  Trash2,
  Pencil,
} from "lucide-react";
import { EditProfileDialog } from "@/components/edit-profile-dialog";


const navItems = [
  { to: "/", icon: Compass, label: "Home" },
  { to: "/trending", icon: Flame, label: "Trending" },
  { to: "/watchlist", icon: ListVideo, label: "Watchlist" },
  { to: "/watched", icon: CheckCircle2, label: "Watched" },
  { to: "/calendar", icon: CalendarDays, label: "Calendar" },
  { to: "/youtube", icon: Youtube, label: "YouTube" },
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
    </>
  );
}
