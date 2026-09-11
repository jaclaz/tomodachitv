# Trailer per film, serie e stagioni

Aggiunta discreta: un piccolo pulsante "Trailer" che apre il video in una finestra sopra la pagina, senza cambiare il layout esistente.

## Dove appare

- Scheda film: pulsante "Trailer" nella fila di pulsanti già presente (accanto a Rating/Preferiti/Liste), stessa forma e dimensione degli altri.
- Scheda serie: stesso pulsante nella stessa fila.
- Stagioni: piccola icona play accanto al pulsante "Mark season as watched" nella barra delle stagioni, visibile solo se quella stagione ha un trailer.

Se non esiste nessun trailer, il pulsante non viene mostrato: nessuno spazio vuoto.

## Come si comporta

- Clic sul pulsante: si apre una finestra centrale con il video a schermo largo (proporzione 16:9).
- Si chiude cliccando fuori, sulla X o con Esc; il video si ferma alla chiusura.
- Viene scelto il trailer ufficiale in italiano se disponibile, altrimenti quello in inglese, altrimenti il primo video disponibile.

## Nota

I trailer sono ospitati su YouTube: il video viene mostrato dentro l'app, non si esce dal sito. In passato erano stati rimossi i collegamenti a YouTube come "dove guardare"; questa è una cosa diversa (solo il filmato promozionale).

## Dettagli tecnici

- `src/lib/tmdb.ts`: nuova server function `getTrailer` (autenticata come le altre) che interroga `/{type}/{id}/videos` e, per le stagioni, `/tv/{id}/season/{n}/videos`; ritorna `{ key, name, site }` del primo risultato con `site === "YouTube"` e `type` "Trailer" (fallback "Teaser"), con preferenza lingua `it-IT` poi `en-US`.
- Nuovo componente `src/components/trailer-button.tsx`: props `mediaType`, `tmdbId`, `season?`, `variant?` ("button" | "icon"). Usa `useQuery` (chiave `["trailer", type, id, season]`, `staleTime` lungo) e mostra il pulsante solo con dato presente. Il dialog usa `Dialog` di shadcn con un iframe YouTube (`youtube-nocookie.com/embed/<key>`) montato solo quando aperto, così alla chiusura il video si ferma.
- `src/routes/_authenticated/movie.$id.tsx` e `serie.$id.tsx`: inserimento di `<TrailerButton />` nella fila di azioni esistente.
- `src/components/episode-list.tsx`: variante icona accanto al pulsante della stagione, con `aria-label` descrittivo.
