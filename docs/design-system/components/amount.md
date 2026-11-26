# Amount

`import { Amount } from 'basics';` (named export; built in `basics/numbers` by
`constructNumberComponent` around `basics/numbers/amount/Amount.tsx`).

## Purpose

Formats one money amount (precision, abbreviations, "too small" marker, currency code); all money
output goes through it.

## When to use

- Any money value on screen, including inside badges, cards and sentences.
- Not for a debt with direction: use [DebtAmount](debt-amount.md) (color by direction) or
  [OwedStatusText](owed-status-text.md) (words and color). Not for input: use
  [AmountInput](amount-input.md).
- Not for plain counts (members, items): those are not money.

## Props

Source: [`basics/numbers/NumberConstructor.tsx`](../../../apps/app/src/basics/numbers/NumberConstructor.tsx)
(wrapper) and [`basics/numbers/amount/Amount.tsx`](../../../apps/app/src/basics/numbers/amount/Amount.tsx).
The wrapper drops the inner `symbol` prop, so the currency is shown only through `tokenCode`.

| Prop                   | Type                                                             | Default     | Description                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `value`                | `NumericValue` (`number \| string \| null`)                      | —           | Parsed with `tryToNumber`; unparsable or `null` renders `—`                                                                      |
| `isWithoutDash`        | `boolean`                                                        | `false`     | Render nothing instead of `—` when `value` is not a number                                                                       |
| `currencyName`         | `string`                                                         | —           | Declared on the wrapper but not used                                                                                             |
| `tokenCode`            | `string \| ReactNode`                                            | —           | Currency code rendered after the number; a ReactNode only as a styled `<span>`                                                   |
| `precision`            | `Precisions` (`0..7`)                                            | —           | Fraction digits                                                                                                                  |
| `type`                 | `'default' \| 'integer' \| 'interactive' \| 'summary' \| 'full'` | `'default'` | `summary`/`full` abbreviate large values (K/M/B); `integer` shows an error text for a non-integer value                          |
| `isAbsolute`           | `boolean`                                                        | `true`      | Show `Math.abs(value)`; the sign is dropped by default                                                                           |
| `customPrefix`         | `string`                                                         | —           | Text before the number (for example `+`); ignored when `customPrefixTooSmall` is set or the value is below the precision minimum |
| `customPrefixTooSmall` | `string`                                                         | —           | Text before the number when the value is not below the precision minimum (below it the prefix is always `< `)                    |
| `className`            | `string`                                                         | —           | Class on the root `<span>`                                                                                                       |
| `onClick`              | `(params: { amountString: string; bigAmount: number }) => void`  | —           | Click handler on the root `<span>`; the caller owns the interaction                                                              |

## States

- Default: mandatory. Renders an inline, non-wrapping `<span>`.
- Empty: `value` not a number renders `—`, or nothing with `isWithoutDash`.
- Error: `type="integer"` with a non-integer value renders the `common:amount.notInteger` text.
- Loading: n/a. Amount has no loading state; wrap it in Radix `Skeleton` or use
  [DebtAmount](debt-amount.md) `isLoading`.
- Disabled: n/a (display only).

## Accessibility and i18n

- The root is a plain `<span>`; with `onClick` it is a clickable span (lint suppressed in source).
  Put it inside a real `Button` when it must be interactive.
- `customPrefix` (for example `+`) sits in `<span dir="ltr">` so it stays left of the number in
  any locale. The currency symbol slot there is always empty (the wrapper drops `symbol`); a
  minus sign (`isAbsolute={false}`) is part of the number text.
- i18n: namespace `common`, key `amount.notInteger`. Number formatting is in `helpers/numbers`.

Money rules:

- Always pass `tokenCode`: the currency code stays next to the number.
- `isAbsolute` hides the sign, so direction is never shown by sign: say it in words and color
  ([OwedStatusText](owed-status-text.md), [BalanceSummaryText](balance-summary-text.md)).
- Amount has no size, weight or color: the wrapping Radix `Text` sets them, so the screen decides
  which amount is the key one (level 3 in [patterns/hierarchy.md](../patterns/hierarchy.md)).

Screen rules: patterns/money.md (ChipIn-one/chipin-frontend#490).

## Example

```tsx
import { Text } from '@radix-ui/themes';

import { Amount } from 'basics';

<Text size="7" weight="bold">
    <Amount value={total} tokenCode={currency} precision={2} />
</Text>;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
