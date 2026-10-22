<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Trending is computed from `trend_events` (filled by DB triggers on library actions, tagged with the user profile country) via `get_trending_scores`; TMDB regional discover is only a fallback when local data is thin. Why: TMDB trending endpoints are global and ignore country.
- Recommendations use the weighted hybrid score in `recommendations.server.ts` (`recommendationScore`); co-watch peers come from the `get_cowatch_scores` RPC. Why: one tested scoring function keeps weights consistent.
- Profile content reads use authenticated RLS against named profiles, independently of follow relationships; writes remain owner-only and private lists retain their visibility policies. Why: profile browsing and following for activity updates are separate capabilities.
