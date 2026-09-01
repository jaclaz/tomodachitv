# Prompt per Lovable: clone Goodreads con la grafica di TomodachiTV

## Obiettivo

Scrivere un prompt pronto da incollare in Lovable (nuovo progetto) per creare un'app di
tracking libri stile Goodreads, con la stessa identità visiva dell'app attuale
(dark cinematic, accenti viola/rosa, card con poster/copertine, logo custom).

Il prompt sarà consegnato come file markdown scaricabile (`/mnt/documents/prompt-goodreads-clone.md`)
e anche incollato in chat per comodità.

## Contenuto del prompt

1. **Grafica** (fedele a questa app):
  - Tema sempre scuro: sfondo quasi nero (oklch ~0.05), card scure, accenti viola/magenta 
  - Font Inter + Plus Jakarta Sans, griglie di copertine 2:3 con overlay fade
  - Sidebar di navigazione, search bar globale con dropdown risultati
  - Rating personale con icona custom (no stelle, dato che le stelle le usa Goodreads) su scala 1-5 con mezzi voti
2. **Funzionalità core**:
  - Catalogo libri con ricerca (lascio scegliere l'API nel prompt: Google Books o Open Library)
  - Libreria con stati: Want to read / Currently reading / Read / Dropped
  - Progresso di lettura per pagine (invece che episodi)
  - Rating personale, preferiti, liste custom pubbliche/private, liste salvabili da altri utenti
  - Import da Goodreads CSV
3. **Extra richiesti dall'utente**:
  - Social: profili, follow, feed attività
  - Reading challenge annuale (es. "30 libri nel 2026") con progress bar
  - Recensioni testuali oltre al voto
  - Statistiche complete: tempo/pagine lette, libri per mese, generi, autori più letti,
  riletture, ritmo di lettura, grafici per giorno della settimana
4. **Struttura tecnica suggerita nel prompt**: Lovable Cloud (auth + database + RLS),
  raccomandazioni che escludono libri già in libreria, pagina Discover con filtri
   (genere, anno, valutazione), calendario uscite dei libri in arrivo degli autori seguiti.

## Esecuzione

1. Scrivere `/mnt/documents/prompt-goodreads-clone.md` con il prompt completo in italiano
2. Incollare il testo anche in chat