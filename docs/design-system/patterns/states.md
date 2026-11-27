# States: loading, empty, error, offline and toasts

Every screen or block that shows loaded data handles four states besides "data". Paths are inside
`apps/app/src`. Component cards: [EmptyState](../components/empty-state.md), [skeletons](../components/skeletons.md).

## The four states

| State   | Show                                                 | Never                              |
| ------- | ---------------------------------------------------- | ---------------------------------- |
| Loading | A skeleton of the same layout                        | A centered spinner for the content |
| Empty   | An `EmptyState` variant with one action              | Blank space, or ad-hoc markup      |
| Error   | Inline, where the data would be, with a Retry button | A toast, or a "no data" variant    |
| Offline | The offline badge/banner; cached data stays visible  | A blocking modal                   |

Reference: [`ActivityList`](../../../apps/app/src/features/activity/ActivityList.tsx) checks them
in order: loading -> skeleton, first load failed -> error with Retry, offline with nothing cached
-> offline notice, then the list (`ActivityEventsList`, which falls back to
`NoActivityEmptyState` when it is empty).

## Loading: skeletons

- Use the skeleton of the screen: `ActivityFeedSkeleton`, `FriendsPageSkeleton`,
  `GroupsCardsSkeleton` (`components/skeletons`), `BalanceBadgesSkeleton`
  (`basics/skeletons`). For a single value, Radix `Skeleton` around the real element (as
  `UserAvatar` and `DebtAmount` do with `isLoading`).
- A new data screen adds its skeleton to `components/skeletons`, built from Radix `Skeleton` in
  the same layout as the loaded screen.
- A small `Spinner` is fine only for "loading more" under a list that is already on screen
  (infinite scroll), inside a button (`loading` prop), and next to a control that saves on change
  (with status text, as the `Switch` in `GroupSettingsTab`). `PageLoader` is for route-level waits
  (lazy routes, route guards, sign-in callbacks), not for a block's data.

## Empty: `EmptyState`

- `EmptyState` (`basics`) is the only empty screen: icon, title, optional description, one
  action. The ready variants (`NoActivityEmptyState`, `NoFilteredActivityEmptyState`,
  `NoFriendsEmptyState`,
  `NoGroupExpensesEmptyState`, `NoGroupMembersEmptyState`, `NoGroupsEmptyState`,
  `NoMatchingGroupsEmptyState`, `NoDebtsEmptyState`, `SoloInDevelopmentEmptyState`, and for errors and offline `LoadErrorEmptyState` and `OfflineEmptyState`)
  live in `basics/empty-states`.
- A new empty screen is a new variant file there (fixed icon, color and texts, an optional
  `action` prop), never new markup in the page.
- One action, and it is the screen's next step ("Create group", "Invite a friend"), following
  [principles.md](../principles.md) 5. Use `actionPosition="below"` when the action is a
  full-width button.
- Empty is only for "loaded, and there is nothing". It never stands in for an error or for
  offline with nothing cached.
- Today `ActivitySubeventsFeed` still renders an inline `EmptyState` instead of a variant. Move
  it to a variant when touched.
- First-run screens use the onboarding compositions (`DashboardOnboarding`, `InviteOnboarding`),
  which are built on the same rules.

## Error: inline with Retry

- A failed first load renders in place of the content: `LoadErrorEmptyState`
  (`basics/empty-states`), an `EmptyState` with a `RefreshCwIcon`, the block's error title and
  description from i18n, and a `soft` Retry button (`activity:retryAction`, also reused by the
  group page) that calls `onRetry` to refetch. The Friends page uses it; `ActivityList` still
  renders the same card inline and moves to the variant when touched.
- A failed next page keeps the loaded list and shows a small `soft` Retry button below it
  (`ActivityList`, `GroupTabsContent`).
- Whole-app failures are not screen states: a route render or loader error goes to
  `RouteErrorView` (every route's `errorElement`), a crash outside the router to
  `GlobalErrorBoundary`. The only full-screen blocks are `BackendUnavailableGate` (backend down)
  and `UpdateRequiredScreen` (app version too old).

## Offline

- Offline is shown by status, not a modal. `OfflineBanner` (`components/offline-banner`) is the
  inline amber notice with Retry; it is already mounted by `InternalPageLayout` (every signed-in
  page) and the route guard (`GuardLoader`), so screens never add their own. `OfflineStatus`
  (`components/offline-status`) is the compact badge on top of dialogs and sheets; it has no
  controls (mounted once in `app/router/TopLayer.tsx`).
- Cached data stays on screen while offline. A block with nothing cached shows an `EmptyState`
  with the offline title and no Retry: `OfflineEmptyState` (`basics/empty-states`,
  `errors:network.offline`). The page banner has Retry, and the load resumes by itself on
  reconnect. `ActivityList` still renders this card inline and moves to the variant when touched.
  A whole page with nothing cached on a cold start shows `OfflineLoadError`
  (`features/routing/internal`), which carries the one Retry.
- Buttons of online-only actions are wrapped in `OnlineOnly` / `OnlineOnlyGroup`
  (`components/online-only`) with the action from `constants/onlineOnlyActions.ts`: they stay
  visible, are disabled offline and say why. Do not hide them.
- A balance that excludes unsent operations carries `OutboxBalanceCaption`.

## Toasts

- Toasts (`toast` from `sonner`, rendered by the one toaster in `app/router/TopLayer.tsx`) report
  the result of an action the user just took: saved, created, copied, failed to save (including
  "you are offline" when the action could not run).
- Allowed system events, the only exceptions: the result of a queued offline operation
  (`ConflictNotices`, a toast and never a dialog), session and token problems (`useAuthToasts`), the PWA
  update and install messages, and the public site's language suggestion.
- Never a toast for a load error, for an empty screen or for the offline status itself: those are
  the inline states above.
- The text comes from i18n (`toasts:*`, `errors:*`, or the API error mapping
  `resolveApiErrorMessageFromError`). A failed mutation keeps the user's input on screen (the modal
  or form stays open), and the toast says what failed.

## Forbidden

- A data screen without one of the four states.
- A full-screen spinner or `PageLoader` for one block's data.
- Empty-screen markup outside `basics/empty-states`, or an empty state with two actions.
- An error shown only as a toast, or shown as "no data".
- A modal or a hidden screen for offline.
