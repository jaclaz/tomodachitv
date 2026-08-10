# Mini guida testuale a punti nella pagina Import/Export

## Obiettivo
Aggiungere nella pagina `/import` una sezione informativa concisa, a elenco puntato, che spieghi all'utente come funziona l'importazione dei dati.

## Cosa cambia
- **File**: `src/routes/_authenticated/import.tsx`
- **Posizione**: sotto il titolo e il sottotitolo della pagina, prima del box di upload.
- **Componente UI**: un nuovo box rientrato (es. `rounded-2xl border border-border bg-surface p-6`) con un titolo tipo "How it works" e un elenco a punti.

## Contenuto della guida (draft)
1. **Upload your ZIP** — drop the TV Time export (or your Tomodachi backup ZIP) into the box.
2. **Matching on TMDB** — we try to link every series, episode and movie to its TMDB entry.
3. **Manual match** — if a title isn't recognized, it appears under "Couldn't be imported" so you can search TMDB and link it yourself.
4. **Library sync** — we turn your matched data into watched/completed entries in your library.
5. **Something looks off?** — click **Sync library statuses** again to fix statuses that didn't update correctly.
6. **Export & reset** — you can download your library as a ZIP, or wipe just TV, just movies, or everything.


## Implementazione tecnica
- Creare un componente locale o inserire direttamente JSX nell'ordine della pagina.
- Utilizzare le classi Tailwind esistenti del progetto (`bg-surface`, `border-border`, `text-muted-foreground`, `text-foreground`, `font-display`).
- Aggiungere un'icona informativa (es. `Info` da `lucide-react`) accanto al titolo della guida.
- Non modificare la logica di importazione; solo contenuto statico/presentazionale.

## Verifica
- Build del progetto senza errori.
- Render preview della pagina `/import` con la guida visibile e leggibile su mobile e desktop.
