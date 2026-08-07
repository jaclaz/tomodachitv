# Stats: fix completion calculations and tidy the page

## Cosa non torna (verificato)

1. **Solo le prime 1000 righe vengono contate.** La query su `watched_episodes` in `src/lib/stats.functions.ts` non è paginata, e il backend restituisce al massimo 1000 righe. Sul tuo account ci sono ~6.878 episodi visti: tutte le statistiche (minuti, generi, decenni, weekday, top shows, completion) sono calcolate su una frazione dei dati. È la causa principale dei numeri "strani".
2. **La completion usa il totale di episodi ordinati, non quelli usciti.** `seriesInProgress` divide per `number_of_episodes` di TMDB, che include episodi non ancora andati in onda. Una serie in pari risulta quindi al 60-80% invece che completa, in contrasto con la logica della Library (che conta solo gli episodi rilasciati).
3. **Gli speciali sporcano il conteggio.** In DB ci sono episodi con `season_number = 0` (fino a 126 per utente) contati nel numeratore, mentre `number_of_episodes` non li include: il rapporto può superare il 100% (oggi viene solo troncato a 100).
4. **Ogni serie/film richiede una chiamata TMDB separata** a ogni apertura della pagina. Con centinaia di titoli molte chiamate falliscono in silenzio: quei titoli diventano "TV #12345", con 0 minuti e nessun genere, falsando generi, decenni e media voto.
5. **"Average rating" è il voto TMDB**, non un tuo voto: il titolo confonde.
6. **"Series in progress" è ordinata per percentuale decrescente** e limitata a 8: mostra solo le quasi-finite, non quelle che stai davvero guardando.

## Cosa faccio

**Correttezza dei calcoli**
- Paginare la lettura di `watched_episodes` e `watched_movies` (blocchi da 1000) così da usare l'intera cronologia.
- Escludere `season_number = 0` (speciali) dal calcolo di completion e stagioni completate; restano contati nei minuti e negli episodi totali.
- Calcolare la completion sugli **episodi già usciti** (come nella Library): totale = episodi con data di messa in onda passata, ricavato da `last_episode_to_air` / conteggi per stagione. Una serie in pari arriva così al 100%.
- Deduplicare per (serie, stagione, episodio) prima di contare.
- "Seasons completed": ignorare stagione 0 e stagioni ancora in corso (conteggio sugli episodi usciti).

**Affidabilità e velocità**
- Leggere i metadati da `media_cache` quando disponibili e chiamare TMDB solo per gli ID mancanti, con concorrenza ridotta e retry sul 429 (stesso approccio già usato nell'import).
- Se un titolo resta non risolto, escluderlo dalle medie invece di contarlo come 0 minuti / titolo senza genere.

**Pulizia della schermata**
- "Series in progress": ordinare per **ultimo episodio visto** (più recenti in alto), mostrare 8 elementi con possibilità di espandere, ed escludere le serie con stato `dropped`.
- Rinominare "Average rating" in "Average TMDB score" con sottotitolo chiaro.
- Mostrare uno stato di caricamento coerente su tutte le card (oggi alcune mostrano 0 mentre i dati arrivano) e una nota "in aggiornamento" mentre i metadati vengono risolti.
- Rimuovere la card "Total watch time" duplicata rispetto alla strip in cima e usare quello spazio per "Episodi/serie totali seguite".

## Note tecniche

- File toccati: `src/lib/stats.functions.ts` (paginazione, cache, aired-only, dedup) e `src/routes/_authenticated/stats.tsx` (ordinamento, etichette, stati di caricamento, layout card).
- Nessuna modifica al database e nessuna modifica alle pagine Library/Watchlist/profilo.
