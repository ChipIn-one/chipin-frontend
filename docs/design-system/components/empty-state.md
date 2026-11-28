# EmptyState

`import { EmptyState, NoGroupsEmptyState } from 'basics';` (default exports of
`basics/empty-states/*`, re-exported by name). `NoDebtsEmptyState`, `NoDirectFriendEmptyState`,
`LoadErrorEmptyState` and `OfflineEmptyState` (named exports) are imported from
`basics/empty-states` only.

## Purpose

A card with an icon, a title, an optional description and one action for a screen or section
without data.

## When to use

- A list or data screen or section with no items.
- Use a ready `No*EmptyState` variant when one fits; a new empty case gets a new variant here, not
  new markup.
- First-run onboarding of the whole dashboard: `DashboardOnboarding`; inviting the first friend:
  `InviteOnboarding` (both in `components/`).
- Not for errors or offline as "no data": a failed first load uses `LoadErrorEmptyState`, offline
  with nothing cached uses `OfflineEmptyState` (below).

## Props

Source: [`basics/empty-states/EmptyState.tsx`](../../../apps/app/src/basics/empty-states/EmptyState.tsx).

| Prop             | Type                     | Default              | Description                                       |
| ---------------- | ------------------------ | -------------------- | ------------------------------------------------- |
| `icon`           | `NonNullable<ReactNode>` | required             | Icon in a soft size-4 `Avatar`                    |
| `iconColor`      | Radix `Avatar` `color`   | `PROP_COLOR.neutral` | Icon avatar color                                 |
| `title`          | `string`                 | required             | Bold title (`Text size="3"`)                      |
| `description`    | `string`                 | —                    | Gray `Text size="1"` under the title              |
| `action`         | `ReactNode`              | —                    | The one action (a `Button`)                       |
| `actionPosition` | `'inline' \| 'below'`    | `'inline'`           | Action at the right, or full width below the text |

### Variants

Each variant takes `action?: ReactNode`.

| Variant                        | Namespace: title / description keys                                                                         | Icon, `iconColor`                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `NoActivityEmptyState`         | `activity`: `emptyTitle` / `emptyDescription`                                                               | `ClipboardListIcon`, `PROP_COLOR.neutral`          |
| `NoDebtsEmptyState`            | `common`: `noDebtsTitle` / `noDebtsDescription`                                                             | `BanknoteXIcon`, `PROP_COLOR.neutral`              |
| `NoDirectFriendEmptyState`     | `group`: `expenses.modal.directNoFriend.title` / `expenses.modal.directNoFriend.description`                | `UserPlusIcon`, `PROP_COLOR.info`                  |
| `NoFilteredActivityEmptyState` | `activity`: `filteredEmptyTitle` / `filteredEmptyDescription`                                               | `ClipboardListIcon`, `PROP_COLOR.neutral`          |
| `NoFriendsEmptyState`          | `friends`: `emptyTitle` / `emptyDescription`                                                                | `UserPlusIcon`, `PROP_COLOR.accent`                |
| `NoGroupExpensesEmptyState`    | `group`: `page.expenses.emptyTitle` / `page.expenses.emptyDescription`                                      | `ReceiptIcon`, `PROP_COLOR.accent`                 |
| `NoGroupMembersEmptyState`     | `group`: `page.balances.empty` / none                                                                       | `UserPlusIcon`, `PROP_COLOR.accent`                |
| `NoGroupsEmptyState`           | `dashboard`: `groups.emptyTitle` / `groups.emptyDescription`                                                | `UsersIcon`, `PROP_COLOR.accent`                   |
| `NoMatchingGroupsEmptyState`   | `dashboard`: `groups.filterEmptyTitle` / `groups.filterEmptyDescription` or `groups.searchEmptyDescription` | `FilterXIcon`, `PROP_COLOR.neutral`                |
| `SoloInDevelopmentEmptyState`  | `dashboard`: `solo.summaryTitle` or `solo.activityTitle` / `solo.inDevelopment`                             | `WalletCardsIcon` or `ListIcon`, `PROP_COLOR.solo` |

`NoGroupsEmptyState` and `NoDirectFriendEmptyState` set `actionPosition="below"` when they have an
action. `NoDirectFriendEmptyState` is the Add Expense editor's direct target with no mutual known
user (KB EXP-067); its action is the personal invite, or Retry (reloads the self user) when there
is no invite token. Exception to the one-action rule: the editor may put one `ghost` secondary
action outside the card, switching to an eligible group (dashboard context only, where the editor
has a group picker). Two variants take one
more prop: `NoMatchingGroupsEmptyState` takes `hasSearchQuery` (the description names the search
rather than the debt filter), and `SoloInDevelopmentEmptyState` takes `section`
(`'summary' | 'activity'`).

### Error and offline variants

For a block whose first load failed, or waits for the network, with nothing cached
([patterns/states.md](../patterns/states.md)). Never a `No*` variant in these cases.

| Variant               | Props                                                         | Texts                                                                             | Icon, action                                                            |
| --------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `LoadErrorEmptyState` | `title: string`, `description: string`, `onRetry: () => void` | The block's own translated title and description; Retry is `activity:retryAction` | `RefreshCwIcon`, gray; a fixed `soft` Retry button that calls `onRetry` |
| `OfflineEmptyState`   | none                                                          | `errors:network.offline`                                                          | `WifiOffIcon`, gray; no action (the page's `OfflineBanner` has Retry)   |

## States

- Empty: this component is the empty state.
- Default (with action): one action only; without `action` it is text only.
- Loading, disabled: n/a. Show a skeleton while loading ([skeletons.md](skeletons.md)), not an
  empty state.
- Error and offline: `LoadErrorEmptyState` and `OfflineEmptyState` (above).

## Accessibility and i18n

- A Radix `Card` with `data-empty-state`; the action box has `data-empty-state-action`.
- The title is `Text as="p"`, not a heading; the screen keeps its own title.
- The icon sits in an `Avatar` fallback; give it no text.
- i18n: `EmptyState` itself has none (pass translated `title`/`description`); variant keys are in
  the table above.

One primary action per screen: `action` is a single control. If the screen already has a solid
primary button (for example the global `AddExpenseButton`), the empty-state action is `soft` or
`outline`. See [patterns/hierarchy.md](../patterns/hierarchy.md).

Screen-level rules: patterns/states.md (ChipIn-one/chipin-frontend#490).

## Example

```tsx
import { Button } from '@radix-ui/themes';

import { NoGroupsEmptyState } from 'basics';

<NoGroupsEmptyState
    action={
        <Button variant="soft" onClick={onCreateGroup}>
            {createGroupLabel}
        </Button>
    }
/>;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
