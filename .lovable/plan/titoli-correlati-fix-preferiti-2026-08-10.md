# Titoli correlati + fix preferiti

## 1. Sezione "You might also like" in fondo alle schede

In fondo alla scheda di ogni film e serie (sotto le info) compare una striscia di locandine con titoli correlati.

Come si calcola la correlazione:
- Base: le raccomandazioni di TMDB per quel titolo (che pesano già genere, cast, popolarità, comportamento degli utenti).
- Fallback: se TMDB restituisce pochi risultati (meno di ~6), si completa con i titoli "simili" (similar), che pesano genere e parole chiave.
- I risultati vengono deduplicati e limitati a 20.

Le locandine sono cliccabili e portano alla scheda del titolo, con gli stessi pulsanti rapidi (aggiungi a libreria/preferiti) usati altrove.

## 2. Preferiti del profilo: mostrarli tutti

Nel profilo le strisce dei preferiti (serie e film) sono attualmente tagliate a 12 elementi senza alcun avviso. Vengono allineate al resto del profilo: fino a 20 elementi visibili e scroll orizzontale, così non spariscono titoli senza motivo.

## Dettagli tecnici

- `src/lib/tmdb.ts`: nuova server function `getRelatedTitles({ type: "movie" | "tv", id })` che chiama `/{type}/{id}/recommendations` e, se servono, `/{type}/{id}/similar`, deduplica per `tmdb_id`, scarta i titoli senza poster e ritorna max 20 item nel formato `PosterItem`.
- Nuovo componente `src/components/related-titles.tsx`: `useQuery` sulla nuova function, render con `PosterStrip` (`max={20}`, `actions` = `PosterActions`), nasconde la sezione se la lista è vuota.
- `src/routes/_authenticated/movie.$id.tsx` e `serie.$id.tsx`: render di `<RelatedTitles type=... id=... />` in fondo, dopo `MovieInfo` / `SeriesInfo`.
- `src/routes/_authenticated/u.$username.tsx`: passare `max={20}` alle due `PosterStrip` dei preferiti (favTv, favMovies).
