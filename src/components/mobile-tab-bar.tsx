import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarPanel } from "@/components/app-sidebar";
import { getMyProfile } from "@/lib/social.functions";
import { Compass, Flame, ListVideo, User, MoreHorizontal } from "lucide-react";

const itemClass =
  "flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors";

export function MobileTabBar() {
  const [moreOpen, setMoreOpen] = useState(false);

  const pathname = useRouterState({
    select: (router) => router.location.pathname,
  });

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyProfile(),
  });

  const libraryActive = pathname === "/watchlist" || pathname === "/watched";
  const profileActive = profile
    ? pathname === `/u/${profile.username}`
    : false;

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
            <User className="h-5 w-5" />
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
          className="h-[85vh] border-t border-border p-0"
        >
          <SheetTitle className="sr-only">More navigation</SheetTitle>
          <SidebarPanel onNavigate={() => setMoreOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
