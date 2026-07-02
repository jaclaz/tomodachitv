import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Compass,
  Flame,
  ListVideo,
  BarChart3,
  LogOut,
  Menu,
  Play,
} from "lucide-react";

const navItems = [
  { to: "/", icon: Compass, label: "Esplora" },
  { to: "/trending", icon: Flame, label: "In Tendenza" },
  { to: "/watchlist", icon: ListVideo, label: "La Mia Lista" },
  { to: "/statistiche", icon: BarChart3, label: "Statistiche" },
];

export function AppSidebar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    await router.navigate({ to: "/auth" });
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <span className="font-display text-lg font-bold">L</span>
        </div>
        <span className="font-display text-xl font-bold tracking-tight">LUME</span>
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

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prossimo episodio
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Play className="h-5 w-5 fill-current" />
            </div>
            <div>
              <p className="text-sm font-medium">Inizia a guardare</p>
              <p className="text-xs text-muted-foreground">
                Aggiungi serie alla tua lista
              </p>
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Esci
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
              <span className="sr-only">Apri menu</span>
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
