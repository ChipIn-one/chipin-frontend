# Money, Offline, And Helper Rules

## Money Model

- Domain money is `Money { minor: bigint; currency }` in ledger units of scale 4 (`85.5` → `855000n`),
  the same scale the backend uses (D21, spec 03 §4). On the wire money stays a JSON number of scale 4.
- Conversion between wire and domain happens only at the API boundary: `moneyFromWire`/`moneyToWire` in
  the `entities/*/model` mappers. Arithmetic runs on `bigint` ledger units; currency minor units are used
  only for display and input limits.
- Parsing, rounding, sums, and formatting live only in `src/shared/money/`.
- New code uses `src/shared/money/`. Legacy code that has not migrated yet keeps its current amounts and the
  shared helpers in `helpers/numbers.ts` (`parseAmountInput`, `roundHalfUp`, `normalizeApiMoneyAmount`); do
  not add new money parsing, rounding, or arithmetic anywhere else.
- Keep the public `Amount` component as the shared display boundary; backend-confirmed values remain the financial source of truth.
- Backend is the source of confirmed financial results after synchronization.
- Frontend may validate input, preview splits, convert display summaries, and maintain local pending offline results.
- Currency conversion is presentation-derived state: calculate converted summaries only from confirmed
  backend balances and confirmed backend rates in pure selectors/helpers.
- Do not persist converted summaries as canonical domain state, synchronize them across stores, or use them
  to infer balances, debts, mutation results, or mutation payloads.

## Offline Financial Mutations

Today there are no offline financial writes: `shared/offline/outboxGate.ts` and `shared/offline/pendingOps.ts`
are no-op stubs that callers may already be wired against, and a task does not build the outbox unless it asks
for one (`AGENTS.md` "Applies now"). The rules below describe the target (spec 03 §2) and apply once the
outbox lands.

- Offline expense create/edit/delete goes only through the outbox with a client-generated UUID
  (spec 03 §2). Settle-up and payments are never offline.
- Track local lifecycle explicitly, for example `pending`, `syncing`, `synced`, or `failed`.
- On reconnect, the outbox replays queued work in order and reconciles local values with the backend response.
- Failed synchronization remains retryable and is not silently marked successful.
- Replay must not duplicate an expense; the client UUID is the idempotency key.
- A stale backend fetch must not overwrite unsynchronized local changes.

## Amount Input And Validation

- Keep an editable amount as a string and convert it at validation/submit boundaries.
- User input is parsed only by `parseMoneyInput`, wire values only by `moneyFromWire` (spec 03 §4.2);
  legacy forms use the shared `parseAmountInput` until they migrate. Do not duplicate parsing regexes.
- Distinguish an empty string from zero.
- Do not use truthiness to validate numeric values.

## Calculation And Rounding

- Do not round intermediate calculations.
- Rounding is `roundToMinor` (half-up away from zero to the currency minor units), only for display, and
  only inside `src/shared/money/`.
- Do not make a financial decision from a visually rounded value.
- Missing exchange rates return `null`, never a silent zero or fabricated rate.
- Currency conversion helpers receive rates/base/source/target explicitly and do not read stores.

## UI Output

- Render money with `basics/numbers/Amount` or a specialized basic such as `DebtAmount`, `BalanceBadges`, or `BalanceSummaryText` that delegates to it.
- Feature/page code does not use direct `Intl.NumberFormat`, `toFixed`, or `` `${amount} ${currency}` `` output.
- Use `AmountInput` for monetary entry when its public contract fits.
- Central formatting changes belong in the money basic, not its consumers.

## Dates And Time

- Store serializable numbers/strings, not `Date` instances.

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
- Persisted values are validated on read with a zod schema (a runtime guard until zod is added by spec 03);
  `JSON.parse(raw) as T` is not validation.
- Remove invalid/stale values and return a safe fallback.
- Wrap storage access because reads/writes may throw.
- Do not call `localStorage.clear()`; remove only known project keys.
- Do not store large remote collections or add new secrets/payment data without an explicit security design.
- Version and migrate persisted structured data when its schema changes.
