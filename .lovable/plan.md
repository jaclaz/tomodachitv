# Report + Notifiche: chiarezza azioni admin e sistema notifiche

## Obiettivo

Rendere chiaro nella scheda admin cosa succede quando si risolve un report:
- **Warn user / Azione**: il contenuto viola le regole → segnalazione risolta e l'utente riceve una notifica.
- **Dismiss / OK**: il contenuto è lecito → segnalazione risolta senza notificare l'utente.

Costruire inoltre un sistema di notifiche in-app da zero per informare l'utente segnalato.

## Stato attuale

- `profile_reports` ha stati `pending | reviewed | dismissed` (campo testo libero).
- I pulsanti admin sono "Mark reviewed" e "Dismiss".
- Non esiste una tabella notifiche.
- L'admin panel mostra già statistiche aggregate in `AdminStatsPanel`.

## Modifiche database

### Nuova tabella `public.notifications`

```text
id              uuid primary key default gen_random_uuid()
user_id         uuid not null references auth.users(id) on delete cascade
-- chi ha ricevuto la notifica
type            text not null
-- es. 'profile_report_action'
title           text not null
body            text
link            text nullable
-- es. '/settings/profile' o '/u/<username>'
read            boolean not null default false
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
```

- GRANT `SELECT, INSERT, UPDATE, DELETE` a `authenticated`.
- GRANT `ALL` a `service_role`.
- Abilitare RLS.
- Policy `SELECT` per `auth.uid() = user_id`.
- Policy `UPDATE` per `auth.uid() = user_id` (solo mark read).
- Policy `DELETE` per `auth.uid() = user_id`.
- Trigger `set_updated_at` su `UPDATE`.

### Tabella `profile_reports`

Il campo `status` è testo libero. Cambiare la semantica dei valori nel codice:
- `pending` → in attesa.
- `actioned` → admin ha preso provvedimento (warn user). Sostituisce `reviewed`.
- `dismissed` → segnalazione infondata / tutto OK.

Non serve alterare la colonna, solo aggiornare i valori inseriti e i filtri UI.
Aggiungere un campo `action_taken` testo nullable per registrare l'azione (es. `cleared_images`, `warned_user`).

## Backend

### Nuovo file `src/lib/notifications.functions.ts`

Server functions:
- `getMyNotifications()` — GET con `requireSupabaseAuth`, restituisce le notifiche dell'utente corrente ordinate per `created_at DESC`, con conteggio unread.
- `markNotificationRead({ id })` — POST, aggiorna `read = true` solo se `user_id = auth.uid()`.
- `deleteNotification({ id })` — POST, elimina solo se proprietario.
- `createNotification({ data })` — POST con `requireSupabaseAuth`, riservato a admin/moderatori. Sarà usato internamente da `resolveProfileReport`.

### Modifiche `src/lib/reports.functions.ts`

- Aggiornare `AdminReport.status` in `pending | actioned | dismissed`.
- Aggiornare `resolveProfileReport`:
  - input: `id`, `resolution: 'actioned' | 'dismissed'`, `admin_notes?`, `notify_message?`.
  - Se `actioned`:
    - aggiorna report con `status = 'actioned'`, `action_taken = 'warned_user'`.
    - crea notifica per `reported_user_id` con titolo "Il tuo contenuto è stato segnalato" e body che riporta il motivo e le note admin.
  - Se `dismissed`:
    - aggiorna report con `status = 'dismissed'`, nessuna notifica.
- Aggiornare `listProfileReports` per filtrare sui nuovi stati (`pending`, `actioned`, `dismissed`).
- Aggiornare `clearReportedProfileImages`:
  - dopo aver pulito avatar/banner, risolvere anche il report come `actioned` e inviare notifica.

## Frontend

### `src/routes/_authenticated/admin.reports.tsx`

- Sostituire i tab/filtri: `Pending`, `Warned`, `Dismissed`, `All`.
- Sostituire i pulsanti per i report pending:
  - **"Warn user"** (variante destructive) → apre un dialogo di conferma con campo opzionale per messaggio personalizzato alla notifica.
  - **"Dismiss"** (variante secondary) → conferma "Nessuna azione".
- Mostrare nelle card già risolte:
  - Badge `Warned` o `Dismissed`.
  - Se `actioned`, indicare che l'utente è stato notificato.
- Aggiornare `AdminStatsPanel` per conteggiare `pending` e `actioned` (se necessario).

### Notifiche nell'UI (`src/components/app-sidebar.tsx`)

Aggiungere un campanella notifiche nella parte alta o nel pannello account:
- Dropdown che mostra le notifiche non lette + recenti.
- Badge con conteggio unread.
- Click su una notifica la segna come letta e, se presente `link`, naviga.
- Pulsante "Mark all read".
- Query key: `["notifications"]`.

Se il dropdown risulta troppo affollato nella sidebar, posizionarlo nell'header mobile o nella barra superiore globale (`__root.tsx`); valutare in fase di implementazione.

## Integrazione privacy

- La notifica contiene solo: titolo, motivo generale della segnalazione, note admin (non mostra l'identità del segnalante).
- Non viene inviata nessuna notifica quando il report viene dismissato.
- I dati sono protetti da RLS: ogni utente vede solo le proprie notifiche.

## Migrazione

Creare un file SQL in `supabase/migrations/` con:
1. CREATE TABLE `public.notifications`.
2. GRANT statements.
3. ALTER TABLE ... ENABLE ROW LEVEL SECURITY.
4. CREATE POLICY per SELECT/UPDATE/DELETE.
5. Trigger `set_updated_at` su `public.notifications`.
6. (Opzionale) aggiornamento righe esistenti `profile_reports.status = 'reviewed'` in `'actioned'`.

## Dipendenze

Nessun nuovo pacchetto. Si riutilizzano:
- `@/components/ui/dropdown-menu`, `dialog`, `badge`, `button`, `tabs`, `scroll-area`, `alert-dialog`.
- `@tanstack/react-query` per fetching e mutazioni.
- `sonner` per toast di conferma.

## Verifica

- L'admin vede i nuovi pulsanti e può scegliere tra "Warn user" e "Dismiss".
- Dopo "Warn user", l'utente segnalato trova una nuova notifica non letta.
- Dopo "Dismiss", nessuna notifica viene creata.
- L'utente può marcare le notifiche come lette e il badge si aggiorna.
- Il build passa e le policy RLS permettono le operazioni previste.
