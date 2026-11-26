# BalanceSummaryText

`import { BalanceSummaryText } from 'basics';` (named export).

## Purpose

"You are owed … / You owe … / Settled up" lines for balances in several currencies.

## When to use

- A per-currency balance summary in words (friend or group headers, cards).
- One signed value: use [OwedStatusText](owed-status-text.md).
- A badge list under a heading: use [BalanceBadges](balance-badges.md).

## Props

Source: [`basics/BalanceSummaryText.tsx`](../../../apps/app/src/basics/BalanceSummaryText.tsx).

| Prop       | Type                                                                                   | Default  | Description                                                             |
| ---------- | -------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `balances` | `{ owed: readonly { currency: string; netBalance: number }[]; owe: readonly { … }[] }` | required | Balances split by sign (`legacyPartitionEntries`); zero entries dropped |
| `size`     | Radix `Text` `size`                                                                    | required | Text size of every line                                                 |
| `align`    | Radix `Text` `align`                                                                   | `'left'` | Text alignment                                                          |

Amounts: `Amount type="summary" precision={2}` of the absolute `netBalance`, comma-separated; each
amount chunk does not wrap.

## States

- Default: mandatory; an owed line (green, medium) and/or an owe line (red, medium), in a column.
- Empty: both lists empty renders gray `Settled up`; mandatory (never an empty space).
- Loading: n/a; show a skeleton in the parent while data loads.
- Error, disabled: n/a.

## Accessibility and i18n

- Plain Radix `Text as="span"` lines; words are visible.
- i18n: namespace `common`, keys `balances.youAreOwed`, `balances.youOwe`, `balances.settledUp`.

Money rules: direction is in words and color together. Colors are Radix `color` literals
`green`/`red`/`gray` today, equal to `PROP_COLOR.debtOwed`/`debtOwing`/`debtSettled`. Each
currency code stays next to its number. Screen rules: patterns/money.md (ChipIn-one/chipin-frontend#490).

## Example

```tsx
import { BalanceSummaryText } from 'basics';

<BalanceSummaryText balances={{ owed, owe }} size="2" />;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
