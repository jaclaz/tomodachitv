import type { FollowingActivityItem } from "./social.functions";

export interface ActivityGroup extends FollowingActivityItem {
  episode_numbers: number[];
}

/** Keep each friend's same-day viewing of a show/season in one feed entry. */
export function groupFollowingActivity(items: FollowingActivityItem[]): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();
  for (const item of items) {
    const key = item.kind === "episode"
      ? `${item.user.id}:${item.tmdb_id}:${item.season_number}:${item.watched_at.slice(0, 10)}`
      : item.id;
    const existing = groups.get(key);
    if (existing) {
      if (item.episode_number !== undefined && !existing.episode_numbers.includes(item.episode_number)) {
        existing.episode_numbers.push(item.episode_number);
      }
      if (item.watched_at > existing.watched_at) existing.watched_at = item.watched_at;
    } else {
      groups.set(key, { ...item, episode_numbers: item.episode_number === undefined ? [] : [item.episode_number] });
    }
  }
  return [...groups.values()].map((group) => ({
    ...group, episode_numbers: group.episode_numbers.sort((a, b) => a - b),
  })).sort((a, b) => b.watched_at.localeCompare(a.watched_at));
}

export function episodeRanges(numbers: number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  if (start === undefined) return "";
  let end = start;
  for (const number of sorted.slice(1)) {
    if (number === end + 1) { end = number; continue; }
    ranges.push(start === end ? `${start}` : `${start}–${end}`);
    start = end = number;
  }
  ranges.push(start === end ? `${start}` : `${start}–${end}`);
  return ranges.join(", ");
}