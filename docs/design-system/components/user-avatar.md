# UserAvatar

`import { UserAvatar } from 'basics';` (default export of `basics/UserAvatar.tsx`, re-exported by
name from `basics`).

## Purpose

A user's picture, or their first initial, in a Radix `Avatar`, with an optional loading skeleton.

## When to use

- One user anywhere (profile, member row, payer).
- Several members in a compact row: use [UsersRow](users-row.md).
- A group: use [GroupAvatar](group-avatar.md).

## Props

Source: [`basics/UserAvatar.tsx`](../../../apps/app/src/basics/UserAvatar.tsx). Plus Radix
`Avatar` props except `fallback` (the component builds it).

| Prop        | Type                                                | Default                 | Description                           |
| ----------- | --------------------------------------------------- | ----------------------- | ------------------------------------- |
| `user`      | `{ displayName: string; picture?: string \| null }` | —                       | Source of the picture and the initial |
| `isLoading` | `boolean`                                           | —                       | Wrap the avatar in Radix `Skeleton`   |
| `size`      | Radix `Avatar` `size`                               | `'3'`                   | Avatar size                           |
| `src`       | `string`                                            | `user?.picture \|\| ''` | Image URL                             |
| `variant`   | Radix `Avatar` `variant`                            | `'soft'`                | Fallback style                        |
| `color`     | Radix `Avatar` `color`                              | `'mint'`                | Fallback color                        |
| `radius`    | Radix `Avatar` `radius`                             | `'full'`                | Shape                                 |

Fallback: `user.displayName.charAt(0)`, or a lucide `UserIcon` when there is no user or name.

## States

- Default: mandatory; picture, else initial.
- Loading: `isLoading` shows a `Skeleton`; use it while the user loads.
- Empty: no `user` shows the `UserIcon` fallback.
- Error: a broken picture falls back to the initial (Radix `Avatar`).
- Disabled: n/a.

## Accessibility and i18n

- The component sets no `alt`; pass `alt={user.displayName}` through the Radix props when the
  avatar is the only place the name appears. Next to a visible name it is decorative.
- i18n: none; the initial comes from the user's name.

## Example

```tsx
import { Flex, Text } from '@radix-ui/themes';

import { UserAvatar } from 'basics';

<Flex align="center" gap="2">
    <UserAvatar user={user} size="2" />
    <Text size="2">{user.displayName}</Text>
</Flex>;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
