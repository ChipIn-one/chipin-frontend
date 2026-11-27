# SegmentedControl

`import { SegmentedControl } from 'basics/SegmentedControl';` (named export; type
`SegmentedControlItem` is exported too).

## Purpose

A Radix segmented control built from an `items` list, with a responsive default size.

## When to use

- Switching between two to four views or modes of the same content (tabs-like filters, split
  type).
- A choice that is a form value with descriptions: `RadioCards` from `basics`. Many options or a
  long list: [Select](select.md). An actions menu: [Dropdown](dropdown.md).

## Props

Source: [`basics/SegmentedControl.tsx`](../../../apps/app/src/basics/SegmentedControl.tsx). Plus
Radix `SegmentedControl.Root` props (`value`, `defaultValue`, `onValueChange`, `radius`, …).

| Prop    | Type                                    | Default                     | Description              |
| ------- | --------------------------------------- | --------------------------- | ------------------------ |
| `items` | `{ value: string; label: ReactNode }[]` | required                    | Segments, keyed by value |
| `size`  | Radix `SegmentedControl.Root` `size`    | `{ initial: '2', sm: '3' }` | Control size             |
| `fill`  | `boolean`                               | `false`                     | Fill the container width |

Use `fill` when the control must fit a narrow container or column: it takes the full width, keeps
equal-width cells (the Radix indicator needs them), uses compact label padding and drops to the
size-1 font below a 280px wide control, and clips over-long labels with an ellipsis
(ChipIn-one/chipin-frontend#969). The parent must give it a definite width (a block container):
inline-size containment gives it zero intrinsic width in a shrink-to-fit parent.

## States

- Default: mandatory; one segment selected (controlled `value` or `defaultValue`).
- Disabled: n/a; the component has no disabled prop for items.
- Loading, empty, error: n/a; do not render it with no items.

## Accessibility and i18n

- Roles and keyboard come from Radix `SegmentedControl`. Pass `aria-label` through the Root props
  when no visible label names the control.
- Labels are `ReactNode`; icon-only labels need their own accessible text.
- i18n: none; pass translated `label`s.
- A `fill` label that is not plain text (an icon + text in a flex) gives its text its own ellipsis
  element: the basics guard on the label spans clips only inline text (ChipIn-one/chipin-frontend#316).

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
