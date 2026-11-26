# OwedStatusText

`import { OwedStatusText } from 'basics';` (default export of `basics/OwedStatusText.tsx`,
re-exported by name from `basics`).

## Purpose

"You are owed 120 USD" / "You owe 120 USD" for one signed value, in words and color.

## When to use

- One signed amount whose direction the reader must see (activity events, friend rows).
- Several currencies at once: use [BalanceSummaryText](balance-summary-text.md).
- Direction already stated by a nearby heading: [DebtAmount](debt-amount.md) is enough.

## Props

Source: [`basics/OwedStatusText.tsx`](../../../apps/app/src/basics/OwedStatusText.tsx).

| Prop           | Type                 | Default   | Description                    |
| -------------- | -------------------- | --------- | ------------------------------ |
| `value`        | `number`             | required  | Signed amount; `>= 0` is owed  |
| `currencyCode` | `string`             | required  | Currency code after the number |
| `size`         | Radix `Text` `size`  | required  | Text size                      |
| `align`        | Radix `Text` `align` | `'right'` | Text alignment                 |
| `className`    | `string`             | —         | Class on the `Text`            |

The amount is `Math.abs(value)` with `precision={0}`.

## States

- Default: mandatory; owed (green) or owe (red).
- Empty: a falsy `value` (`0`, `NaN`) renders nothing; there is no settled text. Use
  [BalanceSummaryText](balance-summary-text.md) when "Settled up" must be shown.
- Loading, error, disabled: n/a (display only).

## Accessibility and i18n

- A Radix `Text as="span"`; the words are visible text, no aria attributes needed.
- i18n: `useTranslation('activity')`, keys read from `common`: `common:balances.youAreOwed`,
  `common:balances.youOwe`.

Money rules: this is the reference for "direction in words and color together". Colors are Radix
`color` literals `green`/`red` today, equal to `PROP_COLOR.debtOwed`/`debtOwing`. The sign test is
`value >= 0`, not `getBalanceDirection`. Screen rules: patterns/money.md (ChipIn-one/chipin-frontend#490).

## Example

```tsx
import { OwedStatusText } from 'basics';

<OwedStatusText value={balance} currencyCode={currency} size="2" />;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
