# GroupRoleBadge

`import { GroupRoleBadge } from 'basics';` (default export of `basics/GroupRoleBadge.tsx`,
re-exported by name from `basics`).

## Purpose

An "Owner" badge for the group owner; renders nothing for other members.

## When to use

- Next to a member's name in group member lists.
- Not for other labels: use a Radix `Badge` directly or [LedgerScopeBadge](ledger-scope-badge.md)
  for the group of a ledger entry.

## Props

Source: [`basics/GroupRoleBadge.tsx`](../../../apps/app/src/basics/GroupRoleBadge.tsx).

| Prop      | Type      | Default  | Description                       |
| --------- | --------- | -------- | --------------------------------- |
| `isOwner` | `boolean` | required | Render the badge only when `true` |

Renders a Radix `Badge size="1" color="amber" variant="soft"`.

## States

- Default: mandatory (owner).
- Empty: `isOwner={false}` renders `null`.
- Loading, error, disabled: n/a.

## Accessibility and i18n

- Visible text, no aria attributes.
- i18n: namespace `common`, key `roles.owner`.

## Example

```tsx
import { Flex, Text } from '@radix-ui/themes';

import { GroupRoleBadge } from 'basics';

<Flex align="center" gap="2">
    <Text size="2">{member.displayName}</Text>
    <GroupRoleBadge isOwner={isOwner} />
</Flex>;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
