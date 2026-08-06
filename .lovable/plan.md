# Profilo: sezione "Last watched" per le serie TV

## Problema

Nella pagina profilo, la scheda "Watched" per le serie mostra solo i titoli con stato `completed` o `dropped` nella libreria. Le serie che stai guardando ora (episodi segnati di recente, ma serie non finita) non compaiono da nessuna parte nel profilo.

## Cosa esiste già

Sì, il record delle ultime cose viste esiste: ogni episodio segnato viene salvato con la data di visione (tabella `watched_episodes`, campo `watched_at`). Quindi si può ricostruire l'ordine reale di "ultima visione" per ogni serie.

## Cosa cambia (SOLO nella pagina profilo)

Le pagine Watched e Watchlist normali non vengono toccate: la modifica riguarda esclusivamente `/u/:username`.

Obiettivo: chi guarda il profilo capisce **cosa ho guardato ultimamente** e **cosa voglio guardare**.

- **Last watched** (ex "Watched")
  - **TV Shows** — le serie ordinate per episodio guardato più di recente, **indipendentemente** dal fatto che siano finite, in corso o abbandonate. Così una serie in corso appare qui, non tra i "da guardare".
  - **Movies** — invariato (film visti, ordinati per data di visione).
- **Watchlist** — solo i titoli **mai iniziati**: serie senza alcun episodio segnato e film non ancora visti (esclusi completed/dropped, come ora).

## Note tecniche

- Nuova funzione server `getRecentlyWatchedShows` (in `src/lib/watched-library.functions.ts`, con variante per `user_id` e RLS invariata):
  - aggrega `watched_episodes` per `tmdb_id` con `max(watched_at)` e conteggio episodi (fetch paginato, come già fatto altrove per il limite di 1000 righe);
  - recupera titolo/poster da `media_cache`, con fallback su `watchlist` per le righe non ancora in cache;
  - ritorna gli item ordinati per ultima visione, limitati a 20 (stesso limite degli altri strip del profilo).
- `src/routes/_authenticated/u.$username.tsx` (unico file UI modificato): la strip TV della tab "Watched" usa la nuova query invece di filtrare `getUserWatchedLibrary`; la tab viene rinominata "Last watched"; la strip TV della tab Watchlist esclude le serie presenti in "Last watched" (quelle con almeno un episodio segnato). Strip Movies e resto del profilo invariati.
- Nessuna modifica al database, né a `src/routes/_authenticated/watched.tsx` / `watchlist.tsx`.
