import { useEffect, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { HeroSection } from "@/components/hero-section";
import { Button } from "@/components/ui/button";
import { Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getHomeHighlights, type HighlightSlide, type MediaItem } from "@/lib/tmdb";
import {
  addToWatchlist,
  removeFromWatchlist,
} from "@/lib/watchlist.functions";

interface HeroCarouselProps {
  watchlistKeys: Set<string>;
}

export function HeroCarousel({ watchlistKeys }: HeroCarouselProps) {
  const queryClient = useQueryClient();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [seed, setSeed] = useState(0);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["home-highlights", seed],
    queryFn: () => getHomeHighlights(),
    staleTime: 1000 * 60 * 10,
  });

  const slides: HighlightSlide[] = data?.slides ?? [];

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  const addMutation = useMutation({
    mutationFn: (item: MediaItem) =>
      addToWatchlist({
        data: {
          tmdb_id: item.id,
          media_type: item.media_type,
          series_name: item.title,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          first_air_date: item.release_date,
          vote_average: item.vote_average,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (item: MediaItem) =>
      removeFromWatchlist({
        data: { tmdb_id: item.id, media_type: item.media_type },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  if (isLoading && slides.length === 0) {
    return (
      <div className="h-[420px] w-full animate-pulse rounded-2xl bg-muted" />
    );
  }
  if (slides.length === 0) return null;

  return (
    <div className="relative">
      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        plugins={[Autoplay({ delay: 7000, stopOnInteraction: true })]}
      >
        <CarouselContent>
          {slides.map((slide, i) => {
            const key = `${slide.item.media_type}-${slide.item.id}`;
            const inList = watchlistKeys.has(key);
            return (
              <CarouselItem key={`${key}-${i}`}>
                <HeroSection
                  item={slide.item}
                  label={slide.label}
                  reason={slide.reason}
                  inWatchlist={inList}
                  onToggleWatchlist={() =>
                    inList
                      ? removeMutation.mutate(slide.item)
                      : addMutation.mutate(slide.item)
                  }
                />
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      <div className="absolute right-3 top-3 z-10">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-8 w-8 rounded-full bg-background/70 backdrop-blur hover:bg-background"
          onClick={() => {
            setSeed((s) => s + 1);
            refetch();
          }}
          disabled={isFetching}
          aria-label="Shuffle highlights"
          title="Shuffle highlights"
        >
          <Shuffle className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>

      {slides.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === current ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/40",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
