# GroupAvatar

`import GroupAvatar from 'components/GroupAvatar';` (default export).

## Purpose

A group's cover image in a Radix `Avatar`, with a `UsersIcon` fallback.

## When to use

- A group in cards, headers and pickers (`GroupCard`, group page).
- A user: use [UserAvatar](user-avatar.md). Members of a group: use [UsersRow](users-row.md).

## Props

Source: [`components/GroupAvatar.tsx`](../../../apps/app/src/components/GroupAvatar.tsx).

| Prop      | Type                                | Default             | Description                   |
| --------- | ----------------------------------- | ------------------- | ----------------------------- |
| `group`   | `Pick<Group, 'coverUrl' \| 'name'>` | required            | Cover URL and name of a group |
| `variant` | Radix `Avatar` `variant`            | `'soft'`            | Fallback style                |
| `size`    | Radix `Avatar` `size`               | `'4'`               | Avatar size                   |
| `color`   | Radix `Avatar` `color`              | `PROP_COLOR.accent` | Fallback color                |

`Group` is the type from `entities/groups` (type-only import; no store access).

## States

- Default: mandatory; cover image.
- Empty: no `coverUrl` shows the `UsersIcon` fallback.
- Error: a broken cover falls back to the icon (Radix `Avatar`).
- Loading: n/a; skeleton screens use a skeleton `Avatar` (see [skeletons.md](skeletons.md)).
- Disabled: n/a.

## Accessibility and i18n

- `alt={group.name}` on the image.
- i18n: none; the name is user content.

## Example

```tsx
import GroupAvatar from 'components/GroupAvatar';

<GroupAvatar group={group} size="3" />;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
