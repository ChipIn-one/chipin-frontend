# Dropdown

`import { Dropdown } from 'basics/Dropdown';` (named export; types `DropdownMenuItem` and
`DropdownMenuSection` are exported too).

## Purpose

A Radix dropdown menu built from items or sections, with icons, hints, disabled items and an
optional selected value.

## When to use

- A menu of secondary actions behind one trigger (a "more" button), or a small value menu.
- A form value: [Select](select.md). Destructive actions still confirm with `BaseAlertDialog`
  after the menu item.

## Props

Source: [`basics/Dropdown.tsx`](../../../apps/app/src/basics/Dropdown.tsx).

| Prop            | Type                                 | Default  | Description                                                                            |
| --------------- | ------------------------------------ | -------- | -------------------------------------------------------------------------------------- |
| `trigger`       | `ReactNode`                          | required | Child of `DropdownMenu.Trigger`; must be a focusable control (a `Button`/`IconButton`) |
| `items`         | `DropdownMenuItem[]`                 | —        | Flat item list (used when `sections` is not given)                                     |
| `sections`      | `DropdownMenuSection[]`              | —        | Groups with separators and labels                                                      |
| `value`         | `string`                             | —        | Controlled selected item                                                               |
| `defaultValue`  | `string`                             | —        | Initial selected item (internal state)                                                 |
| `onValueChange` | `(value: string) => void`            | —        | Called with the selected item value                                                    |
| `side`          | Radix `DropdownMenu.Content` `side`  | —        | Menu side                                                                              |
| `align`         | Radix `DropdownMenu.Content` `align` | —        | Menu alignment                                                                         |

`DropdownMenuItem`: `value: string`, `label: ReactNode`, `icon?: ReactNode`,
`onSelect?: () => void`, `isDisabled?: boolean`, `color?` (Radix item color), `hint?: ReactNode`
(gray caption under the label).

`DropdownMenuSection`: `label?: ReactNode`, `items`, `value?: string`,
`onValueChange?: (value: string) => void`. A section with `value` or `onValueChange` renders a
`RadioGroup`.

Selection: when `value`, `defaultValue` or `onValueChange` is set, the active item is colored
`PROP_COLOR.accent` (grass: selection is the accent, #1007); otherwise items use their own `color`.

## States

- Default: mandatory.
- Disabled: per item with `isDisabled`; explain why in `hint` (for example "offline").
- Empty: no items renders an empty menu; do not render the trigger then.
- Loading, error: n/a.

## Accessibility and i18n

- Roles and keyboard come from Radix `DropdownMenu`. An icon-only trigger needs `aria-label`.
- i18n: none; pass translated `label`, `hint` and section labels.

## Example

```tsx
import { PROP_COLOR } from '@chipin/tokens/theme';
import { IconButton } from '@radix-ui/themes';
import { MoreVerticalIcon } from 'lucide-react';

import { Dropdown } from 'basics/Dropdown';

<Dropdown
    trigger={
        <IconButton variant="ghost" aria-label={moreLabel}>
            <MoreVerticalIcon size={16} />
        </IconButton>
    }
    items={[
        { value: 'edit', label: editLabel, onSelect: onEdit },
        { value: 'leave', label: leaveLabel, color: PROP_COLOR.danger, onSelect: onLeave },
    ]}
/>;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
