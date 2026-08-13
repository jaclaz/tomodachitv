# Voti personali con i popcorn

Un sistema di valutazione personale, separato dal punteggio TMDB (che resta a stelle). L'utente assegna un voto da 0,5 a 5 popcorn a film e serie che ha guardato, e può filtrare la libreria "Watched" per voto.

## Come funziona per l'utente

- Nella scheda di un film o di una serie compare una fila di 5 popcorn cliccabili (mezzo popcorn = mezzo voto), accanto ai pulsanti "Mark as watched" / preferiti.
- Cliccando si salva subito il voto; cliccando di nuovo sullo stesso valore si rimuove il voto.
- Il voto personale appare anche sulle card dei poster (piccolo badge popcorn) così si distingue a colpo d'occhio dal voto TMDB con la stella.
- Nella pagina Watched, accanto a ricerca / preferiti / dimensione griglia, si aggiunge un filtro "Voto": scelta rapida tra Tutti, 5, 4,5+, 4+, 3,5+, 3+, 2,5+, 2+, 1,5+, 1+, 0,5+ e "Non votati", più ordinamento per voto (dal più alto).
- Nel profilo pubblico il voto è visibile agli utenti che ti seguono, coerentemente con come già funzionano watched/preferiti.

## Simbolo

Icona popcorn disegnata come componente SVG interno (non emoji, non dipendente da lucide), in tre stati: vuota, mezza, piena. Colore da token esistente distinto da quello delle stelle TMDB.

## Dettagli tecnici

Database — nuova tabella `public.user_ratings`:
- colonne: `user_id`, `media_type` ('movie' | 'tv'), `tmdb_id`, `rating` (numeric, valori 0.5–5 a passi di 0.5), `title`, `poster_path`, `created_at`, `updated_at`
- unicità su (user_id, media_type, tmdb_id)
- GRANT per `authenticated` e `service_role`, RLS attiva
- policy: gestione completa delle proprie righe (`auth.uid() = user_id`); lettura consentita anche a chi segue l'utente tramite `is_follower(auth.uid(), user_id)`, come per favorites
- trigger `set_updated_at` come sulle altre tabelle

Codice:
- `src/components/popcorn-icon.tsx` — SVG con stato empty/half/full
- `src/components/rating-input.tsx` — controllo a 5 popcorn accessibile da tastiera (frecce, Home/End, `role="slider"` con aria-valuetext), gestione mezzo voto via posizione del click
- `src/lib/ratings.functions.ts` — server functions con `requireSupabaseAuth`: `getMyRatings`, `setRating`, `clearRating`, `getUserRatings(userId)` per il profilo
- integrazione in `movie.$id.tsx`, `serie.$id.tsx` (input voto), `media-card.tsx` (badge voto), `watched.tsx` (filtro + ordinamento, con parametro `rating` in `validateSearch`), profilo `u.$username.tsx` (badge in sola lettura)
- aggiornamenti ottimistici con invalidazione della query `my-ratings`

Ordine di lavoro: prima la migrazione del database, poi i componenti e le server function, infine l'integrazione nelle pagine.
