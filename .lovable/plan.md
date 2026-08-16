# Consigli della home: nuovo algoritmo

Oggi i consigli nascono solo dagli ultimi episodi/film visti, chiedendo a TMDB "titoli simili a questi". Con pochi semi e una libreria stabile escono sempre le stesse cose. Il nuovo motore costruisce un vero profilo di gusto e mescola più fonti.

## Come funzionerà

1. **Profilo di gusto**
   - I titoli con voto popcorn alto (4+) pesano molto, quelli con voto basso (<=2) diventano segnali negativi: i loro generi vengono penalizzati.
   - Da tutta la libreria (visti, preferiti, voti) si ricava una classifica di generi preferiti, con più peso a ciò che è recente.

2. **Semi più vari**
   - I semi non sono più solo gli ultimi episodi: si pesca a rotazione da preferiti, serie completate/di recente finite, film votati alto e titoli visti di recente.
   - Ogni giorno il seme cambia, quindi la selezione ruota (più il tasto Refresh manuale già presente).

3. **Tre fonti mescolate**
   - "Simili a quello che ti è piaciuto" (raccomandazioni TMDB sui semi).
   - "Nel tuo genere" (ricerca TMDB per generi preferiti, con soglia minima di voti).
   - "Scoperta": titoli meno popolari ma ben votati nei generi preferiti, per evitare i soliti blockbuster.
   La lista finale prende una quota da ciascuna fonte, così ci sono sempre novità.

4. **Filtri e anti-ripetizione**
   - Restano esclusi: già visti, in libreria, abbandonati, generi penalizzati dai voti bassi.
   - Un titolo mostrato oggi ha meno probabilità di ricomparire nei giorni immediatamente successivi.

5. **Rotazione giornaliera**
   - La lista è stabile durante la giornata e cambia il giorno dopo; il pulsante Refresh forza subito un nuovo set.

## Dettagli tecnici

- `src/lib/tmdb.ts` → riscrittura di `getUserRecommendations`:
  - carica in parallelo `user_ratings`, `favorites`, `watched_episodes`, `watched_movies`, `watchlist`, `dropped_shows` (con la paginazione già usata);
  - costruisce `genreWeights` per tv e movie usando `media_cache.genre_ids` dei titoli in libreria, pesati per voto popcorn e recency; i generi dei titoli votati <=2 sottraggono peso;
  - semi: fino a 4 da preferiti/voti alti + 3 da visti di recente, scelti con `seededShuffle`;
  - fonti: `/{kind}/{id}/recommendations` per i semi; `/discover/{kind}` con `with_genres` dei top generi, `sort_by=vote_average.desc`, `vote_count.gte=200`; una seconda `/discover` "scoperta" con `vote_count.gte=50&lte=1500` e `page` derivata dal seme;
  - punteggio = frequenza tra le fonti + affinità di genere + bonus voto TMDB - penalità generi negativi; interleaving per quote (es. 8 simili / 7 genere / 5 scoperta), max 20 per tipo;
  - il seme di default diventa il giorno corrente (`Math.floor(Date.now()/86400000)`), passato dal client.
- `src/routes/_authenticated/index.tsx`:
  - `recSeed` inizializzato al giorno corrente invece che a 0; rimosso l'intervallo da 30 minuti; il pulsante Refresh continua a incrementare il seme;
  - `staleTime` allineato alla rotazione giornaliera.
- Nessuna modifica al database.
