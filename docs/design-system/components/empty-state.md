# EmptyState

`import { EmptyState, NoGroupsEmptyState } from 'basics';` (default exports of
`basics/empty-states/*`, re-exported by name). `NoDebtsEmptyState` is imported from
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
- Not for errors: show an inline error with retry.

## Props

Source: [`basics/empty-states/EmptyState.tsx`](../../../apps/app/src/basics/empty-states/EmptyState.tsx).

| Prop             | Type                     | Default    | Description                                       |
| ---------------- | ------------------------ | ---------- | ------------------------------------------------- |
| `icon`           | `NonNullable<ReactNode>` | required   | Icon in a soft size-4 `Avatar`                    |
| `iconColor`      | Radix `Avatar` `color`   | `'gray'`   | Icon avatar color                                 |
| `title`          | `string`                 | required   | Bold title (`Text size="3"`)                      |
| `description`    | `string`                 | —          | Gray `Text size="1"` under the title              |
| `action`         | `ReactNode`              | —          | The one action (a `Button`)                       |
| `actionPosition` | `'inline' \| 'below'`    | `'inline'` | Action at the right, or full width below the text |

### Variants

Each variant takes only `action?: ReactNode`.

| Variant                        | Namespace: title / description keys                                    | Icon, `iconColor`         |
| ------------------------------ | ---------------------------------------------------------------------- | ------------------------- |
| `NoActivityEmptyState`         | `activity`: `emptyTitle` / `emptyDescription`                          | `ClipboardListIcon`, gray |
| `NoDebtsEmptyState`            | `common`: `noDebtsTitle` / `noDebtsDescription`                        | `BanknoteXIcon`, gray     |
| `NoFilteredActivityEmptyState` | `activity`: `filteredEmptyTitle` / `filteredEmptyDescription`          | `ClipboardListIcon`, gray |
| `NoFriendsEmptyState`          | `friends`: `emptyTitle` / `emptyDescription`                           | `UserPlusIcon`, cyan      |
| `NoGroupExpensesEmptyState`    | `group`: `page.expenses.emptyTitle` / `page.expenses.emptyDescription` | `ReceiptIcon`, jade       |
| `NoGroupMembersEmptyState`     | `group`: `page.balances.empty` / none                                  | `UserPlusIcon`, teal      |
| `NoGroupsEmptyState`           | `dashboard`: `groups.emptyTitle` / `groups.emptyDescription`           | `UsersIcon`, indigo       |

`NoGroupsEmptyState` sets `actionPosition="below"` when it has an action.

## States

- Empty: this component is the empty state.
- Default (with action): one action only; without `action` it is text only.
- Loading, error, disabled: n/a. Show a skeleton while loading ([skeletons.md](skeletons.md)), not
  an empty state.

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
