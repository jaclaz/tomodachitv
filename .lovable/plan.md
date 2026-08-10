# Mini guida testuale a punti nella pagina Import/Export

## Obiettivo
Aggiungere nella pagina `/import` una sezione informativa concisa, a elenco puntato, che spieghi all'utente come funziona l'importazione dei dati.

## Cosa cambia
- **File**: `src/routes/_authenticated/import.tsx`
- **Posizione**: sotto il titolo e il sottotitolo della pagina, prima del box di upload.
- **Componente UI**: un nuovo box rientrato (es. `rounded-2xl border border-border bg-surface p-6`) con un titolo tipo "How it works" e un elenco a punti.

## Contenuto della guida (draft)
1. **Upload your ZIP** — drag & drop o selezione del file esportato da TV Time (o dal backup di Tomodachi).
2. **We parse it in your browser** — i CSV dentro lo ZIP vengono letti localmente; nessun dato grezzo lascia il dispositivo.
3. **We match titles on TMDB** — le serie, gli episodi e i film vengono collegati ai corrispettivi ID TMDB.
4. **Background resolution** — i titoli non trovati subito vengono messi in coda e riprovati automaticamente per evitare il rate-limit di TMDB.
5. **Manual match** — se un titolo non viene riconosciuto, compare nella lista "Couldn't be imported" dove puoi cercarlo manualmente su TMDB.
6. **Library sync** — alla fine gli stati vengono sincronizzati: film visti → completati, serie TV con episodi visti → watching/completed.
7. **Export & reset** — puoi esportare la libreria come ZIP oppure ripulire solo TV, solo film o tutto.

## Implementazione tecnica
- Creare un componente locale o inserire direttamente JSX nell'ordine della pagina.
- Utilizzare le classi Tailwind esistenti del progetto (`bg-surface`, `border-border`, `text-muted-foreground`, `text-foreground`, `font-display`).
- Aggiungere un'icona informativa (es. `Info` da `lucide-react`) accanto al titolo della guida.
- Non modificare la logica di importazione; solo contenuto statico/presentazionale.

## Verifica
- Build del progetto senza errori.
- Render preview della pagina `/import` con la guida visibile e leggibile su mobile e desktop.
