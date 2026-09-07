# Navigazione mobile con barra in basso

Su telefono la navigazione passa da una barra fissa in basso, con le voci principali sempre a portata di pollice e un tasto "Altro" per tutto il resto. Su desktop non cambia nulla.

## Cosa vedrai

Barra fissa in fondo allo schermo (solo sotto i 1024px) con 5 voci:

```text
[ Home ] [ Trending ] [ Library ] [ Profilo ] [ Altro ]
```

- **Home**, **Trending**: come oggi.
- **Library**: apre la Watchlist; da lì si passa a Watched con i tab già esistenti. La voce resta evidenziata su entrambe le pagine.
- **Profilo**: la tua pagina personale.
- **Altro**: apre un pannello che sale dal basso con Watched, Calendario, Tomodachi, Stats, Import, Reports (solo admin), notifiche, modifica profilo, collega Google, esci ed elimina account.

L'icona attiva si colora di viola come nella sidebar. Sulla voce notifiche compare il pallino quando c'è qualcosa di non letto.

Il bottone menu in alto a sinistra viene rimosso su telefono: tutto passa dalla barra in basso.

## Dettagli tecnici

- Nuovo `src/components/mobile-tab-bar.tsx`: barra `fixed bottom-0 inset-x-0 z-50 lg:hidden` con `pb-[env(safe-area-inset-bottom)]`, 5 celle in `grid-cols-5`, `Link` di TanStack con `activeOptions` e stile attivo `text-primary`.
- La voce "Altro" apre uno `Sheet` con `side="bottom"` che riusa il contenuto già esistente della sidebar (nav secondaria + blocco account con `NotificationBell`, `EditProfileDialog`, dialog di conferma logout/delete).
- `src/components/app-sidebar.tsx`: rimuovere il trigger hamburger fisso in alto a sinistra e lo `Sheet` laterale; estrarre le voci secondarie e il blocco account in modo riutilizzabile dalla barra mobile; la sidebar desktop `lg:block` resta invariata.
- `src/routes/_authenticated/route.tsx`: aggiungere `pb-24 lg:pb-0` al contenitore principale così il contenuto non finisce sotto la barra, e montare `<MobileTabBar />`.
- Voce Library attiva anche su `/watched` tramite confronto del pathname con `useRouterState`.
- Profilo: link a `/u/$username` con lo username dalla query `["me"]`; se il profilo non è ancora caricato la cella resta disabilitata.
- Nessuna modifica a dati, query o logica di business.
