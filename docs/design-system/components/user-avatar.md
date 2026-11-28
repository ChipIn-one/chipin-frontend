# UserAvatar

`import { UserAvatar } from 'basics';` (named export of `basics/UserAvatar.tsx`, re-exported by
`basics`).

## Purpose

A user's picture, or their first initial, in a Radix `Avatar`, with an optional loading skeleton.

## When to use

- One user anywhere (profile, member row, payer).
- Several members in a compact row: use [UsersRow](users-row.md).
- A group: use [GroupAvatar](group-avatar.md).

## Props

Source: [`basics/UserAvatar.tsx`](../../../apps/app/src/basics/UserAvatar.tsx). Plus Radix
`Avatar` props except `fallback`, `asChild`, `children`, `role`, `aria-label`, `aria-labelledby` and
`aria-hidden` (the component owns them: it builds the fallback and the accessible name).

| Prop         | Type                                                | Default                 | Description                           |
| ------------ | --------------------------------------------------- | ----------------------- | ------------------------------------- |
| `user`       | `{ displayName: string; picture?: string \| null }` | —                       | Source of the picture and the initial |
| `isLoading`  | `boolean`                                           | —                       | Wrap the avatar in Radix `Skeleton`   |
| `decorative` | `boolean`                                           | `false`                 | Hide the avatar from screen readers   |
| `alt`        | `string`                                            | `user?.displayName`     | Accessible name of the avatar         |
| `size`       | Radix `Avatar` `size`                               | `'3'`                   | Avatar size                           |
| `src`        | `string`                                            | `user?.picture \|\| ''` | Image URL                             |
| `variant`    | Radix `Avatar` `variant`                            | `'soft'`                | Fallback style                        |
| `color`      | Radix `Avatar` `color`                              | `PROP_COLOR.accent`     | Fallback color                        |
| `radius`     | Radix `Avatar` `radius`                             | `'full'`                | Shape                                 |

Fallback: `user.displayName.charAt(0)`, or a lucide `UserIcon` when there is no user or name.

## States

- Default: mandatory; picture, else initial.
- Loading: `isLoading` shows a `Skeleton`; use it while the user loads.
- Empty: no `user` shows the `UserIcon` fallback.
- Error: a broken picture falls back to the initial (Radix `Avatar`).
- Disabled: n/a.

## Accessibility and i18n

- The avatar root is one `role="img"` named by `alt`, by default the user's `displayName`, in
  every state: a screen reader hears "Misha", not the initial "M", with the picture or with the
  fallback. The `<img>` inside has an empty `alt`, so the name is not read twice.
- Pass `decorative` when the name is visible next to the avatar (list rows, select items, a
  button with its own label): the root gets `aria-hidden="true"`. Pass `alt` only to replace the
  name with a fuller text (the activity feed's "Performed by …").
- With no `user` and no `alt` there is no name, and the avatar is hidden like a decorative one.
- i18n: none in the component; the name comes from the user, a caller's `alt` is translated by
  the caller.

## Example

```tsx
import { Flex, Text } from '@radix-ui/themes';

import { UserAvatar } from 'basics';

<Flex align="center" gap="2">
    <UserAvatar user={user} size="2" decorative />
    <Text size="2">{user.displayName}</Text>
</Flex>;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
