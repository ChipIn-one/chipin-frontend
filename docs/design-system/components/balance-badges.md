# BalanceBadges

`import { BalanceBadges } from 'basics';` (named export; type `BadgeItem` is exported from
`basics/BalanceBadges`).

## Purpose

Per-currency balance badges with a "+N" / "Hide" toggle and a built-in loading skeleton.

## When to use

- A list of per-currency balances under a heading that states the direction ("You owe",
  "Owed to you"), as in `DashboardSummary`.
- A sentence with direction words: use [BalanceSummaryText](balance-summary-text.md).
- One amount: use [DebtAmount](debt-amount.md) or [OwedStatusText](owed-status-text.md).

## Props

Source: [`basics/BalanceBadges.tsx`](../../../apps/app/src/basics/BalanceBadges.tsx).

| Prop            | Type                  | Default                     | Description                            |
| --------------- | --------------------- | --------------------------- | -------------------------------------- |
| `items`         | `BadgeItem[]`         | required                    | Badges, keyed by `tokenCode`           |
| `isLoading`     | `boolean`             | `false`                     | Render `BalanceBadgesSkeleton` instead |
| `maxVisible`    | `number`              | `3` (`DEFAULT_MAX_VISIBLE`) | Badges shown before the "+N" button    |
| `overflowColor` | Radix `Badge` `color` | `PROP_COLOR.neutral`        | Color of the "+N" / "Hide" button      |

`BadgeItem`: `{ tokenCode: string; value: number; color: Radix Badge color }`. Each badge is a soft
size-3 `Badge` with `Amount type="summary" precision={0}` (absolute value, K/M/B abbreviations).

## States

- Default: mandatory; collapsed, then expanded after "+N".
- Loading: `isLoading` renders `BalanceBadgesSkeleton` (three skeleton badges, see
  [skeletons.md](skeletons.md)); mandatory while balances load.
- Empty: `items` empty renders nothing; the screen shows its own empty or settled state.
- Error, disabled: n/a.

## Accessibility and i18n

- The toggle is a Radix `Button`. "+N" is its only text (no `aria-label`); "Hide" has a
  `ChevronLeftIcon` and the `common:buttons.hide` text.
- Loading text comes from `skeletons:balanceBadges.amount`.

Money rules: badges show absolute values and direction only by color, so the visible heading must
say the direction in words. The caller picks each `color`: use `PROP_COLOR.debtOwed` /
`debtOwing` / `debtSettled`, not a hand-picked palette. The currency code is always shown.
Screen rules: patterns/money.md (ChipIn-one/chipin-frontend#490).

## Example

```tsx
import { Text } from '@radix-ui/themes';
import { PROP_COLOR } from '@chipin/tokens/theme';

import { BalanceBadges } from 'basics';

<>
    <Text size="3" weight="bold">
        {t('summary.youOwe')}
    </Text>
    <BalanceBadges
        items={owe.map(entry => ({
            tokenCode: entry.currency,
            value: entry.netBalance,
            color: PROP_COLOR.debtOwing,
        }))}
        isLoading={isLoading}
    />
</>;
```

No gallery anchor: ds-gallery was removed (D33, ChipIn-one/chipin-frontend#830).
