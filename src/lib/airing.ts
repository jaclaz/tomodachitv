// A show is "airing now" when its next episode is due within this window.
// Caught-up viewers of an airing show stay in "watching" instead of completed.
export const AIRING_WINDOW_DAYS = 21;

export function isAiringNow(nextAirDate: string | null | undefined, now = new Date()): boolean {
  if (!nextAirDate) return false;
  const limit = new Date(now.getTime() + AIRING_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  return nextAirDate <= limit;
}

export function showProgressState(
  watched: number,
  aired: number | null,
  nextAirDate: string | null | undefined,
  now = new Date(),
): "not_started" | "watching" | "caught_up" | "completed" | "unknown" {
  if (watched <= 0) return "not_started";
  if (aired == null || aired <= 0) return "unknown";
  if (watched < aired) return "watching";
  return isAiringNow(nextAirDate, now) ? "caught_up" : "completed";
}
