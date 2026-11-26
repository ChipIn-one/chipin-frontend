# Money: amounts, debt direction and amount input

Applies [principles.md](../principles.md) 2, 3 and 7 to every place that shows or takes money.
Paths are inside `apps/app/src`.

## Output goes through `Amount`

- Every amount on screen is rendered by `Amount` (`basics/numbers`) or by a basic built on it:
  `DebtAmount` (`basics/DebtAmount`), `OwedStatusText`, `BalanceBadges`, `BalanceSummaryText`
  (`basics`). Feature and page code never formats money itself.
- The currency is always next to the number: pass `tokenCode` to `Amount` (`currency` to
  `DebtAmount`, `currencyCode` to `OwedStatusText`). A balance without its currency is a bug.
- Approximate amounts after a currency conversion carry the `~` prefix through `customPrefix`, as
  in [`GroupCard`](../../../apps/app/src/components/group-card/GroupCard.tsx). Tiny amounts render
  as `< 0.01 USD` inside `Amount`; do not round them away yourself.

## Debt colors

The three debt roles exist once, in [`tokens.css`](../../../packages/tokens/tokens.css) and in
`PROP_COLOR` ([tokens.md](../tokens.md#radix-color-props-prop_color)):

| Direction    | CSS (CSS Modules)        | Radix `color` prop       |
| ------------ | ------------------------ | ------------------------ |
| You are owed | `var(--cp-debt-owed)`    | `PROP_COLOR.debtOwed`    |
| You owe      | `var(--cp-debt-owing)`   | `PROP_COLOR.debtOwing`   |
| Settled      | `var(--cp-debt-settled)` | `PROP_COLOR.debtSettled` |

- New and touched money code takes its color only from this table. No `color="green"`,
  `"red"`, `"grass"`, `"tomato"` or `"gray"` literal on a money element, and no per-screen
  shade.
- The direction comes from `getBalanceDirection` (`helpers/currencies`), not from a local
  `> 0` check.

Today (origin/master) the money components still pass Radix literals and no lint checks this yet:
`DebtAmount`, `OwedStatusText` and `GroupCard` use `green`/`red`/`gray`;
`DashboardSummary`, `OwedToYouCard` and `YouOweCard` use `grass`/`tomato`. They move to
`PROP_COLOR` when a design-system task touches them.

## Direction in words and color together

- A debt is never told by sign or color alone. The words "You are owed", "You owe" or
  "Settled up" (`common:balances.*`) stand next to the amount.
- Reference: [`OwedStatusText`](../../../apps/app/src/basics/OwedStatusText.tsx) shows the words
  and the absolute amount in one colored line.
- Where the words are already visible nearby (a column titled "You owe", a card header),
  the amount may carry them for screen readers only, through `VisuallyHidden`. `DebtAmount` and
  `GroupCard` do this. A bare signed number with only a color is not allowed.
- Show the absolute value next to the words (`Math.abs`, or `Amount`'s default `isAbsolute`);
  `+` is used only for "owed" (`DebtAmount withPlus`). Never show a minus sign to mean "you owe".

## One large amount per screen

- A screen has at most one key amount: size `7`, weight `bold` (the total balance in
  `DashboardSummary` and `TotalBalanceCard`). It is level 3 of the
  [visibility scale](hierarchy.md#visibility-scale).
- Other amounts on the same screen use size `2`-`4` (list rows `2`-`3`, summary cards `4`).
- Sizes are Radix `size` props from the token scale, never a `font-size` in CSS.

## Input goes through `AmountInput`

- Every money field is `AmountInput` (`basics`): it sets `inputMode="decimal"`, parses through
  `parseAmountInput` (`helpers/numbers`) and limits fraction digits (`maxFractionDigits`, default
  `2`, `null` for none). Do not use a raw `TextField` or `type="number"` for money. If its
  contract does not fit, extend `AmountInput`; do not fork it in a feature.
- The label sits above the field (see [forms.md](forms.md)); the currency code is visible next
  to the field (a `TextField.Slot` or the `CurrencySelect` beside it).
- Split rows keep a fixed control width (`120px` today) so the values line up down the list.

Today the expense amount and the settle-up amount use `AmountInput`; the split rows
(`features/add-expense/.../expense-input-actions`, which also take shares and percents) still use
a raw `TextField.Root`. They move to `AmountInput` when a task touches them.

## Forbidden

- Formatting money outside `Amount`: `toFixed`, `Intl.NumberFormat`, `toLocaleString` or a string
  template in feature or page code.
- A balance or amount without its currency code.
- A debt direction told only by color, or only by sign.
- Changing the color of an amount per screen, or any debt color outside the table above.
- Two size-`7` amounts on one screen.
- A money field that is not `AmountInput`.
