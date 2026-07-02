# User Currency Summary Design

## Context

Dashboard summary cards currently receive totals that are calculated with the currency rates base currency, then render those totals with the user's default currency code. This can show a correct currency label with an amount that was not converted to that currency.

The same summary card component is also used by group summary UI, so dashboard and group totals should follow one rule.

## Goals

- Show dashboard total balance, owed-to-you total, and you-owe total in the user's selected default currency.
- Show group owed-to-you and you-owe totals in the user's selected default currency.
- Keep balance badges in their original currencies, but sort them by their value converted into the user's selected default currency.
- Reuse existing `currencyRates` data and existing summary/helper patterns.

## Non-Goals

- Do not change backend API contracts.
- Do not change how individual badge amounts are displayed.
- Do not redesign summary cards.
- Do not introduce new dependencies or frontend money models.

## Architecture

Use the existing helper/store path for currency calculations instead of moving money logic into UI components.

`getCurrencySummary` already converts each balance through `currencyRates` into the requested target currency. Dashboard and group summary calculations should pass the user's default currency as that target currency rather than the rates response base currency.

UI components should continue to receive ready-to-render totals and currency codes from stores/selectors. Components can pass `currencyRates` and `defaultCurrency` to badge item preparation only where needed for sorting display-only badge data.

## Data Flow

1. Dashboard fetches dashboard balances and currency rates.
2. Dashboard summary totals are calculated from dashboard balances, currency rates, and the user's default currency.
3. Group summary totals are calculated from selected group balances, currency rates, and the user's default currency.
4. If the user changes default currency after data is loaded, dashboard and group summary totals should update from existing balances and rates without requiring a new dashboard or group API fetch.
5. Badge items are ordered by absolute converted value in the user's default currency, while each badge still renders the original balance amount and original currency.

## Sorting

Badge sorting should be descending by converted absolute value. Entries whose rate is unavailable should not break rendering; they should sort after entries with known converted values, preserving their relative order.

## Error Handling

Existing summary behavior skips currencies with missing rates for aggregate totals. Keep that behavior. Missing rates should not throw or block the page.

## Testing

Run `npm run typecheck` after implementation. Run `npm run verify` if the touched changes reasonably affect app behavior and the existing script completes in the local environment.
