# SegmentedControl

`import { SegmentedControl } from 'basics/SegmentedControl';` (named export; type
`SegmentedControlItem` is exported too).

## Purpose

A Radix segmented control built from an `items` list, with the responsive size fixed.

## When to use

- Switching between two to four views or modes of the same content (tabs-like filters, split
  type).
- A choice that is a form value with descriptions: `RadioCards` from `basics`. Many options or a
  long list: [Select](select.md). An actions menu: [Dropdown](dropdown.md).

## Props

Source: [`basics/SegmentedControl.tsx`](../../../apps/app/src/basics/SegmentedControl.tsx). Plus
Radix `SegmentedControl.Root` props (`value`, `defaultValue`, `onValueChange`, `radius`, …).

| Prop    | Type                                    | Default  | Description              |
| ------- | --------------------------------------- | -------- | ------------------------ |
| `items` | `{ value: string; label: ReactNode }[]` | required | Segments, keyed by value |

`size` is always `{ initial: '2', sm: '3' }`: it is set after the spread, so a `size` prop is
ignored.

## States

- Default: mandatory; one segment selected (controlled `value` or `defaultValue`).
- Disabled: n/a; the component has no disabled prop for items.
- Loading, empty, error: n/a; do not render it with no items.

## Accessibility and i18n

- Roles and keyboard come from Radix `SegmentedControl`. Pass `aria-label` through the Root props
  when no visible label names the control.
- Labels are `ReactNode`; icon-only labels need their own accessible text.
- i18n: none; pass translated `label`s.

## Example

```tsx
import { SegmentedControl } from 'basics/SegmentedControl';

<SegmentedControl
    aria-label={filterLabel}
    value={view}
    onValueChange={setView}
    items={[
        { value: 'all', label: allLabel },
        { value: 'settled', label: settledLabel },
    ]}
/>;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
