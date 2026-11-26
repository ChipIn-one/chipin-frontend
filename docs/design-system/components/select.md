# Select

`import { Select } from 'basics/Select';` (named export; type `SelectItem` is exported too).

## Purpose

A Radix select built from an `items` list, with custom value and item renders.

## When to use

- Picking one value from a short, fixed list in a form or a setting.
- A long or searchable list: `SearchSelect` (`components/search-select`); currencies:
  `CurrencySelect`. Two to four always-visible options: [SegmentedControl](segmented-control.md).
  Actions, not a value: [Dropdown](dropdown.md).

## Props

Source: [`basics/Select.tsx`](../../../apps/app/src/basics/Select.tsx). No other Radix props pass
through.

| Prop                    | Type                                                                | Default  | Description                                  |
| ----------------------- | ------------------------------------------------------------------- | -------- | -------------------------------------------- |
| `items`                 | `{ value: string; label: ReactNode; isDisabled?: boolean }[]`       | required | Options                                      |
| `value`                 | `string`                                                            | required | Selected value (controlled)                  |
| `onChange`              | `(value: string) => void`                                           | required | Called by Radix `onValueChange`              |
| `size`                  | Radix `Select.Root` `size`                                          | `'2'`    | Size                                         |
| `placeholder`           | `string`                                                            | —        | Trigger placeholder                          |
| `triggerVariant`        | Radix `Select.Trigger` `variant`                                    | —        | Trigger style                                |
| `triggerColor`          | Radix `Select.Trigger` `color`                                      | —        | Trigger color                                |
| `triggerRadius`         | Radix `Select.Trigger` `radius`                                     | —        | Trigger radius                               |
| `contentVariant`        | Radix `Select.Content` `variant`                                    | —        | Menu style                                   |
| `contentColor`          | Radix `Select.Content` `color`                                      | —        | Menu color                                   |
| `isContentHighContrast` | `boolean`                                                           | —        | Radix `highContrast` on the menu             |
| `renderValue`           | `(item: SelectItem \| undefined) => ReactNode`                      | —        | Trigger content; default is the item `label` |
| `renderItem`            | `(item: SelectItem, context: { isSelected: boolean }) => ReactNode` | —        | Option content; default is the item `label`  |

## States

- Default: mandatory.
- Empty: `value=""` shows `placeholder`; a value matching no item shows an empty trigger (or
  `renderValue(undefined)`).
- Disabled: per item with `isDisabled`; the whole select cannot be disabled (no prop).
- Loading, error: n/a; the form shows errors below the field.

## Accessibility and i18n

- Roles and keyboard come from Radix `Select`. The trigger gets no `aria-label` prop, so its name
  is its content; put a visible label next to it.
- i18n: none; pass translated `label`s and `placeholder`.

## Example

```tsx
import { Select } from 'basics/Select';

<Select
    value={splitType}
    onChange={setSplitType}
    items={[
        { value: 'equal', label: equalLabel },
        { value: 'exact', label: exactLabel },
    ]}
/>;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
