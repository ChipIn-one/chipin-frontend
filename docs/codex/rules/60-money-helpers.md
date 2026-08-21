# Money, Offline, And Helper Rules

## Money Model

- Frontend money values and API payloads use JavaScript `Number`.
- Do not introduce cents/integer-money domain models or new BigNumber usage.
- Existing `bignumber.js` code under number basics/helpers is legacy. Use its public `Amount` component, but do not import BigNumber into new domain code.
- Backend is the source of confirmed financial results after synchronization.
- Frontend may validate input, preview splits, convert display summaries, and maintain local pending offline results.
- Currency conversion is presentation-derived state: calculate converted summaries only from confirmed
  backend balances and confirmed backend rates in pure selectors/helpers.
- Do not persist converted summaries as canonical domain state, synchronize them across stores, or use them
  to infer balances, debts, mutation results, or mutation payloads.

## Offline Financial Mutations

- Without network, a mutation may update the local store/table and UI immediately.
- Track local lifecycle explicitly, for example `pending`, `syncing`, `synced`, or `failed`.
- On reconnect, submit queued work and reconcile local values with the backend response.
- Failed synchronization remains retryable and is not silently marked successful.
- Repeated synchronization must not duplicate an expense or settlement; use an idempotency identifier when the backend contract supports it.
- A stale backend fetch must not overwrite unsynchronized local changes.
- Conflict/reconciliation policy is designed explicitly for the feature; do not invent a generic outbox during unrelated work.

## Amount Input And Validation

- Keep an editable amount as a string and convert it at validation/submit boundaries.
- Distinguish an empty string from numeric zero.
- Validate with `Number.isFinite`, sign, and backend constraints.
- Decimal normalization uses the shared amount parser/input, not duplicated regexes.
- Do not use truthiness to validate numeric values.

## Calculation And Rounding

- Do not round every intermediate calculation.
- Round only for display or an explicit backend contract.
- `toFixed()` returns a display/form string; do not convert it back into a number for continued domain calculation.
- Centralize any comparison tolerance in a named constant/helper.
- Do not make a financial decision from a visually rounded value.
- Missing exchange rates return `null`, never a silent zero or fabricated rate.
- Currency conversion helpers receive rates/base/source/target explicitly and do not read stores.

## UI Output

- Render money with `basics/numbers/Amount` or a specialized basic such as `DebtAmount`, `BalanceBadges`, or `BalanceSummaryText` that delegates to it.
- Feature/page code does not use direct `Intl.NumberFormat`, `toFixed`, or `` `${amount} ${currency}` `` output.
- Use `AmountInput` for monetary entry when its public contract fits.
- Central formatting changes belong in the money basic, not its consumers.

## Dates And Time

- Make timestamp units explicit in type/function names; helpers do not guess seconds versus milliseconds.
- Store serializable numbers/strings, not `Date` instances.
- User-facing date/time formatting uses `Intl.DateTimeFormat` with explicit locale and, when meaningful, time zone.
- Manual date assembly is limited to technical formats such as a native date input.
- Relative-time logic accepts a `now` value when deterministic tests need it.
- Keep boolean semantics correct: `hour12` is the inverse of `is24Hour`.

## Helpers And Constants

- Pure helpers do not read stores, show toast, mutate arguments, access DOM, or make API calls.
- Pass locale, rates, time, and other dependencies explicitly.
- Browser boundary helpers such as storage, clipboard, and service worker modules may have side effects, which must be clear from their module/function names.
- Use `null` for an expected absent result and throw/reject for an unexpected state that cannot safely continue.
- Shared domain constants live in `src/constants`; one-module constants stay local.
- Name business-significant magic values and use existing time constants.

## localStorage

- Direct `localStorage` access outside `helpers/localStorage.ts` is prohibited.
- Every key belongs to the typed `StorageSchema` and project key constants.
- `JSON.parse(raw) as T` is not validation; persisted objects need a runtime guard.
- Remove invalid/stale values and return a safe fallback.
- Wrap storage access because reads/writes may throw.
- Do not call `localStorage.clear()`; remove only known project keys.
- Do not store large remote collections or add new secrets/payment data without an explicit security design.
- Version and migrate persisted structured data when its schema changes.
