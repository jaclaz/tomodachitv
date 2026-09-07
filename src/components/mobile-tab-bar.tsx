import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/app-sidebar";
import { AccountMenu } from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import { getMyProfile } from "@/lib/social.functions";
import { isCurrentUserAdmin } from "@/lib/reports.functions";
import {
  Compass,
  Flame,
  ListVideo,
  User,
  MoreHorizontal,
  CheckCircle2,
  CalendarDays,
  Users,
  BarChart3,
  Download,
  ShieldAlert,
  Settings2,
} from "lucide-react";

const itemClass =
  "flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium text-muted-foreground select-none transition-all duration-150 active:scale-95 active:text-primary/80 touch-manipulation";

const moreItems = [
  { to: "/watched", icon: CheckCircle2, label: "Watched" },
  { to: "/calendar", icon: CalendarDays, label: "Calendar" },
  { to: "/social", icon: Users, label: "Tomodachi" },
  { to: "/stats", icon: BarChart3, label: "Stats" },
  { to: "/import", icon: Download, label: "Import" },
] as const;

export function MobileTabBar() {
  const [moreOpen, setMoreOpen] = useState(false);

  const pathname = useRouterState({
    select: (router) => router.location.pathname,
  });

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

  const libraryActive = pathname === "/watchlist" || pathname === "/watched";
  const profileActive = profile
    ? pathname === `/u/${profile.username}`
    : false;

  const tileClass =
    "flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-card [&[data-status=active]]:border-primary/50 [&[data-status=active]]:text-primary";

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <Link
          to="/"
          activeOptions={{ exact: true }}
          className={`${itemClass} [&[data-status=active]]:text-primary`}
        >
          <Compass className="h-5 w-5" />
          Home
        </Link>

        <Link
          to="/trending"
          className={`${itemClass} [&[data-status=active]]:text-primary`}
        >
          <Flame className="h-5 w-5" />
          Trending
        </Link>

        <Link
          to="/watchlist"
          search={{ type: "tv" as const }}
          className={`${itemClass} ${libraryActive ? "text-primary" : ""}`}
        >
          <ListVideo className="h-5 w-5" />
          Library
        </Link>

        {profile ? (
          <Link
            to="/u/$username"
            params={{ username: profile.username }}
            className={`${itemClass} ${profileActive ? "text-primary" : ""}`}
          >
            {profile.avatar_url ? (
              <Avatar
                className={`h-5 w-5 ${profileActive ? "ring-2 ring-primary" : ""}`}
              >
                <AvatarImage src={profile.avatar_url} alt="" />
                <AvatarFallback className="text-[9px]">
                  {(profile.display_name ?? profile.username)
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <User className="h-5 w-5" />
            )}
            Profile
          </Link>
        ) : (
          <span className={`${itemClass} opacity-50`}>
            <User className="h-5 w-5" />
            Profile
          </span>
        )}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`${itemClass} hover:text-foreground`}
          aria-label="More"
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-t border-border bg-canvas p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="text-base">More</SheetTitle>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {moreItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={tileClass}
              >
                <item.icon className="h-5 w-5 text-primary" />
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin/reports"
                onClick={() => setMoreOpen(false)}
                className={tileClass}
              >
                <ShieldAlert className="h-5 w-5 text-primary" />
                Reports
              </Link>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-surface p-2 pl-3">
            <span className="text-sm text-muted-foreground">
              Notifications & settings
            </span>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <AccountMenu
                align="end"
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label="Settings"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
