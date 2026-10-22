import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

// Run with a locally minted session; credentials never belong in the repository.
const sessionPath = process.env.PROFILE_VISIBILITY_TEST_SESSION;
describe.skipIf(!sessionPath)("profile visibility without following", () => {
  it("reads an unfollowed friend's watchlist and watched history without adding a follow", async () => {
    if (!sessionPath) throw new Error("A test session is required");
    const { session } = JSON.parse(readFileSync(sessionPath, "utf8"));
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Test backend configuration is required");
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    });
    const { data: friend, error } = await client.from("profiles").select("id").eq("username", "prova1").single();
    expect(error).toBeNull();
    if (!friend) throw new Error("The unfollowed friend fixture is missing");
    const follows = () => client.from("follows").select("id").eq("follower_id", session.user.id).eq("following_id", friend.id);
    expect((await follows()).data).toEqual([]);
    for (const table of ["watchlist", "watched_movies", "watched_episodes"]) {
      const result = await client.from(table).select("id").eq("user_id", friend.id).limit(1);
      expect(result.error, `${table} must be readable without following`).toBeNull();
      expect(result.data?.length, `${table} must not be hidden`).toBe(1);
    }
    expect((await follows()).data).toEqual([]);
  }, 30_000);
});