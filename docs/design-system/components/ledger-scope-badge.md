# LedgerScopeBadge

`import { LedgerScopeBadge } from 'basics';` (named export from `basics/badges`).

## Purpose

A gray badge naming the group of a ledger entry, or "Direct" for an entry between friends;
hidden on that group's own page.

## When to use

- In activity and ledger rows that can mix groups and direct entries.
- Not for roles: use [GroupRoleBadge](group-role-badge.md).

## Props

Source: [`basics/badges/LedgerScopeBadge.tsx`](../../../apps/app/src/basics/badges/LedgerScopeBadge.tsx).

| Prop             | Type             | Default  | Description                                 |
| ---------------- | ---------------- | -------- | ------------------------------------------- |
| `groupId`        | `string \| null` | required | Group of the entry; `null` = direct         |
| `groupName`      | `string \| null` | required | Name shown in the badge                     |
| `currentGroupId` | `string`         | —        | Group of the current page; omit off a group |

The badge does not read the route. When `currentGroupId` equals `groupId`, it renders `null`; the
caller passes its route `groupId` (`useParams`), which is `undefined` off group pages. A
`groupId` without a `groupName` also shows "Direct".

## States

- Default: mandatory; group name (truncated) or "Direct".
- Empty: on the entry's own group page renders `null`.
- Loading: n/a; skeletons draw a gray badge placeholder (`skeletons:activityFeed.scope`).
- Error, disabled: n/a.

## Accessibility and i18n

- Visible text; the group name is a truncated `Text as="span"` (full text stays in the DOM).
- i18n: namespace `activity`, key `event.betweenFriends`.

## Example

```tsx
import { useParams } from 'react-router-dom';

import { LedgerScopeBadge } from 'basics';

const { groupId: routeGroupId } = useParams<{ groupId: string }>();

<LedgerScopeBadge groupId={groupId} groupName={groupName} currentGroupId={routeGroupId} />;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
