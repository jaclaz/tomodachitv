# Saved lists on your profile

Today, when you save someone else's list it is recorded in the backend (`list_saves`), but nothing in the app ever shows it back to you: the profile "Lists" section only reads lists you created. So saved lists are effectively invisible.

## What changes

- Saved lists live in the same "Lists" grid as your own — one single section, sorted together (most recently updated first).
- A list saved from someone else is marked with the creator's avatar as a small circular badge on the card (initials fallback), plus their `@username`. Your own lists carry no badge.
- Tapping the creator badge/username opens that person's profile; tapping the card opens the list.
- Saved cards keep the same poster preview and item count, but instead of edit/delete they offer "Unsave".
- Saved lists appear only on your own profile (they're personal), not when someone else visits it.
- If a saved list is deleted or made private by its owner, it simply stops appearing.
- Unsaving from the list page or from the profile keeps both views in sync.

## Technical notes

- New server function `getSavedLists` in `src/lib/lists.functions.ts`: reads `list_saves` for the current user, joins `user_lists` (public, excluding own), aggregates item count + up to 4 preview posters like `getUserLists`, and attaches owner `username`/`display_name`/`avatar_url` from `profiles`.
- `src/components/user-lists-section.tsx`: merge owned + saved into one array (saved entries flagged with `owner`), sort by `updated_at`, and render the owner avatar badge + unsave action conditionally in the existing card.
- Unsave uses the existing `unsaveList` function; invalidate `["saved-lists"]` and `["list", id]` after save/unsave in both the profile and `list.$id.tsx`.
- No database migration needed — `list_saves` and its RLS policies already exist.
