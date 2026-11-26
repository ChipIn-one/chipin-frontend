# Skeletons

`import { BalanceBadgesSkeleton } from 'basics/skeletons/BalanceBadgesSkeleton';`
`import { ActivityFeedSkeleton, ActivityDateDividerSkeleton, FriendsPageSkeleton, GroupsCardsSkeleton } from 'components/skeletons';`
`import { ActivityEventSkeleton } from 'components/skeletons/activity-event-skeleton';`
(all named exports).

## Purpose

Loading placeholders that copy the layout of a real screen part, built from Radix `Skeleton`
around real components and placeholder text.

## When to use

- A list or data screen part while its first data loads.
- `BalanceBadges` and `DebtAmount` have built-in loading (`isLoading`); use that instead of a
  separate skeleton.
- Whole route loading with no known layout: [ChipInLoader / PageLoader](chipin-loader.md).
- A new screen gets its own skeleton here, built the same way (real components inside
  `Skeleton`), not grey boxes.

## Props

Sources: [`BalanceBadgesSkeleton`](../../../apps/app/src/basics/skeletons/BalanceBadgesSkeleton.tsx),
[`ActivityFeedSkeleton`](../../../apps/app/src/components/skeletons/ActivityFeedSkeleton.tsx),
[`ActivityDateDividerSkeleton`](../../../apps/app/src/components/skeletons/activity-date-divider-skeleton/ActivityDateDividerSkeleton.tsx),
[`ActivityEventSkeleton`](../../../apps/app/src/components/skeletons/activity-event-skeleton/ActivityEventSkeleton.tsx),
[`FriendsPageSkeleton`](../../../apps/app/src/components/skeletons/FriendsPageSkeleton.tsx),
[`GroupsCardsSkeleton`](../../../apps/app/src/components/skeletons/GroupsCardsSkeleton.tsx).

| Component                     | Prop            | Type      | Default  | Description                              |
| ----------------------------- | --------------- | --------- | -------- | ---------------------------------------- |
| `BalanceBadgesSkeleton`       | —               | —         | —        | Three soft size-3 badges                 |
| `ActivityFeedSkeleton`        | `isShowSummary` | `boolean` | `false`  | Show the summary in the date divider     |
| `ActivityDateDividerSkeleton` | `isShowSummary` | `boolean` | required | Show the summary text on the right       |
| `ActivityEventSkeleton`       | —               | —         | —        | One activity event card                  |
| `FriendsPageSkeleton`         | —               | —         | —        | Three friend currency cards (a fragment) |
| `GroupsCardsSkeleton`         | `label`         | `string`  | required | Section title text (already translated)  |

`ActivityFeedSkeleton` is one date divider plus eight `ActivityEventSkeleton` cards.
`GroupsCardsSkeleton` is the section header (title, search and add icon buttons), three filter
buttons and three group cards.

## States

- Loading: these are the loading states.
- Default, empty, error, disabled: n/a.

Screen-level rules: patterns/states.md (ChipIn-one/chipin-frontend#490).

## Accessibility and i18n

- Radix `Skeleton` hides its content from assistive tech while loading; the placeholder text is
  never read.
- Placeholder text is translated so the shape matches the real content length. Namespace
  `skeletons`: `balanceBadges.amount`; `activityFeed.dateDivider`, `dateDividerSummary`,
  `expenseTitle`, `expenseDescription`, `scope`, `expenseAmount`, `owedStatus`, `relativeTime`;
  `friendsPage.currency`, `total`, `name`, `amount`; `groupsCards.groupName`, `members`,
  `groupBalance`.
- `GroupsCardsSkeleton` also uses `dashboard`: `groups.filterAll`, `summary.owedToYou`,
  `summary.youOwe`.
- Data attributes for tests: `data-activity-date-divider-skeleton`,
  `data-activity-date-divider-summary-skeleton`, `data-activity-event-skeleton`.

## Example

```tsx
import { GroupsCardsSkeleton } from 'components/skeletons';

// t from useTranslation('dashboard')
if (isLoading) {
    return <GroupsCardsSkeleton label={t('groups.title')} />;
}
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
