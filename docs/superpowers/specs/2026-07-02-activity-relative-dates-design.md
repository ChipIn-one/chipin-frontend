# Activity Relative Dates Design

## Context

Activity events currently render relative time through `RelativeTime`, which calls
`formatRelativeTime` from `helpers/time.ts`. The helper uses hard-coded English
`Intl.RelativeTimeFormat` and `Intl.DateTimeFormat` instances, so relative and
absolute fallback dates do not follow the language selected in user settings.

`ActivityEventsList` is reused on the Activity page, Dashboard, and Group tabs.
Date grouping should therefore live in the shared activity list layer so all
activity feeds behave consistently.

## Goals

- Format relative activity timestamps using the active app language.
- Keep `formatRelativeTime` as a pure helper that accepts a locale instead of
  importing i18n directly.
- Add activity date dividers in every `ActivityEventsList` usage.
- Group events by local device calendar day.
- Render dividers as "today", "yesterday", then localized absolute dates for
  older days.
- Preserve the existing `createdAt` contract where numeric timestamps are Unix
  seconds.

## Non-Goals

- Do not change backend API contracts or activity payloads.
- Do not move UI grouping into Zustand stores.
- Do not introduce new date libraries or dependencies.
- Do not redesign activity cards.
- Do not change pagination or filtering behavior.

## Architecture

Use component-level locale access and pure time helpers.

`RelativeTime` should read the active locale from `react-i18next` and pass it to
`formatRelativeTime(date, locale)`. This keeps `helpers/time.ts` independent from
i18n initialization and avoids a circular dependency with `i18n/index.ts`, which
already imports locale helpers.

`ActivityEventsList` should also read the active locale and build a render list
from the incoming `events`. Before the first event for each local calendar day,
it inserts a date divider. Because the list component is already shared by the
Activity page, Dashboard, and Group tabs, this single change covers all activity
surfaces.

`helpers/time.ts` should expose small pure utilities for timestamp normalization,
relative time formatting, activity divider keying, and activity divider labels.
The helpers should use the local device timezone via JavaScript `Date` behavior.

## Data Flow

1. Activity data remains unchanged and continues to come from stores as
   `AppEvent[]`.
2. `ActivityEventsList` receives events and derives local-day divider groups at
   render time.
3. `ActivityEventsList` renders `ActivityDateDivider` before the first event in
   each group, then renders the existing `EventRenderer`.
4. Event components continue to render `RelativeTime` inside each activity card.
5. When the app language changes, React/i18next re-renders `RelativeTime` and
   `ActivityEventsList`, which recompute localized labels from the same event
   timestamps.

## UI

The divider should use Radix Themes primitives and existing theme tokens. It
should be visually quiet: a small gray label with separators is enough. The label
must come from i18n or `Intl`, not hard-coded JSX strings.

Suggested labels:

- Today: activity namespace key, localized per supported locale.
- Yesterday: activity namespace key, localized per supported locale.
- Older dates: `Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric' })`.

## Error Handling

Invalid or missing locales should fall back safely through browser `Intl`
behavior. Invalid dates are not expected from the typed API contract; the
implementation should preserve existing behavior rather than adding broad
defensive UI branches.

## Testing

Run the existing relevant scripts after implementation:

- `npm run typecheck` for TypeScript safety.
- `npm run verify` if the change is ready for full app verification in the local
  environment.

Manual checks should confirm:

- Relative time changes language after switching app language.
- Activity dividers appear on Activity, Dashboard, and Group activity feeds.
- Events on the same local calendar day share one divider.
- Today/yesterday boundaries follow the local device timezone.
