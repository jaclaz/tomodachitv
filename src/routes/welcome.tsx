import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, CalendarDays, Compass, Heart, Import, Users } from "lucide-react";
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

const FEATURES = [
  { icon: CalendarDays, title: "Never miss an episode", text: "Track every episode, get notified on new releases and see your calendar." },
  { icon: Compass, title: "Discover smarter", text: "Personal picks from your taste, plus what's trending in your country." },
  { icon: Users, title: "Watch with friends", text: "Follow friends, browse their profiles and see what they're binging." },
  { icon: BarChart3, title: "Your stats", text: "Hours watched, rewatches, favourite genres and your most loved shows." },
  { icon: Heart, title: "Rate with onigiri", text: "Half-step ratings, favourites, lists and rewatch tracking." },
  { icon: Import, title: "Bring your history", text: "Import from Netflix, TV Time or a backup in a few clicks." },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="landing-blob absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="landing-blob absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-accent/20 blur-3xl [animation-delay:-6s]" />
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
          <Link to="/auth" className="rounded-full bg-primary px-7 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105">
            Get started — it's free
          </Link>
          <a href="#features" className="rounded-full border border-border px-7 py-3 font-semibold hover:bg-card">
            See features
          </a>
        </div>
      </section>

      <section id="features" className="relative mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="landing-in rounded-2xl border border-border bg-card/70 p-6 backdrop-blur transition-transform hover:-translate-y-1"
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
