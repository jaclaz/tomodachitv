import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMyProfile } from "@/lib/social.functions";
import logoUrl from "@/assets/logo.png";
import {
  Compass,
  Flame,
  ListVideo,
  BarChart3,
  Users,
  LogOut,
  Menu,
} from "lucide-react";

const navItems = [
  { to: "/", icon: Compass, label: "Home" },
  { to: "/trending", icon: Flame, label: "Trending" },
  { to: "/watchlist", icon: ListVideo, label: "Watchlist" },
  { to: "/social", icon: Users, label: "Social" },
  { to: "/stats", icon: BarChart3, label: "Stats" },
] as const;


export function AppSidebar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyProfile(),
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    await router.navigate({ to: "/auth" });
  };

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
        </nav>

        <Separator className="my-4 bg-border" />

        {profile && (
          <Link
            to="/u/$username"
            params={{ username: profile.username }}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-card"
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
        )}
      </ScrollArea>

      <div className="border-t border-border p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </Button>
      </div>
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
    </>
  );
}
