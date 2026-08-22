# "Added to list" persistente e visibile

Sì, è chiaro. Oggi il tasto "Add to list" diventa "Added" solo grazie a uno stato locale temporaneo: se ricarichi la pagina o torni sulla scheda, il tasto torna a "Add to list" anche se il titolo è già in una lista. E nel menu a tendina non si vede in quale lista si trova.

## Cosa cambia

- Il tasto mostra "Added" (stato evidenziato) ogni volta che il titolo è già presente in almeno una tua lista, letto dal database e non da uno stato temporaneo.
- Aprendo il menu, ogni lista che già contiene il titolo ha una spunta accanto al nome; le altre no.
- Cliccando una lista già spuntata il titolo viene rimosso da quella lista (toggle); cliccando una lista senza spunta viene aggiunto. Toast coerente: "Aggiunto a <nome lista>" / "Rimosso da <nome lista>".
- Su hover/nel tooltip del tasto compare l'elenco delle liste in cui il titolo è presente.
- Vale sia per il tasto grande nelle schede film/serie sia per l'iconcina sulle locandine.

## Dettagli tecnici

- Nuova server function `getListMembership` in `src/lib/lists.functions.ts`: dato `{ media_type, tmdb_id }`, restituisce gli `list_id` (con titolo) delle liste dell'utente che contengono quell'elemento (join `user_lists` + `user_list_items` filtrato su `user_id`).
- `src/components/list-actions.tsx` e `src/components/poster-actions.tsx`: sostituire lo stato `justAdded` con una `useQuery` su chiave `["list-membership", media_type, tmdb_id]`; il tasto è "Added" quando l'array non è vuoto.
- Mutazione unica add/remove che chiama `addListItem` o `removeListItem` in base alla presenza, con invalidazione di `["list-membership", ...]`, `["user-lists", me?.id]` e `["list"]`.
- Dopo la creazione di una nuova lista con aggiunta, stessa invalidazione così lo stato resta corretto senza flag locali.
