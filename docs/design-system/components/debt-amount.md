# DebtAmount

`import DebtAmount from 'basics/DebtAmount';` (default export; not in `basics/index.ts`).

## Purpose

An [Amount](amount.md) colored by debt direction (owed, owe, settled), with the direction in
hidden words and an optional loading skeleton.

## When to use

- A signed balance in a list row or card where the visible words are nearby (a column title, a
  card heading).
- Not when the direction must be read on screen: use [OwedStatusText](owed-status-text.md)
  (one value) or [BalanceSummaryText](balance-summary-text.md) (several currencies).
- Not for an amount without direction (an expense total): use [Amount](amount.md).

## Props

Source: [`basics/DebtAmount.tsx`](../../../apps/app/src/basics/DebtAmount.tsx).

| Prop          | Type                                                                    | Default     | Description                                          |
| ------------- | ----------------------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| `amount`      | `number`                                                                | required    | Signed balance; direction from `getBalanceDirection` |
| `currency`    | `string`                                                                | required    | Currency code, passed as `tokenCode`                 |
| `isLoading`   | `boolean`                                                               | `false`     | Show a Radix `Skeleton` with placeholder text        |
| `size`        | Radix `Text` `size`                                                     | `'2'`       | Text size                                            |
| `weight`      | Radix `Text` `weight`                                                   | `'regular'` | Text weight                                          |
| `withPlus`    | `boolean`                                                               | `false`     | Prefix `+` on owed amounts                           |
| `amountProps` | `Amount` props except `customPrefix`, `precision`, `tokenCode`, `value` | —           | Extra props for the inner `Amount`                   |

Fixed: `precision={0}`; the shown value is absolute (Amount `isAbsolute` default).

## States

- Default: mandatory; three directions. `getBalanceDirection` normalizes near-zero values to
  settled.
- Loading: `isLoading` renders the `skeletons:debtAmount.amount` placeholder inside `Skeleton`;
  mandatory while the balance loads.
- Empty: settled shows the amount in gray (no separate empty state).
- Error, disabled: n/a (display only; the screen handles load errors).

## Accessibility and i18n

- A `VisuallyHidden` direction label follows the amount (not rendered while loading):
  `common:balances.youAreOwed`, `common:balances.youOwe`, `common:balances.settledUp`.
- Loading text: `skeletons:debtAmount.amount`.

Money rules:

- Direction in words and color together: the hidden label covers screen readers only, so the
  screen must show the words visibly too (a heading such as "You owe").
- Colors: `PROP_COLOR.debtOwed`/`debtOwing`/`debtSettled` (CSS equivalents `--cp-debt-owed`,
  `--cp-debt-owing`, `--cp-debt-settled`). Do not override the color per screen.
- Currency code is always shown (`currency` is required).

Screen rules: patterns/money.md (ChipIn-one/chipin-frontend#490).

## Example

```tsx
import DebtAmount from 'basics/DebtAmount';

<DebtAmount amount={balance.netBalance} currency={balance.currency} size="3" weight="bold" />;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
