import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getPersonDetails,
  getPersonCredits,
  profileUrl,
  type PersonCreditItem,
} from "@/lib/tmdb";
import { MediaCard } from "@/components/media-card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/person/$id")({
  component: PersonDetailPage,
});

function PersonDetailPage() {
  const { id } = Route.useParams();
  const personId = Number(id);

  const { data: person, isLoading } = useQuery({
    queryKey: ["person", personId],
    queryFn: () => getPersonDetails({ data: { id: personId } }),
    enabled: !isNaN(personId),
  });

  const { data: credits } = useQuery({
    queryKey: ["person-credits", personId],
    queryFn: () => getPersonCredits({ data: { id: personId } }),
    enabled: !isNaN(personId),
  });

  if (isLoading || !person) {
    return (
      <div className="space-y-6 pt-12 sm:pt-0">
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  // Deduplicate credits by id+media_type and sort by popularity proxy (vote_average, release_date desc)
  const all: PersonCreditItem[] = [...(credits?.cast ?? []), ...(credits?.crew ?? [])];
  const seen = new Set<string>();
  const unique = all.filter((c) => {
    const key = `${c.media_type}-${c.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => {
    const ay = a.release_date ? new Date(a.release_date).getTime() : 0;
    const by = b.release_date ? new Date(b.release_date).getTime() : 0;
    return by - ay;
  });

  const profile = profileUrl(person.profile_path, "h632");

  return (
    <div className="space-y-8 pt-12 sm:pt-0">
      <Button variant="ghost" asChild className="-ml-2 gap-2 text-muted-foreground">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </Button>

      <section className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:p-8">
        <div className="w-40 flex-shrink-0 sm:w-52">
          <div className="aspect-[2/3] overflow-hidden rounded-xl border border-border bg-muted">
            {profile ? (
              <img src={profile} alt={person.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-display text-3xl font-bold text-muted-foreground">
                  {person.name.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {person.name}
          </h1>
          {person.known_for_department && (
            <p className="text-sm text-muted-foreground">
              Known for {person.known_for_department}
            </p>
          )}
          {(person.birthday || person.place_of_birth) && (
            <p className="text-sm text-muted-foreground">
              {person.birthday && <>Born {person.birthday}</>}
              {person.place_of_birth && <> · {person.place_of_birth}</>}
            </p>
          )}
          {person.biography && (
            <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {person.biography}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Filmography
        </h2>
        {unique.length === 0 ? (
          <p className="text-sm text-muted-foreground">No credits available.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {unique.map((item) => (
              <MediaCard key={`${item.media_type}-${item.id}`} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
