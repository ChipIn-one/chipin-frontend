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

The "+N" avatar is always `size="1"` and `color={PROP_COLOR.neutral}`, whatever `size` is. Overlap uses
`mr="-1"` and a reversed flex order (`--_stack-order` in `UsersRow.module.css`), so DOM order and
visual order both match `members`.

## States

- Default: mandatory.
- Empty: `members` empty renders an empty `Flex`; the parent hides the row or shows a member
  empty state ([NoGroupMembersEmptyState](empty-state.md)).
- Loading, error, disabled: n/a.

## Accessibility and i18n

- Each member avatar has `alt={user.displayName}`; the fallback is the first initial. Known gap
  (follow-up, outside #946): the name is only the `<img>` `alt`, so a member without a picture
  (or whose picture has not loaded) is read as the initial, not the name. The fix is to name the
  avatar root, as `UserAvatar` does.
- The "+N" avatar is a `role="img"` named by the plural `common:members.overflowLabel` ("2 more
  members", ru "Ещё 2 участника"); its visible text is `common:members.overflow` ("+2").
- i18n: `common:members.overflow` and `common:members.overflowLabel` (plural: en `_one/_other`,
  ru `_one/_few/_many/_other`).

## Example

```tsx
import { UsersRow } from 'components/UsersRow';

<UsersRow members={members} max={4} size="2" />;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
