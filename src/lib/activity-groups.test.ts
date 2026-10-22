import { describe, expect, it } from "vitest";
import { episodeRanges, groupFollowingActivity } from "./activity-groups";
import type { FollowingActivityItem } from "./social.functions";

const episode = (n: number, overrides: Partial<FollowingActivityItem> = {}): FollowingActivityItem => ({
  id: `e:${n}`, kind: "episode", user: { id: "friend", username: "friend", display_name: null, avatar_url: null },
  tmdb_id: 123, title: "Series X", poster_path: null, watched_at: "2026-10-22T10:00:00Z",
  season_number: 2, episode_number: n, ...overrides,
});

describe("friend episode activity", () => {
  it("collapses 20 episodes into one entry", () => {
    const groups = groupFollowingActivity(Array.from({ length: 20 }, (_, i) => episode(i + 1)));
    expect(groups).toHaveLength(1);
    expect(groups[0]?.episode_numbers).toHaveLength(20);
  });
  it("summarizes episodes 1 through 8 as a range", () => {
    expect(episodeRanges([8, 7, 6, 5, 4, 3, 2, 1])).toBe("1–8");
  });
  it("does not imply missing episodes were watched", () => {
    expect(episodeRanges([1, 2, 4, 6, 7, 7])).toBe("1–2, 4, 6–7");
  });
  it("keeps different friends, series, seasons and days separate", () => {
    expect(groupFollowingActivity([
      episode(1), episode(2, { user: { id: "other", username: "other", display_name: null, avatar_url: null } }),
      episode(3, { tmdb_id: 456 }), episode(4, { season_number: 3 }),
      episode(5, { watched_at: "2026-10-21T10:00:00Z" }),
    ])).toHaveLength(5);
  });
  it("keeps movies separate and sorts by latest watch", () => {
    const groups = groupFollowingActivity([episode(1), episode(2, { watched_at: "2026-10-22T12:00:00Z" }),
      episode(3, { id: "m:3", kind: "movie", watched_at: "2026-10-22T11:00:00Z" })]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.watched_at).toBe("2026-10-22T12:00:00Z");
    expect(groups[1]?.kind).toBe("movie");
  });
});