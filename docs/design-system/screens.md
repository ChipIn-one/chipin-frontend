# Screens and flows

Every screen, modal and state a user can reach in `apps/app` and `apps/site`, how to reach it with
staging test data, and the main user flows as ordered screen ids. The data is
[`screens.manifest.json`](screens.manifest.json); this page is its human view. Schema and reader:
[`apps/app/src/test/screenManifest.ts`](../../apps/app/src/test/screenManifest.ts). States follow
[patterns/states.md](patterns/states.md).

## How to read a row

- **Id** is stable: `<screen>` for a route's default (populated) view, `<screen>.<state>` for a
  state, `modal.<name>[.<state>]` for a dialog, `site.<page>[.<state>]` for the site, `app.<state>`
  for a whole-app block. Renaming an id is a breaking change for captures and the design canvas.
- **Kind**: `screen` (a route's default view), `state` (the same route in another state),
  `modal` (a dialog, alert dialog or sheet open over its parent row). `(manual)` rows are not
  reached by the automatic capture yet; the note says what is missing.
- **Variants**: every row is checked in both themes (`light`, `dark`) at both widths (390 px
  phone, 1440 px desktop) unless the row names fewer. The theme preference defaults to `system`,
  so a capture sets Playwright `colorScheme` and `viewport`; nothing is stored.
- **Path**: `:groupId`, `:inviteToken` and `:parentActivityId` come from the scenario (the
  provisioning call results) or from the UI steps.
- **How to reach**: a scenario (below), the Playwright fixture, `page.route` mocks (Playwright globs
  on the staging API, `https://api-dev.chipin.one`), UI steps, and "then offline"
  (`context.setOffline(true)` after the steps).

## Test data

- Users and data come only from the staging provisioning client
  (`e2e/support/provisioning.ts`: `register`, `makeFriends`, `createGroup`, `addEqualGroupExpense`,
  `getGroupInviteToken`) under the run id, and are purged after the run (`purgeAndVerify`). The
  `signIn(user)` fixture (`e2e/support/fixtures.ts`) opens a signed-in context; `page` is an
  anonymous one. Names are fake (`E2E A`); there is no real user data.
- Error states mock the failing read with status 500 while `/health` stays up (a 5xx with a healthy
  `/health` is a request error, not an outage); `app.backend-unavailable` mocks `/health` too.
  Loading states mock the read with `hang` in a fresh context (no persisted cache).
- Invite tokens are run-scoped and die with the purge. QR modals show them: blur or crop the QR in
  any capture that leaves CI. Site join pages need no real token (they only check its format).
- Not rows: toasts (they report an action, [states.md](patterns/states.md#toasts)) and dropdown
  menus (part of their screen).

## App routes

One section per `APP_ROUTES` id (`apps/app/src/app/router/routeManifest.ts`).

### `login`

| Id                     | Kind   | Path                          | How to reach                                                                               | Notes                                                                |
| ---------------------- | ------ | ----------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `login`                | screen | `/login`                      | anonymous                                                                                  |                                                                      |
| `login.return-to`      | state  | `/login?returnTo=%2Fsettings` | goto('/settings') signed out: redirects here                                               |                                                                      |
| `login.in-app-browser` | state  | `/login`                      | `browser.newContext({ userAgent })`; in-app browser user agent Variants: light/dark x 390. | InAppBrowserNotice above the Google button (helpers/inAppBrowser.ts) |

### `oauthCallback`

| Id                          | Kind   | Path                                 | How to reach                                   | Notes                                                                                          |
| --------------------------- | ------ | ------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `oauth-callback.signing-in` | screen | `/oauth/callback?code=e2e-fake-code` | mock `POST **/auth/oauth/google/exchange` hang | Transit screen: the PageLoader with 'Signing in'. A fake code only; the exchange never answers |

### `dashboard`

| Id                          | Kind           | Path         | How to reach                                                                                   | Notes                                                                                                                                                                                             |
| --------------------------- | -------------- | ------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard`                 | screen         | `/dashboard` | `group-with-expense`; `signIn(A)`                                                              |                                                                                                                                                                                                   |
| `dashboard.welcome`         | state          | `/dashboard` | `new-user`; `signIn(A)`                                                                        | First run: DashboardOnboarding (Create group, Invite a friend), no side groups section                                                                                                            |
| `dashboard.empty`           | state          | `/dashboard` | `friends-pair`; `signIn(A)`                                                                    | Has a friend, so not the welcome: NoActivityEmptyState and NoGroupsEmptyState. Unconfirmed whether makeFriends writes an activity event                                                           |
| `dashboard.loading`         | state          | `/dashboard` | `group-with-expense`; `signIn(A)`; mock `GET **/users/known-users` hang, `GET **/groups*` hang | ActivityFeedSkeleton; a fresh context has no persisted cache                                                                                                                                      |
| `dashboard.error`           | state          | `/dashboard` | `group-with-expense`; `signIn(A)`; mock `GET **/users/known-users` 500                         | Inline load error with Retry; /health stays up, so this is not the backend-down screen                                                                                                            |
| `dashboard.refresh-error`   | state          | `/dashboard` | `group-with-expense`; `signIn(A)`; mock `GET **/currency-rates*` 500                           | Data on screen plus the small 'could not load' row with Retry                                                                                                                                     |
| `dashboard.offline`         | state          | `/dashboard` | `group-with-expense`; `signIn(A)`; wait for the balances to render; then offline               | OfflineBanner over the cached data; online-only buttons disabled (specs/money/offline.spec.ts)                                                                                                    |
| `dashboard.offline-no-data` | state (manual) | `/dashboard` | `new-user`; `signIn(A)`; then offline                                                          | OfflineLoadError (NET-008): a cold start offline with nothing saved on the device. Needs the app shell from the service worker (playwright.sw.config.ts build); not confirmed with the dev server |
| `dashboard.long-content`    | state          | `/dashboard` | `long-content`; `signIn(A)`                                                                    |                                                                                                                                                                                                   |

### `group`

| Id                       | Kind   | Path                                          | How to reach                                                                            | Notes                                                                                      |
| ------------------------ | ------ | --------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `group`                  | screen | `/group/:groupId`                             | `group-with-expense`; `signIn(A)`; openGroupWithGroupsList(page, groupId)               | Expenses tab                                                                               |
| `group.balances`         | state  | `/group/:groupId`                             | `group-with-expense`; `signIn(B)`; openGroupTab(page, groupId, 'Balances')              | As B, the debtor: the row has Settle up                                                    |
| `group.balances.settled` | state  | `/group/:groupId`                             | `group-pair`; `signIn(A)`; openGroupTab(page, groupId, 'Balances')                      | Everyone settled up (expectSettledUp)                                                      |
| `group.settings`         | state  | `/group/:groupId`                             | `group-with-expense`; `signIn(A)`; openGroupTab(page, groupId, 'Settings')              | As the owner: invite rows, members with Kick, Delete group                                 |
| `group.solo`             | state  | `/group/:groupId`                             | `solo-group`; `signIn(A)`; openGroupWithGroupsList(page, groupId)                       | Only member: GroupInviteEmptyState (invite onboarding) instead of the expenses empty state |
| `group.empty`            | state  | `/group/:groupId`                             | `group-pair`; `signIn(A)`; openGroupWithGroupsList(page, groupId)                       | NoGroupExpensesEmptyState with Add expense                                                 |
| `group.loading`          | state  | `/group/:groupId`                             | `group-pair`; `signIn(A)`; mock `GET **/groups/*` hang, `GET **/groups*` hang           | Cover and side skeletons of an unlisted group                                              |
| `group.error`            | state  | `/group/:groupId`                             | `group-pair`; `signIn(A)`; mock `GET **/groups/*` 500, `GET **/groups*` 500             | Load error with Retry, never 'not found'                                                   |
| `group.not-found`        | state  | `/group/00000000-0000-4000-8000-000000000000` | `new-user`; `signIn(A)`                                                                 | GroupNotFound: the API denies an unknown group (403/404)                                   |
| `group.invalid-id`       | state  | `/group/not-a-uuid`                           | `new-user`; `signIn(A)`                                                                 | validateUuidParam throws 404: RouteErrorView renders Page404 inside the layout             |
| `group.offline`          | state  | `/group/:groupId`                             | `group-with-expense`; `signIn(A)`; openGroupWithGroupsList(page, groupId); then offline | Banner over cached data; Settle up and Add expense stay visible and disabled               |
| `group.long-content`     | state  | `/group/:groupId`                             | `long-content`; `signIn(A)`; openGroupWithGroupsList(page, groupId)                     |                                                                                            |

### `groupJoin`

| Id                   | Kind   | Path                                    | How to reach                                                                 | Notes                                                                                                               |
| -------------------- | ------ | --------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `group-join`         | screen | `/group/join/:inviteToken`              | `group-invite`; `signIn(C)`                                                  | InviteJoinConfirmation, status ready (specs/money/group-invite.spec.ts). The token is dead after the run purge      |
| `group-join.joining` | state  | `/group/join/:inviteToken`              | `group-invite`; `signIn(C)`; mock `POST **/groups/invite/*` hang; click Join |                                                                                                                     |
| `group-join.invalid` | state  | `/group/join/e2eUnknownInviteToken0000` | `new-user`; `signIn(A)`; mock `POST **/groups/invite/*` 404; click Join      | Invalid or expired invite: title and Go home. Which error codes map to invalid is in hooks/useInviteConfirmation.ts |
| `group-join.error`   | state  | `/group/join/:inviteToken`              | `group-invite`; `signIn(C)`; mock `POST **/groups/invite/*` 500; click Join  | Error message with Retry                                                                                            |

### `friendJoin`

| Id                    | Kind   | Path                                      | How to reach                                                                               | Notes |
| --------------------- | ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------ | ----- |
| `friend-join`         | screen | `/friends/join/:inviteToken`              | `friend-invite`; `signIn(C)`                                                               |       |
| `friend-join.joining` | state  | `/friends/join/:inviteToken`              | `friend-invite`; `signIn(C)`; mock `POST **/users/invite/*` hang; click the confirm button |       |
| `friend-join.invalid` | state  | `/friends/join/e2eUnknownInviteToken0000` | `new-user`; `signIn(A)`; mock `POST **/users/invite/*` 404; click the confirm button       |       |
| `friend-join.error`   | state  | `/friends/join/:inviteToken`              | `friend-invite`; `signIn(C)`; mock `POST **/users/invite/*` 500; click the confirm button  |       |

### `activity`

| Id                         | Kind   | Path        | How to reach                                                                                                                              | Notes                                                                                                    |
| -------------------------- | ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `activity`                 | screen | `/activity` | `group-with-expense`; `signIn(A)`                                                                                                         |                                                                                                          |
| `activity.empty`           | state  | `/activity` | `new-user`; `signIn(A)`                                                                                                                   | NoActivityEmptyState with Add expense                                                                    |
| `activity.filtered-empty`  | state  | `/activity` | `group-with-expense`; `signIn(A)`; select the Settlements filter                                                                          | NoFilteredActivityEmptyState with Show all (EXP-066)                                                     |
| `activity.loading`         | state  | `/activity` | `group-with-expense`; `signIn(A)`; mock `GET **/users/self/activities*` hang                                                              |                                                                                                          |
| `activity.error`           | state  | `/activity` | `group-with-expense`; `signIn(A)`; mock `GET **/users/self/activities*` 500                                                               |                                                                                                          |
| `activity.offline-no-data` | state  | `/activity` | `group-with-expense`; `signIn(A)`; goto('/dashboard') and wait for the feed; context.setOffline(true); click the Activity navigation link | Offline EmptyState: the full feed was never cached. Unconfirmed that the previews cache does not fill it |
| `activity.next-page-error` | state  | `/activity` | `long-content`; `signIn(A)`; mock `GET **/users/self/activities?*cursor=*` 500; scroll to the end of the feed                             | The loaded list stays, a soft Retry below it                                                             |
| `activity.long-content`    | state  | `/activity` | `long-content`; `signIn(A)`                                                                                                               |                                                                                                          |

### `activityDetails`

| Id                             | Kind   | Path                                             | How to reach                                                                                                                                                                        | Notes                                                  |
| ------------------------------ | ------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `activity-details`             | screen | `/activity/:parentActivityId`                    | `group-with-expense`; `signIn(A)`; goto('/activity'); click the 'E2E dinner' row                                                                                                    | An expense with Edit and Delete                        |
| `activity-details.settlement`  | state  | `/activity/:parentActivityId`                    | `group-with-expense`; `signIn(B)`; record a partial settlement in the UI as specs/money/settle-up.spec.ts does; goto('/activity'); click the settlement row                         | The provisioning client has no settlement helper yet   |
| `activity-details.loading`     | state  | `/activity/:parentActivityId`                    | `group-with-expense`; `signIn(A)`; mock `GET **/users/self/activities/*/children*` hang; read parentActivityId as in activity-details, then goto the details URL in a fresh context |                                                        |
| `activity-details.unavailable` | state  | `/activity/00000000-0000-4000-8000-000000000000` | `new-user`; `signIn(A)`                                                                                                                                                             | A deleted or unknown entry: the unavailable EmptyState |
| `activity-details.invalid-id`  | state  | `/activity/not-a-uuid`                           | `new-user`; `signIn(A)`                                                                                                                                                             | RouteErrorView NotFound                                |

### `friends`

| Id                     | Kind   | Path       | How to reach                                                               | Notes                                       |
| ---------------------- | ------ | ---------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| `friends`              | screen | `/friends` | `group-with-expense`; `signIn(A)`                                          | A friend with a debt, per-currency card     |
| `friends.empty`        | state  | `/friends` | `new-user`; `signIn(A)`                                                    | FriendInviteEmptyState with the invite rows |
| `friends.settled`      | state  | `/friends` | `friends-pair`; `signIn(A)`                                                | Friends without debts: SettledUpCard        |
| `friends.loading`      | state  | `/friends` | `friends-pair`; `signIn(A)`; mock `GET **/users/known-users` hang          | FriendsPageSkeleton                         |
| `friends.error`        | state  | `/friends` | `friends-pair`; `signIn(A)`; mock `GET **/users/known-users` 500           | LoadErrorEmptyState with Retry              |
| `friends.offline`      | state  | `/friends` | `group-with-expense`; `signIn(A)`; wait for the friends list; then offline |                                             |
| `friends.long-content` | state  | `/friends` | `long-content`; `signIn(A)`                                                |                                             |

### `settings`

| Id                 | Kind   | Path        | How to reach                                                        | Notes                                                                                            |
| ------------------ | ------ | ----------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `settings`         | screen | `/settings` | `new-user`; `signIn(A)`                                             |                                                                                                  |
| `settings.loading` | state  | `/settings` | `new-user`; `signIn(A)`; mock `GET **/users/self` hang              | Section skeletons. Unconfirmed: signIn may seed the self user, then the page is never in loading |
| `settings.offline` | state  | `/settings` | `new-user`; `signIn(A)`; wait for the account section; then offline | Log out other devices disabled with its online-only reason                                       |

### `notFound`

| Id                    | Kind   | Path         | How to reach            | Notes                                                        |
| --------------------- | ------ | ------------ | ----------------------- | ------------------------------------------------------------ |
| `not-found`           | screen | `/not-found` | anonymous               | Any unknown path (/e2e-missing) redirects here (the * route) |
| `not-found.signed-in` | state  | `/not-found` | `new-user`; `signIn(A)` |                                                              |

### App-wide states

| Id                        | Kind           | Path         | How to reach                                                                                                                 | Notes                                                                                                                                                  |
| ------------------------- | -------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app.backend-unavailable` | state          | `/dashboard` | `new-user`; `signIn(A)`; mock `GET **/health` 503, `ANY **/users/self*` 503                                                  | BackendUnavailableGate: the only full-screen block for an outage                                                                                       |
| `app.update-required`     | state          | `/dashboard` | `new-user`; `signIn(A)`; mock `GET **/users/self` 426                                                                        | UpdateRequiredScreen (app/pwa). The exact 426 body shape is in shared/api/interceptors.ts                                                              |
| `app.route-error`         | state (manual) | `/friends`   | `new-user`; `signIn(A)`; goto('/dashboard'); page.route on the friends route chunk: abort; click the Friends navigation link | RouteErrorView for a failed lazy chunk (new-version or offline variant). The chunk URL is hashed per build, so the mock needs a build-specific pattern |

## Modals

| Id                                | Kind           | Path                          | Opened from                   | How to reach                                                                                                                                                                                             | Notes                                                                                                                                            |
| --------------------------------- | -------------- | ----------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `modal.session-expired`           | modal (manual) | `/settings`                   | `settings`                    | `new-user`; `signIn(A)`; wait for the page; page.route POST **/auth/refresh: fulfill 401, and the next API read: 401; trigger a refetch (window focus)                                                   | AuthModal over the hidden page (AuthLayout). Not confirmed which 401 sequence ends the session without a full logout                             |
| `modal.sign-in`                   | modal          | `/not-found`                  | `not-found`                   | click Sign in in the header                                                                                                                                                                              | AuthModal through SignInEntry; the Google button never completes                                                                                 |
| `modal.early-supporter-promo`     | modal (manual) | `/dashboard`                  | `dashboard.welcome`           | `new-user`; goto('/oauth/callback?code=e2e-fake-code') with POST **/auth/oauth/google/exchange fulfilled by A's token and is_new_user: true; GET **/users/premium-promo fulfilled with a remaining count | Shown once for a new user's first sign-in with subscriptionUntil set. The exchange mock must carry A's provisioned token; unconfirmed end to end |
| `modal.create-group`              | modal          | `/dashboard`                  | `dashboard.welcome`           | `new-user`; `signIn(A)`; click Create group                                                                                                                                                              |                                                                                                                                                  |
| `modal.create-group.validation`   | modal          | `/dashboard`                  | `modal.create-group`          | `new-user`; `signIn(A)`; click Create group; submit with an empty name                                                                                                                                   |                                                                                                                                                  |
| `modal.edit-group`                | modal          | `/group/:groupId`             | `group`                       | `group-pair`; `signIn(A)`; openGroupWithGroupsList(page, groupId); click the cover edit button                                                                                                           | CreateUpdateGroupModal type update, with the cover picker                                                                                        |
| `modal.add-expense`               | modal          | `/dashboard`                  | `dashboard`                   | `group-with-expense`; `signIn(A)`; click Add expense                                                                                                                                                     | Dialog 'Add an expense' with the group picker                                                                                                    |
| `modal.add-expense.group`         | modal          | `/group/:groupId`             | `group`                       | `group-pair`; `signIn(A)`; openGroupWithGroupsList(page, groupId); click Add expense                                                                                                                     | Group preset (expectExpenseDialogGroup, expectExpenseDialogMembers)                                                                              |
| `modal.add-expense.split-amounts` | modal          | `/group/:groupId`             | `modal.add-expense.group`     | `long-content`; `signIn(A)`; openGroupWithGroupsList(page, groupId); click Add expense; choose the Amounts split (specs/money/split.spec.ts)                                                             | Many participants: the split control and participant list at 390 (#494 items 9)                                                                  |
| `modal.add-expense.validation`    | modal          | `/group/:groupId`             | `modal.add-expense.group`     | `group-pair`; `signIn(A)`; openGroupWithGroupsList(page, groupId); click Add expense; submit with no amount                                                                                              |                                                                                                                                                  |
| `modal.add-expense.no-friend`     | modal          | `/dashboard`                  | `dashboard.welcome`           | `new-user`; `signIn(A)`; click Add expense                                                                                                                                                               | NoDirectFriendEmptyState (EXP-067). Unconfirmed that the Add expense button shows on the welcome screen                                          |
| `modal.add-expense.offline`       | modal          | `/group/:groupId`             | `modal.add-expense.group`     | `group-pair`; `signIn(A)`; openGroupWithGroupsList(page, groupId); click Add expense; then offline                                                                                                       | OfflineStatus badge above the dialog; submit disabled (offline writes are off)                                                                   |
| `modal.edit-expense`              | modal          | `/activity/:parentActivityId` | `activity-details`            | `group-with-expense`; `signIn(A)`; open activity-details; click Edit                                                                                                                                     | Dialog 'Edit expense' (specs/money/edit-delete-expense.spec.ts)                                                                                  |
| `modal.delete-expense`            | modal          | `/activity/:parentActivityId` | `activity-details`            | `group-with-expense`; `signIn(A)`; open activity-details; click Delete                                                                                                                                   | RemoveLedgerEntryAlertDialog 'Delete entry'                                                                                                      |
| `modal.settle-up.choose-debt`     | modal          | `/group/:groupId`             | `group.balances`              | `group-with-expense`; `signIn(B)`; openGroupTab(page, groupId, 'Balances'); click Settle up                                                                                                              | Dialog 'Choose a debt' (specs/money/settle-up.spec.ts)                                                                                           |
| `modal.settle-up.record-payment`  | modal          | `/group/:groupId`             | `modal.settle-up.choose-debt` | `group-with-expense`; `signIn(B)`; openGroupTab(page, groupId, 'Balances'); click Settle up; choose the debt to A                                                                                        | Dialog 'Record payment' with the amount field                                                                                                    |
| `modal.settle-up.friend`          | modal          | `/friends`                    | `friends`                     | `group-with-expense`; `signIn(B)`; open A's actions menu; click Settle up                                                                                                                                | SettleUpModal source friend                                                                                                                      |
| `modal.invite-qr.group`           | modal          | `/group/:groupId`             | `group.settings`              | `group-pair`; `signIn(A)`; openGroupTab(page, groupId, 'Settings'); click Show QR code                                                                                                                   | The QR encodes a real but run-scoped invite token: blur or crop it in shared captures                                                            |
| `modal.invite-qr.friend`          | modal          | `/friends`                    | `friends.empty`               | `new-user`; `signIn(A)`; click Show QR code                                                                                                                                                              | Run-scoped friend invite token in the QR: blur it in shared captures                                                                             |
| `modal.remove-friend`             | modal          | `/friends`                    | `friends`                     | `friends-pair`; `signIn(A)`; open B's actions menu; click Remove                                                                                                                                         |                                                                                                                                                  |
| `modal.kick-member`               | modal          | `/group/:groupId`             | `group.settings`              | `group-pair`; `signIn(A)`; openGroupTab(page, groupId, 'Settings'); click Kick on B                                                                                                                      |                                                                                                                                                  |
| `modal.leave-group`               | modal          | `/group/:groupId`             | `group.settings`              | `group-pair`; `signIn(B)`; openGroupTab(page, groupId, 'Settings'); click Leave group                                                                                                                    |                                                                                                                                                  |
| `modal.delete-group`              | modal          | `/group/:groupId`             | `group.settings`              | `group-pair`; `signIn(A)`; openGroupTab(page, groupId, 'Settings'); click Delete group                                                                                                                   | Destructive confirm; never confirm it in a capture                                                                                               |
| `modal.user-avatar`               | modal          | `/settings`                   | `settings`                    | `new-user`; `signIn(A)`; click the avatar in the account section                                                                                                                                         |                                                                                                                                                  |

## Site pages

| Id                         | Kind   | Page                     | Path                                  | How to reach | Notes                                                                             |
| -------------------------- | ------ | ------------------------ | ------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| `site.home`                | screen | `index.astro`            | `/`                                   | anonymous    |                                                                                   |
| `site.home.ru`             | state  | `[locale]/index.astro`   | `/ru/`                                | anonymous    | One row per NON_DEFAULT_LOCALES entry (today only ru)                             |
| `site.privacy`             | screen | `privacy.astro`          | `/privacy`                            | anonymous    | Long content: the whole policy                                                    |
| `site.privacy.ru`          | state  | `[locale]/privacy.astro` | `/ru/privacy`                         | anonymous    |                                                                                   |
| `site.terms`               | screen | `terms.astro`            | `/terms`                              | anonymous    |                                                                                   |
| `site.terms.ru`            | state  | `[locale]/terms.astro`   | `/ru/terms`                           | anonymous    |                                                                                   |
| `site.not-found`           | screen | `404.astro`              | `/e2e-missing-page`                   | anonymous    |                                                                                   |
| `site.join-friend`         | screen | `join/friend.astro`      | `/join/friend/e2eFakeInviteToken0001` | anonymous    | A format-valid fake token: the page never calls the API, it only links to the app |
| `site.join-friend.invalid` | state  | `join/friend.astro`      | `/join/friend/x`                      | anonymous    | 'The link is broken' (token fails INVITE_TOKEN_PATTERN)                           |
| `site.join-group`          | screen | `join/group.astro`       | `/join/group/e2eFakeInviteToken0001`  | anonymous    |                                                                                   |
| `site.join-group.invalid`  | state  | `join/group.astro`       | `/join/group/x`                       | anonymous    |                                                                                   |

## Excluded

| Entry                               | Reason                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| route `home`                        | Index route with no page: its loader redirects to /dashboard (or Solo); only the shared PageLoader shows while it waits |
| route `solo`                        | Unreachable: IS_SOLO_MODE_RELEASED is false and Solo needs an admin role, so SoloGuardLayout redirects to /dashboard    |
| router path `*`                     | Catch-all redirect to /not-found, covered by the not-found row                                                          |
| `OutboxSheet`                       | Behind VITE_FEATURE_OFFLINE_WRITES, which is off until 03-17                                                            |
| `AccountSwitchDialog`               | Only with the offline-writes flag (isUnsentOpsConfirmOn); off in every deployed build                                   |
| `useSignOutConfirm dialog`          | Only with the offline-writes flag; with it off sign-out runs at once                                                    |
| `ConflictDraftNotice`               | Outbox conflicts exist only with the offline-writes flag                                                                |
| `ServiceWorkerManager update toast` | A toast, not a screen; needs a waiting service worker (playwright.sw.config.ts), covered by e2e/sw.spec.ts              |

## Flows

| Flow                                                | Steps                                                                                                                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sign-up-onboarding` Sign up and onboarding         | `site.home` -> `login` -> `oauth-callback.signing-in` -> `modal.early-supporter-promo` -> `dashboard.welcome` -> `modal.create-group` -> `group.solo` -> `modal.invite-qr.group` |
| `first-group` First group                           | `dashboard.welcome` -> `modal.create-group` -> `group.solo`                                                                                                                      |
| `first-expense` First expense                       | `group.empty` -> `modal.add-expense.group` -> `group` -> `group.balances`                                                                                                        |
| `settle-up` Settle up                               | `group.balances` -> `modal.settle-up.choose-debt` -> `modal.settle-up.record-payment` -> `group.balances.settled` -> `activity`                                                  |
| `invite-friend` Invite a friend and join by invite  | `friends.empty` -> `modal.invite-qr.friend` -> `site.join-friend` -> `friend-join` -> `friends.settled`                                                                          |
| `invite-group` Invite to a group and join by invite | `group.settings` -> `modal.invite-qr.group` -> `site.join-group` -> `group-join` -> `group.empty`                                                                                |
| `sign-in-sign-out` Sign in and sign out             | `site.home` -> `login` -> `oauth-callback.signing-in` -> `dashboard` -> `settings` -> `site.home`                                                                                |

## Scenarios

| Scenario             | Data                                                                            | Provisioning calls                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new-user`           | One fresh user: no friends, no groups, no activity                              | `A = register('E2E A')`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `friends-pair`       | Two users who are friends, no group and no expense                              | `A = register('E2E A')`; `B = register('E2E B')`; `makeFriends(A, B)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `solo-group`         | One user who owns a group without other members                                 | `A = register('E2E A')`; `groupId = createGroup(A, 'E2E Trip', [])`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `group-pair`         | Two friends in one group owned by A, no expense                                 | `A = register('E2E A')`; `B = register('E2E B')`; `makeFriends(A, B)`; `groupId = createGroup(A, 'E2E Trip', [B])`                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `group-with-expense` | group-pair plus one 30 USD expense paid by A, split equally: B owes A 15 USD    | `A = register('E2E A')`; `B = register('E2E B')`; `makeFriends(A, B)`; `groupId = createGroup(A, 'E2E Trip', [B])`; `addEqualGroupExpense({ groupId, payer: A, participants: [A, B], amount: 30, description: 'E2E dinner' })`                                                                                                                                                                                                                                                                                                                                         |
| `long-content`       | Long names, many members and items, large amounts                               | `A = register('E2E Alexandria Konstantinopolskaya-Wolfeschlegel')`; `M1..M8 = register('E2E Member <n> with a rather long display name')`; `makeFriends(A, Mn) for each member`; `groupId = createGroup(A, 'E2E Weekend in the mountains with the whole extended family 2026', [M1..M8])`; `addEqualGroupExpense({ groupId, payer: A, participants: [A, M1..M8], amount: 9999999.99, description: 'E2E very long expense description that does not fit on one line at phone width' })`; `addEqualGroupExpense(...) x 25 more, small amounts (more than one feed page)` |
| `group-invite`       | A owns a group without other members; C is not a member; the group invite token | `A = register('E2E A')`; `C = register('E2E C')`; `groupId = createGroup(A, 'E2E Trip', [])`; `inviteToken = getGroupInviteToken(A, groupId)`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `friend-invite`      | Two users who are not friends, and A's friend invite token                      | `A = register('E2E A')`; `C = register('E2E C')`; `inviteToken = (GET /users/self as A).inviteToken: no helper yet, #998 adds getFriendInviteToken`                                                                                                                                                                                                                                                                                                                                                                                                                    |

## How the manifest is used

- **#998, captures after every `master` merge.** A Playwright project reads the manifest
  (`readFileSync(SCREEN_MANIFEST_FILE)` + `parseScreenManifest`), provisions each scenario once,
  and for every `auto` row and each `screenVariants(manifest, row)` variant opens `path`, applies
  the mocks, steps and offline switch, and saves `<id>.<theme>.<width>.png`. Rows with
  `capture: "manual"` are skipped until their setup lands. Flows give the order of a flow strip.
- **#999, the Claude Design screens canvas.** A sync job maps each id to a canvas frame (one frame
  per id, the variants as its four views) and each flow to a row of frames; a new id adds a frame,
  a removed id archives its frame. Ids are the join key, so they never change silently.

## Keeping it complete

`apps/app/src/app/router/screenManifest.test.ts` fails when an `APP_ROUTES` entry has neither a row
nor an `excluded` entry, when a leaf of the route tree that `buildAppRoutes` builds is not covered
(the tree is walked without rendering, so the router refactor #767-#769 keeps the check honest),
when a file in `apps/site/src/pages/**/*.astro` has no row (filesystem glob), or when ids repeat,
a parent or flow step is unknown, or the schema does not parse. A new route, page, modal or state
adds its rows in the same PR. Run it with
`npm run test:task -- src/app/router/screenManifest.test.ts`.
