# Components registry

**Search here before creating anything.** If a component below does the job, use it; if it almost
does, extend it. Radix Themes primitives (`Button`, `Card`, `Dialog`, `Text`, …) are used directly:
see https://www.radix-ui.com/themes/docs. Paths below are import paths inside `apps/app/src`.

## Cards

One card per ChipIn-specific component in [`components/`](components/): purpose, when to use, props,
states, accessibility and i18n, example.

- [Amount](components/amount.md)
- [AmountInput](components/amount-input.md)
- [DebtAmount](components/debt-amount.md)
- [OwedStatusText](components/owed-status-text.md)
- [BalanceBadges](components/balance-badges.md) (with `BalanceBadgesSkeleton`)
- [BalanceSummaryText](components/balance-summary-text.md)
- [UserAvatar](components/user-avatar.md)
- [GroupAvatar](components/group-avatar.md)
- [UsersRow](components/users-row.md)
- [GroupRoleBadge](components/group-role-badge.md)
- [LedgerScopeBadge](components/ledger-scope-badge.md)
- [EmptyState](components/empty-state.md) (with the `No*EmptyState` variants)
- [ChipInLoader](components/chipin-loader.md) (with `PageLoader`)
- [Skeletons](components/skeletons.md) (`BalanceBadgesSkeleton` and `components/skeletons`)
- [SegmentedControl](components/segmented-control.md)
- [Select](components/select.md)
- [Dropdown](components/dropdown.md)
- [ProgressBar](components/progress-bar.md)
- [ModeLogotype](components/mode-logotype.md)

## basics and components

- `basics/` holds presentational components: props in, JSX out. A basic may import only other
  basics, `helpers`, `shared` (money, lib) and the base folders (`constants`, `types`, `i18n`,
  `styles`, `assets`), plus packages (React, Radix, lucide, i18n, `@chipin/tokens`). It may not
  import `store`, `api`, `entities`, `hooks`, `components`, `features` or `pages`, and has no side
  effects (service worker, subscriptions, timers other than animation).
- `components/` holds ChipIn compositions: they may read stores, hooks and entities.
- A presentational component without a store used by two or more features lives in `basics`.

The import rules are enforced by `boundaries` from [`config/eslint/layers.js`](../../config/eslint/layers.js)
(`basics: ['basics', 'helpers', 'shared-lib', 'base']`); the side-effect rule is spec 05 §4.

## basics: exported from `basics/index.ts`

| Name                                                                                                                         | Purpose                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Amount`                                                                                                                     | A money amount with currency, sign and precision; all money output goes through it ([card](components/amount.md))         |
| `AmountInput`                                                                                                                | Text field for a money amount; parses input and limits fraction digits ([card](components/amount-input.md))               |
| `BackButton`                                                                                                                 | Icon button that goes back in history                                                                                     |
| `BackgroundBox`                                                                                                              | Full-height (`100vh`) page box                                                                                            |
| `BalanceBadges`                                                                                                              | Per-currency balance badges with a show-more toggle and a loading skeleton ([card](components/balance-badges.md))         |
| `BalanceSummaryText`                                                                                                         | "You are owed … / you owe … / settled up" sentence for per-currency balances ([card](components/balance-summary-text.md)) |
| `ChipInLoader`                                                                                                               | Animated brand loader (SVG) ([card](components/chipin-loader.md))                                                         |
| `EmptyState`                                                                                                                 | Icon, title, description and one action for a screen without data ([card](components/empty-state.md))                     |
| `NoActivityEmptyState`, `NoFriendsEmptyState`, `NoGroupExpensesEmptyState`, `NoGroupMembersEmptyState`, `NoGroupsEmptyState` | Ready `EmptyState` texts; each takes an optional `action` ([card](components/empty-state.md))                             |
| `GroupRoleBadge`                                                                                                             | "Owner" badge; nothing for other members ([card](components/group-role-badge.md))                                         |
| `Image`                                                                                                                      | Image with loading/error states and a letters fallback; the only allowed `<img>` (ESLint)                                 |
| `LedgerScopeBadge`                                                                                                           | Badge naming the group of a ledger entry; hidden on that group's own page ([card](components/ledger-scope-badge.md))      |
| `OwedStatusText`                                                                                                             | "You are owed / You owe" with the amount, for one signed value ([card](components/owed-status-text.md))                   |
| `PageLoader`                                                                                                                 | Full-screen centered `ChipInLoader` ([card](components/chipin-loader.md))                                                 |
| `RadioCards` (type `RadioCardsItem`)                                                                                         | Radix `RadioCards` built from an `items` list                                                                             |
| `RelativeTime`                                                                                                               | Relative time text in the user's locale and 12/24h format                                                                 |
| `TextArea` (type `TextAreaValueState`)                                                                                       | Labeled text area with description, required flag and validation message                                                  |
| `TextInput` (type `TextInputValueState`)                                                                                     | Labeled text field with description, required flag and validation message                                                 |
| `UserAvatar`                                                                                                                 | User avatar: picture or initials, with a loading state ([card](components/user-avatar.md))                                |

## basics: imported by path

| Name                    | Import path                              | Purpose                                                                                             |
| ----------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `CopyButton`            | `basics/buttons`                         | Button that copies a value and confirms with a tooltip                                              |
| `DebtAmount`            | `basics/DebtAmount`                      | `Amount` colored by debt direction (owed/owe/settled) ([card](components/debt-amount.md))           |
| `Dropdown`              | `basics/Dropdown`                        | Radix dropdown menu from items or sections (icon, hint, disabled) ([card](components/dropdown.md))  |
| `LoadErrorEmptyState`   | `basics/empty-states`                    | `EmptyState` for a failed first load, with one `soft` Retry ([card](components/empty-state.md))     |
| `NoDebtsEmptyState`     | `basics/empty-states`                    | `EmptyState` for "no debts" ([card](components/empty-state.md))                                     |
| `OfflineEmptyState`     | `basics/empty-states`                    | `EmptyState` for offline with nothing cached, no action ([card](components/empty-state.md))         |
| `ProgressBar`           | `basics/progress-bar/ProgressBar`        | Radix `Progress` with the value clamped to `0..max` ([card](components/progress-bar.md))            |
| `SegmentedControl`      | `basics/SegmentedControl`                | Radix segmented control of items, responsive default size ([card](components/segmented-control.md)) |
| `Select`                | `basics/Select`                          | Radix select from items, with a custom item render ([card](components/select.md))                   |
| `BalanceBadgesSkeleton` | `basics/skeletons/BalanceBadgesSkeleton` | Loading placeholder of `BalanceBadges` ([card](components/skeletons.md))                            |

## components: top-level files

| Name                          | Import path                      | Purpose                                                                         |
| ----------------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| `AddExpenseButton`            | `components/AddExpenseButton`    | The global "add expense" button (mobile, desktop, sidebar forms)                |
| `AuthButtons`                 | `components/AuthButtons`         | Social sign-in button (Google)                                                  |
| `CurrencySelect`              | `components/CurrencySelect`      | Searchable currency picker                                                      |
| `Footer`                      | `components/Footer`              | Public pages footer with logo and media links                                   |
| `GroupAvatar`                 | `components/GroupAvatar`         | Group avatar from its cover, icon fallback ([card](components/group-avatar.md)) |
| `GroupsCards`                 | `components/GroupsCards`         | Group card list with debt filter, search and settled toggle                     |
| `GroupsSectionHeader`         | `components/GroupsSectionHeader` | "Groups" section title with the create-group button                             |
| `Header`                      | `components/Header`              | Sticky top header                                                               |
| `LanguageSelector`            | `components/LanguageSelector`    | Language picker (compact or full)                                               |
| `NavButton`, `UnstyledButton` | `components/NavButton`           | Router link (`<a href>`) styled as a button; unstyled base with a focus ring    |
| `OfflineQRCode`               | `components/OfflineQRCode`       | QR code drawn locally on a canvas (works offline)                               |
| `UsersRow`                    | `components/UsersRow`            | Overlapping member avatars, up to `max` ([card](components/users-row.md))       |
| `ViewModeSwitch`              | `components/ViewModeSwitch`      | Switch between group and solo mode                                              |

## components: folders

| Name                                                                                                | Import path                                                           | Purpose                                                                                     |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `BackendUnavailableGate`, `BackendUnavailablePage`                                                  | `components/backend-unavailable-page`                                 | Blocks the app with a full-screen notice while the backend is down                          |
| `DashboardOnboarding`                                                                               | `components/dashboard-onboarding`                                     | Dashboard empty state: what ChipIn is, one first action                                     |
| `DashboardHeader`, `DashboardSummary`                                                               | `components/dashboard-summary`                                        | Dashboard greeting; total balance with expandable details                                   |
| `GlobalErrorBoundary`                                                                               | `components/global-error-boundary`                                    | Top-level crash fallback (renders without the app CSS)                                      |
| `GroupCard`                                                                                         | `components/group-card`                                               | One group as an interactive card with its balance                                           |
| `InteractiveCard`                                                                                   | `components/interactive-card/InteractiveCard`                         | A whole card as a link; rules in [patterns/groups.md](patterns/groups.md#interactive-cards) |
| `LandingNav`, `LandingMobileMenu`                                                                   | `components/header/LandingNav`, `components/header/LandingMobileMenu` | Public header navigation, desktop and mobile                                                |
| `InternalPageLayout`, `InternalPageColumns`, `InternalPageColumnsFromSm`                            | `components/internal-page-layout`                                     | Signed-in page shell (sidebar, mobile nav); main + side columns                             |
| `InviteActionRows`, `InviteQRModal`                                                                 | `components/invite`                                                   | Invite actions (share/copy link, QR); modal with the invite QR                              |
| `InviteJoinConfirmation`                                                                            | `components/invite/InviteJoinConfirmation`                            | Confirm or cancel joining a group or friend from an invite                                  |
| `InviteOnboarding`                                                                                  | `components/invite-onboarding`                                        | Empty state that invites the first friend                                                   |
| `ModeLogotype`                                                                                      | `components/mode-logotype`                                            | Logo with the group/solo mode badge ([card](components/mode-logotype.md))                   |
| `DesktopSidebar`, `HeaderNav`, `MobileNavBar`                                                       | `components/nav-bars`                                                 | App navigation: desktop sidebar, header nav, mobile bottom bar                              |
| `OfflineBanner`                                                                                     | `components/offline-banner`                                           | Inline offline notice with Retry                                                            |
| `OfflineStatus`                                                                                     | `components/offline-status`                                           | Compact offline status above dialogs; no controls                                           |
| `OnlineOnly`, `OnlineOnlyGroup`                                                                     | `components/online-only`                                              | Disable an online-only button / group of controls offline, saying why                       |
| `OutboxBalanceCaption`                                                                              | `components/outbox-balance-caption`                                   | Caption that a balance excludes unsent operations                                           |
| `PageBreadcrumb`                                                                                    | `components/page-breadcrumb`                                          | Back link to the parent page with the page title                                            |
| `SearchSelect`, `CategorySearchSelect`                                                              | `components/search-select`                                            | Searchable select in a popover; the expense category picker                                 |
| `ActivityFeedSkeleton`, `ActivityDateDividerSkeleton`, `FriendsPageSkeleton`, `GroupsCardsSkeleton` | `components/skeletons`                                                | Loading placeholders of those screens ([card](components/skeletons.md))                     |
| `ActivityEventSkeleton`                                                                             | `components/skeletons/activity-event-skeleton`                        | Loading placeholder of one activity event ([card](components/skeletons.md))                 |
| `SummaryDebtCards`, `OwedToYouCard`, `YouOweCard`, `TotalBalanceCard`                               | `components/summary-debt-cards`                                       | Balance summary cards: owed to you, you owe, total                                          |
| `UserProfileSummary`                                                                                | `components/user-profile-summary`                                     | Avatar, name and email of a user                                                            |

## components/modals

Import from `components/modals`. Shells: `BaseModal` (dialog with header, back and close),
`BaseAlertDialog` (confirmation of a destructive action), `OverlayBody`, `OverlayFooter`,
`ModalOverlayGlobalStyles`, `ModalRouter` (multi-step modal navigation). Ready modals:
`AuthModal`, `CreateUpdateGroupModal`, `EarlySupporterPromoModal`, `SettleUpModal`,
`UserAvatarModal`. `SignInEntry` (sign-in button that opens `AuthModal`) is imported from
`components/modals/auth-modal`. Ready confirmations: `KickGroupMemberAlertDialog`, `LeaveGroupAlertDialog`,
`RemoveFriendAlertDialog`, `RemoveGroupAlertDialog`, `RemoveLedgerEntryAlertDialog`.

## Not components, but reuse them

- `useSignOutConfirm` (`components/sign-out-confirm`): sign-out with a confirm dialog when unsent
  operations would be lost.

Developer tools, not for product UI: `DevMenu` (shown to admins), `ThemeSwitcherDev` (`components/`).
