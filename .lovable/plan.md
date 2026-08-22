# Saved lists on your profile

Today, when you save someone else's list it is recorded in the backend (`list_saves`), but nothing in the app ever shows it back to you: the profile "Lists" section only reads lists you created. So saved lists are effectively invisible.

## What changes

- The profile "Lists" section gets two groups:
  - **My lists** — exactly what's shown today (create/edit/delete).
  - **Saved lists** — lists created by other people that you saved.
- Each saved list card shows the creator: their avatar (or initials) plus `@username`, so it's immediately clear it isn't yours. Clicking the creator chip opens their profile; clicking the card opens the list.
- Saved-list cards have no edit/delete; instead a small "Unsave" action (with the same poster preview + item count as normal cards).
- Saved lists appear only on your own profile (they're personal), not when visiting someone else's profile.
- If a saved list is made private or deleted by its owner, it simply stops appearing.
- Unsaving from the list page or from the profile keeps both views in sync.

## Technical notes

- New server function `getSavedLists` in `src/lib/lists.functions.ts`: reads `list_saves` for the current user, joins `user_lists` (public only, excluding own), aggregates item count + up to 4 preview posters like `getUserLists`, and attaches owner `username`/`display_name`/`avatar_url` from `profiles`.
- `src/components/user-lists-section.tsx`: render the saved group under the owned group when `isSelf`, using a new lightweight `SavedListCard` (owner chip + unsave button) reusing the existing card layout.
- Unsave uses the existing `unsaveList` function; invalidate `["saved-lists"]` and `["list", id]` query keys after save/unsave in both the profile and `list.$id.tsx`.
- No database migration needed — `list_saves` and its RLS policies already exist.
