import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  Compass,
  Heart,
  Import,
  LogIn,
  Users,
} from "lucide-react";
import logo from "@/assets/onigiri-logo.svg";

const TITLE = "TomodachiTV — Track every show and movie with friends";
const DESC =
  "Track what you watch, get smart recommendations, see what's trending in your country, follow friends and import your Netflix or TV Time history.";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

// ============ Showcase imagery (public TMDB metadata) ============
const IMG = "https://image.tmdb.org/t/p";
const posterSrc = (path: string) => `${IMG}/w185${path}`;
const backdropSrc = (path: string) => `${IMG}/w1280${path}`;

interface Showcase {
  posters: string[];
  backdrops: string[];
}

// Seed list so the page looks right before the live feed arrives (and if it fails).
const SEED: Showcase = {
  posters: [
    "/sJZcy8QsOPuRPiCfoCWVB3r9Ohg.jpg",
    "/zPHfsaiMZT1HNz1ZS55iyLKZkFG.jpg",
    "/9l1NuFjel2j89hiuiJbsxfblqjy.jpg",
    "/h6Z2oogE4mJk2uffdtIlLhb0EHx.jpg",
    "/v3JuB15WybKmxDeT1hWdK3j6eSJ.jpg",
    "/xyFAzP7RKK8cARCSalIZ9A9T0jV.jpg",
    "/d43fvHQsIMa4kpyhKXw0haEJIvI.jpg",
    "/sLYCyO58UvBuBtbHTQjPCCgJ4dG.jpg",
    "/2EewmxXe72ogD0EaWM8gqa0ccIw.jpg",
    "/bjiS5ipwxb9JFy3XRRN4OAilSeX.jpg",
    "/6mUMquPQBFJGqTACS3Azkwwrx8d.jpg",
    "/3ENhExiD2fcjk5FX0AcAXcvLu9N.jpg",
  ],
  backdrops: [
    "/gffVOVZ2Y9cmVIZ26Gt9ByMGCYH.jpg",
    "/aY7zv2pfk9H0QxaaL3PBjvalbKQ.jpg",
    "/4NmCfWHzytiKM3riCMcbVYBJhlB.jpg",
    "/i5E9H7Ik0u61ylDDTbmUpTL3Yw.jpg",
    "/2qS2LGqsAyT1NEDeIj24Hp2IR10.jpg",
  ],
};

function useShowcase() {
  const [showcase, setShowcase] = useState<Showcase>(SEED);

  useEffect(() => {
    let alive = true;
    fetch("/api/public/showcase")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Array<{ poster_path: string; backdrop_path: string }>) => {
        if (!alive || !Array.isArray(rows) || rows.length < 6) return;
        setShowcase({
          posters: rows.map((r) => r.poster_path).filter(Boolean),
          backdrops: rows.map((r) => r.backdrop_path).filter(Boolean).slice(0, 5),
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return showcase;
}

// ============ Background layers ============
function BackdropRotator({ paths }: { paths: string[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {paths.map((path, i) => (
        <img
          key={path}
          src={backdropSrc(path)}
          alt=""
          loading={i === 0 ? "eager" : "lazy"}
          className="landing-crossfade absolute inset-0 h-full w-full object-cover opacity-0"
          style={{ animationDelay: `${-i * 8}s` }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/85 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_10%,var(--background)_85%)]" />
    </div>
  );
}

function PosterWall({ paths }: { paths: string[] }) {
  const tiles = Array.from({ length: 40 }, (_, i) => paths[i % paths.length]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -inset-32 grid grid-cols-8 gap-3 opacity-[0.14] blur-[1px]"
        style={{ transform: "scale(1.25) rotate(-6deg)" }}
      >
        {tiles.map((path, i) => (
          <img
            key={`${path}-${i}`}
            src={posterSrc(path)}
            alt=""
            loading="lazy"
            className="h-full w-full rounded-md object-cover"
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-background/60" />
    </div>
  );
}

// ============ Content ============
const FEATURES = [
  {
    icon: Import,
    title: "Bring your history",
    text: "Drop a Netflix CSV, a TV Time export or a Tomodachi backup — we match every title for you, in any language.",
  },
  {
    icon: CalendarDays,
    title: "Never miss an episode",
    text: "Track every episode, get notified on new releases and see your calendar.",
  },
  {
    icon: Compass,
    title: "Discover smarter",
    text: "Personal picks from your taste, plus what's trending in your country.",
  },
  {
    icon: Users,
    title: "Watch with friends",
    text: "Follow friends, browse their profiles and see what they're binging.",
  },
  {
    icon: BarChart3,
    title: "Your stats",
    text: "Hours watched, rewatches, favourite genres and your most loved shows.",
  },
  {
    icon: Heart,
    title: "Rate with onigiri",
    text: "Half-step ratings, favourites, lists and rewatch tracking.",
  },
];

const SOURCES = ["TV Time", "Netflix", "Tomodachi backup"];

function Landing() {
  const showcase = useShowcase();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <BackdropRotator paths={showcase.backdrops} />
      <PosterWall paths={showcase.posters} />

      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="landing-blob absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="landing-blob absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-accent/15 blur-3xl [animation-delay:-6s]" />
      </div>

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <img src={logo} alt="" className="h-8 w-8" /> TomodachiTV
        </div>
        <Link to="/auth" className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-card">
          Sign in
        </Link>
      </header>

      <section className="relative mx-auto max-w-4xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <img src={logo} alt="TomodachiTV onigiri" className="landing-float mx-auto mb-8 h-24 w-24 sm:h-28 sm:w-28" />
        <h1 className="landing-in font-display text-4xl font-extrabold leading-tight sm:text-6xl">
          Every show. Every movie.<br />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Shared with friends.</span>
        </h1>
        <p className="landing-in mx-auto mt-6 max-w-xl text-lg text-muted-foreground [animation-delay:150ms]">
          TomodachiTV keeps track of what you watch, tells you what's next and shows you what your friends love.
        </p>
        <div className="landing-in mt-10 flex flex-wrap justify-center gap-3 [animation-delay:300ms]">
          <Link
            to="/auth"
            className="flex items-center gap-2 rounded-full bg-primary px-7 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105"
          >
            <Import className="h-4 w-4" />
            Import your TV Time or Netflix history
          </Link>
          <a href="#features" className="rounded-full border border-border px-7 py-3 font-semibold hover:bg-card">
            See features
          </a>
        </div>
        <p className="landing-in mx-auto mt-4 max-w-md text-sm text-foreground/75 [animation-delay:400ms]">
          Just drop the export file — titles get matched automatically, no manual typing.
        </p>
        <div className="landing-in mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs font-medium uppercase tracking-wider text-foreground/60 [animation-delay:450ms]">
          {SOURCES.map((s, i) => (
            <span key={s} className="flex items-center gap-3">
              {i > 0 && <span className="h-1 w-1 rounded-full bg-border" />}
              {s}
            </span>
          ))}
        </div>
      </section>

      <section id="features" className="relative mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="landing-in rounded-2xl border border-border bg-card/80 p-6 backdrop-blur transition-transform hover:-translate-y-1"
            style={{ animationDelay: `${400 + i * 90}ms` }}
          >
            <f.icon className="mb-4 h-8 w-8 text-primary" />
            <h2 className="font-display text-lg font-bold">{f.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="relative border-t border-border py-8 text-center text-xs text-muted-foreground">
        Data from TMDB and JustWatch · © TomodachiTV
      </footer>
    </div>
  );
}
