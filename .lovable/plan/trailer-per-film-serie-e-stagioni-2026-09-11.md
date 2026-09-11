# Trailer per film, serie e stagioni

Aggiunta discreta: la possibilità di vedere il trailer senza cambiare il layout esistente.

## Dove appare

- Scheda film e scheda serie: dentro la sezione "Where to watch", accanto al titolo della sezione compare un piccolo link/pulsante "Watch trailer" con icona play (stessa dimensione del testo della sezione, non nella fila dei pulsanti principali).
- Stagioni: piccola icona play accanto al pulsante "Mark season as watched" nella barra delle stagioni, visibile solo se quella stagione ha un trailer.

Se non esiste nessun trailer, il pulsante non viene mostrato: nessuno spazio vuoto.

## Come si comporta

- Clic: si apre una finestra centrale con il video in proporzione 16:9.
- Si chiude cliccando fuori, sulla X o con Esc; il video si ferma alla chiusura.
- Viene scelto il trailer in inglese (coerente con la lingua dell'app): primo video YouTube di tipo "Trailer" in inglese, altrimenti "Teaser", altrimenti il primo video disponibile.

## Nota

I trailer sono ospitati su YouTube: il video viene mostrato dentro l'app, non si esce dal sito. In passato erano stati rimossi i collegamenti a YouTube come "dove guardare"; questa è una cosa diversa (solo il filmato promozionale).

## Dettagli tecnici

- `src/lib/tmdb.ts`: nuova server function `getTrailer` (autenticata come le altre) che interroga `/{type}/{id}/videos` e, per le stagioni, `/tv/{id}/season/{n}/videos`; ritorna `{ key, name }` del primo risultato con `site === "YouTube"`, preferenza `type: "Trailer"` lingua `en-US`, fallback teaser/qualsiasi video.
- Nuovo componente `src/components/trailer-button.tsx`: props `mediaType`, `tmdbId`, `season?`, `variant?` ("link" | "icon"). Usa `useQuery` (chiave `["trailer", type, id, season]`, `staleTime` lungo) e mostra il pulsante solo con dato presente. Il dialog usa `Dialog` di shadcn con un iframe YouTube (`youtube-nocookie.com/embed/<key>`) montato solo quando aperto, così alla chiusura il video si ferma.
- `src/components/watch-providers.tsx`: accetta props opzionali per il trailer e renderizza `<TrailerButton variant="link" />` accanto all'intestazione "Where to watch"; `movie.$id.tsx` e `serie.$id.tsx` passano i dati necessari (nessuna altra modifica alle pagine dettaglio).
- `src/components/episode-list.tsx`: variante icona nella barra delle stagioni, con `aria-label` descrittivo.
