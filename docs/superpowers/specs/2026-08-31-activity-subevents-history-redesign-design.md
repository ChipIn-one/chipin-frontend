# Activity subevents history and Expense edit redesign

## Goal

Redesign the Activity subevents page so its history stream uses the same wider
layout as the internal dashboard pages and its contextual current state is
visible beside the history on desktop and above it on mobile. The redesign
also removes the unnecessary ledger-entry read from Expense edit
initialization. The Activity API snapshot is the source of truth for the
current Expense state.

Breadcrumbs, global navigation, backend changes, avatars for participant rows,
ledger endpoint redesign, feed pagination rewrites, unrelated activity-card
redesign, Settlement editing, and unrelated modal refactors are out of scope.

## Current-state interpretation

The Activity children response provides a stable root `parent` event and
direct mutation children. A pure shared selector will choose the event with
the greatest `seq` from the root parent plus all loaded children. This handles
the API's newest-first ordering and remains correct if pagination merging
changes the array order.

The root parent remains the original creation event in the History timeline.
The selected latest event is used only for current-state details, action
availability, and Expense edit initialization. The root parent `createdAt` is
always used for the current-state `Created at` field; the latest event time and
Expense business `date` are not interchangeable with it.

The shared selector is pure and has no Zustand or API dependency. The page,
contextual details, action controls, and Expense edit mapping all consume this
same interpretation rather than maintaining a second current-state copy.

## Page and responsive layout

`ActivitySubeventsPage` will use `Container size="4"` with the existing
`InternalPageColumnsFromSm` primitive. `InternalPageLayout` already supplies
the global desktop navigation, so the page will add no navigation column.

The main column will contain the existing History heading, the original
parent event, and `ActivitySubeventsFeed`. The feed remains responsible for
its current initial loading, retry, empty, end-of-feed, and infinite-scroll
behavior. The parent event will not be removed from the history.

The contextual side-panel boundary will render a desktop current-state card
and a mobile current-state summary. The desktop card is shown at the desktop
breakpoint and the compact summary is shown above the main History column on
smaller screens. Both use the same current-state event and details mapping.

The mobile summary is collapsed by default and communicates the amount,
payer or settlement direction, root creation time, and Expense participant
count where applicable. A localized `Details` disclosure expands category,
sharing mode, scope, participant shares, and actions. Radix Themes and the
existing styled-components conventions will be used; no `className` or inline
styles will be introduced.

## Contextual details

Expense details will show the latest snapshot's description, amount and
currency, payer, root creation time, group/scope when present, category,
sharing mode when useful, participant rows, and available actions. Each
participant row uses `shares[].displayName` and the concrete
`shares[].shareAmount`/currency. No raw user ID or avatar is required.

Settlement details use the same panel boundary but show amount/currency,
From, To, root creation time, group/scope when present, and relevant actions.
Settlement details will not render an Expense participant split list.

Actions will no longer be rendered by `ActivitySubeventsHeader`. Existing
Edit and Reverse/Delete behavior will be rendered inside the shared details
content for desktop and mobile. The latest event determines availability; a
latest reversed Expense has no active Edit action. Reversal semantics,
permission checks, confirmation behavior, loading, and error toasts remain
unchanged.

## Expense edit data flow

`prepareExpenseEdit` will become synchronous because it no longer performs a
network read. It will select the latest Expense Activity snapshot and map it
directly to the existing modal edit initialization. The mapping will use:

- `entryId`, description, amount, currency, category, and subcategory from the
  latest metadata;
- `payerId` and `payerDisplayName` for the payer;
- `shares[].userId`, `shares[].displayName`, `shareAmount`, and currency for
  participants;
- the latest nullable `sharingMode`, with a financially faithful Exact-share
  fallback when the mode is absent but concrete shares are available;
- current group/friend objects only as optional enrichment.

Historical participants will be representable with the minimal modal user
shape (`id`, `displayName`, optional picture). The mapper will not fabricate
email, first name, last name, or picture data and will not request the
canonical ledger entry. The final activity type will require
`shares[].displayName`; temporary compatibility for a missing display name
will not be added.

Expense business `date` remains part of create mode and its existing default
behavior. It will be removed from the edit UI and from edit comparison and
PATCH generation. A changed edit will never send `date`, the old date, null,
or Activity `createdAt`. Existing category/subcategory state will be retained
so a category that the user did not change cannot clear the stored
subcategory.

The existing successful-update refresh path will remain the source of truth:
it refreshes Activity, dashboard data, and the relevant group/friends data,
and refreshes visible subevents when the page is open. After the refresh, the
newest child snapshot drives the sidebar, mobile summary, history, and the
next edit initialization.

## Types and module boundaries

`src/api/activity.types.ts` will align the Expense metadata contract with the
backend fields needed here: category, subcategory, nullable date,
nullable sharing mode, payer ID/name, shares with required display names,
and existing field-diff data only where the application already models or
uses it. Reusable activity metadata/share types will be exported from the API
type boundary rather than repeated in UI components.

The current-state selector will remain a pure helper/core boundary. The page
components will consume domain events and a small view-model; they will not
call the ledger API. Store actions will continue to own mutations and refresh
work. Existing feed and modal public boundaries will be preserved unless a
small focused export adjustment is required for the new details components.

## Error and loading behavior

Activity children loading, parent-unavailable fallback, feed errors, retry,
pagination errors, and end-of-feed handling will remain in their current
owners. The contextual details area will show an appropriate loading state
while the parent/children response is unavailable and will not issue another
request. If the parent is unavailable after loading, the existing unavailable
message remains in the history area while the feed can still expose its own
state.

Because edit preparation is synchronous, it will not manufacture a network
loading phase. Existing mutation loading and error handling for update and
reverse/delete remain unchanged.

## Testing and verification

Focused tests will cover:

- root-only and child-selected current state, including highest `seq` when
  input order is not newest-first;
- root `createdAt` in contextual details;
- Expense and Settlement desktop/mobile details, including parent presence in
  History;
- participant display names, concrete shares, and historical participants
  absent from current group/friend collections;
- metadata-only Expense edit initialization, no ledger GET, payer data,
  participant data, category/subcategory, sharing-mode fallback, and
  synchronous preparation;
- edit-only removal of the business date from the UI, diff, and PATCH while
  preserving create-mode date behavior;
- action relocation, reversed-state Edit suppression, and preserved reverse
  behavior;
- successful update refresh causing the latest child snapshot to drive the
  current-state details and the next edit initialization.

The implementation will follow the repository TDD sequence: add a focused
failing test, make the minimum production change, rerun the focused tests,
then run the relevant broader suite, TypeScript/typecheck, lint, and build
where practical. The final inspection will verify no Expense-edit path calls
`ledgerApi.fetchLedgerEntry`, no edit PATCH contains `date`, no participant
rendering depends on avatars/full User API data, and no breadcrumbs were
introduced.
