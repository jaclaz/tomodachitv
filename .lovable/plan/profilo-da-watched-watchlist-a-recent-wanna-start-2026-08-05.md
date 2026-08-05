# Profilo: da "Watched / Watchlist" a "Recent / Wanna start"

Sì, è chiaro. Oggi il profilo duplica esattamente le pagine Watched e Watchlist. Lo sostituiamo con due sezioni pensate per il profilo:

## Recent
Le ultime cose guardate, divise in TV e Film, ordinate dalla più recente.
- **Film**: tutti i film visti (come oggi in Watched).
- **Serie TV**: tutte le serie con **almeno 1 episodio visto**, quindi anche quelle "in corso" che oggi finiscono solo in Watchlist. Le serie completate e quelle in corso stanno insieme, ordinate per data dell'ultimo episodio segnato.
- Le serie/film "dropped" restano esclusi.

## Wanna start
Le cose in libreria **non ancora iniziate**, divise in TV e Film.
- **Serie TV**: presenti in libreria con 0 episodi visti.
- **Film**: in libreria e non ancora visti.
- Esclusi dropped e completati.

Ogni sezione mantiene le stesse locandine orizzontali di oggi, con il tastino "vedi tutto" (per il proprio profilo) che porta rispettivamente a Watched e Watchlist.

## Privacy
Resta la regola attuale: "Recent" è visibile solo a se stessi e ai follower; "Wanna start" resta visibile come oggi la watchlist.

## Dettagli tecnici
- `src/lib/watched-library.functions.ts`: `buildWatchedLibrary` oggi filtra le righe di `watchlist` su `status in ('completed','dropped')`. Va esteso per includere anche le righe con episodi visti (`watching`), così ogni item porta `episodes_watched` e `watched_at` = ultimo episodio segnato. Il calcolo delle aggregazioni episodi/film e il caching TMDB esistenti restano invariati.
- `src/routes/_authenticated/u.$username.tsx`: sostituire i due tab `watched`/`watchlist` con `recent`/`wanna-start` (mantenendo il tab attivo nell'URL come ora).
  - Recent TV = item TV con `episodes_watched >= 1 && !dropped`, ordinati per `watched_at` desc.
  - Recent Movies = item movie non dropped, ordinati per `watched_at` desc.
  - Wanna start = righe di `getUserWatchlist` con status non `completed`/`dropped` **e** senza episodi visti (per le serie) / non presenti tra i film visti.
- Nessuna modifica al database: i dati necessari (`watchlist.status`, `watched_episodes`, `watched_movies`) esistono già.
- Le sezioni Favorites e Liste personali sotto i tab restano invariate.
