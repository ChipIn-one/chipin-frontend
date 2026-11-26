# UsersRow

`import { UsersRow } from 'components/UsersRow';` (named export; the file also exports
`AvatarWrapper`).

## Purpose

Overlapping member avatars, up to `max`, with a "+N" avatar for the rest.

## When to use

- A compact member preview: today the group page header, next to the invite button
  (`pages/group-page/components/GroupTabsContent.tsx`), and the landing group page preview.
- One user: use [UserAvatar](user-avatar.md). A full member list with names: a list of
  `UserAvatar` rows.

## Props

Source: [`components/UsersRow.tsx`](../../../apps/app/src/components/UsersRow.tsx).

| Prop      | Type                  | Default  | Description                            |
| --------- | --------------------- | -------- | -------------------------------------- |
| `members` | `GroupUser[]`         | required | Members (`api/chipin.types`), in order |
| `max`     | `number`              | `5`      | Avatars shown before the "+N" avatar   |
| `size`    | Radix `Avatar` `size` | `'1'`    | Size of member avatars                 |

The "+N" avatar is always `size="1"` and `color="cyan"`, whatever `size` is. Overlap uses
`mr="-1"` and a reversed flex order (`--_stack-order` in `UsersRow.module.css`), so DOM order and
visual order both match `members`.

## States

- Default: mandatory.
- Empty: `members` empty renders an empty `Flex`; the parent hides the row or shows a member
  empty state ([NoGroupMembersEmptyState](empty-state.md)).
- Loading, error, disabled: n/a.

## Accessibility and i18n

- Each member avatar has `alt={user.displayName}`; the fallback is the first initial.
- The "+N" text is a literal (`react/jsx-no-literals` disabled in source), not translated, and
  has no label naming hidden members.
- i18n: none.

## Example

```tsx
import { UsersRow } from 'components/UsersRow';

<UsersRow members={members} max={4} size="2" />;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
