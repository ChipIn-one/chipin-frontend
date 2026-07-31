# Foundation Rules

Apply these rules to new and touched code. Refactor directly related legacy code when safe; do not start broad cleanup without approval.

## TypeScript

- Keep strict types at boundaries and let TypeScript infer obvious local values.
- Exported functions, public helpers, and store actions have explicit return types.
- Use `unknown` for untrusted values and narrow with type guards.
- Do not add `any`, `as any`, unjustified assertions, `@ts-ignore`, or non-null assertions that hide missing validation.
- Prefer `satisfies` when validating an object without widening its inferred type.
- Use `import type` for type-only dependencies.
- Model mutually exclusive states with discriminated unions instead of several loosely related booleans.
- Repeated closed string sets used across files live in a shared `as const` object; derive the union type
  from that object and use its named values instead of repeating raw string literals.
- Reserve `Api*Request` and `Api*Response` names for wire contracts. Pages, features, components,
  and basics import domain/core names such as `Group` and `GroupUser`, never `Api*` names.
- Export reusable semantic domain types from the core types module. Do not expose indexed-access
  expressions such as `Group['members'][number]['user']` in component props or UI imports.

## Naming

- Components and types: `PascalCase`; functions and variables: `camelCase`; shared constants: `UPPER_SNAKE_CASE`.
- Directories use `kebab-case`. A capability directory derives its name from its primary component, for
  example `AddExpenseModal.tsx` lives in `add-expense-modal/`.
- React component files remain `PascalCase.tsx` inside their `kebab-case` owner directories.
- Booleans use `is*`, `has*`, `can*`, or `should*` when practical.
- Do not declare a boolean that only negates another boolean, such as
  `const isGroupMode = !isSoloMode`. Use the negation directly at the call site.
- Local event handlers and callback props both use `on*`. Do not add `handle*`.
- Names describe business intent: `setSelectedGroup`, not `setData`; `removeFriend`, not `processItem`.
- Use descriptive iterator names outside trivial expressions.

```tsx
interface Props {
    onSubmit: (input: CreateGroupInput) => Promise<Group>;
}

const onFormSubmit = (input: CreateGroupInput) => {
    return onSubmit(input);
};
```

## Promises

- New and touched async code uses `.then()`, `.catch()`, and `.finally()`; do not add `async`/`await`.
- Return `Promise<T>` from every asynchronous action. A caller must be able to await, chain, or reject it.
- Keep chains flat by returning nested Promises.
- Do not swallow errors. Normalize or record the error, then reject unless the operation explicitly recovers.
- Use `.finally()` only for cleanup shared by success and failure.
- Use `Promise.all` for independent work and sequential chaining for dependent work.
- Do not wrap an existing Promise with `new Promise`.
- Do not mix `await` and `.then()` within one flow.

```ts
export const fetchGroup = (groupId: string): Promise<Group> => {
    return groupsApi.fetchGroup(groupId).then(mapGroupResponse);
};
```

## Collection Traversal And Allocation

- A traversal is any operation that can inspect collection elements, including `for`, `for...of`,
  `for...in`, `map`, `filter`, `find`, `some`, `every`, `reduce`, `sort`, and
  `Object.keys`/`Object.values`/`Object.entries`. Early termination does not stop an operation from counting
  as a traversal.
- A dynamic collection gets at most one primary traversal within one computation. If the computation needs
  several arrays, counters, flags, lookup tables, or selected items, collect all of them during that pass.
- Prefer `for...of` for arrays. Mutating a local accumulator or locally owned result collections during the
  pass is allowed; mutating the input collection is not.
- `reduce` is an exception for a simple aggregation when it is materially clearer than `for...of`. Do not
  use `reduce` merely to produce several outputs, and never copy an accumulator with object or array spread
  on every iteration.
- A separate `sort` of a derived array is allowed after the primary traversal. Independently derived arrays
  may then be traversed separately when their own processing is required.
- Multiple traversals are allowed for small static collections such as a fixed list of UI options. Any other
  repeated traversal is strongly discouraged and must be justified by a hard size bound or measured need.
- Do not repeatedly call `Object.keys`, `Object.values`, or `Object.entries` for the same dynamic record.
  When a record only needs to be visited once, use `for...in` with `Object.hasOwn`. Use an `Object.*` result
  only when the resulting array is itself required later, compute it once, and reuse it.
- Avoid nested repeated scans such as `items.map(item => otherItems.find(...))`. Build and reuse a `Map` or
  `Set` when repeated membership or keyed lookup is required.

```ts
const owed: BalanceEntry[] = [];
const owing: BalanceEntry[] = [];
let selected: BalanceEntry | undefined;

for (const balance of balances) {
    if (balance.netBalance > 0) {
        owed.push(balance);
    } else if (balance.netBalance < 0) {
        owing.push(balance);
    }

    if (balance.currency === selectedCurrency) {
        selected = balance;
    }
}
```

```ts
for (const currency in balancesByCurrency) {
    if (!Object.hasOwn(balancesByCurrency, currency)) {
        continue;
    }

    const balance = balancesByCurrency[currency];
    // Process the record value without allocating an intermediate array.
}
```

## Modules And Control Flow

- Prefer named exports. Default exports are limited to established framework boundaries or existing local patterns.
- Every `index.ts` imports its public values and types first, then ends with exactly one explicit named
  `export { ... }` block. Do not use inline re-exports such as `export { Component } from './component'`,
  wildcard exports, multiple export statements, or a default export from an index file.
- Every directory boundary consumed by its parent or an external consumer exposes that boundary through
  `index.ts`; consumers do not deep-import its files. Files within the same directory may import siblings
  directly to avoid barrel cycles. Follow the recursive structure in `10-architecture.md` for new and
  substantially refactored directories; do not create empty structure or migrate unrelated legacy folders.
- Prefer early returns and explicit branches over deeply nested logic.
- Do not use nested ternary expressions. When one condition selects several related values or
  callbacks, move that decision into a focused local helper with explicit branches or a `switch`.
- Do not create an abstraction until it removes real duplication or establishes a necessary boundary.
- Keep functions focused. Split by responsibility, not by an arbitrary line limit.
- Comments explain why a non-obvious decision exists and remain in English.
- When the user confirms a code concern but explicitly defers its implementation, add a nearby English
  `TODO` that states the unresolved risk and the expected follow-up.

```ts
import AddExpenseModal from './AddExpenseModal';
import type { AddExpenseModalProps } from './types';

export { AddExpenseModal, type AddExpenseModalProps };
```

## Touched-Code Rule

When the requested change depends on nearby legacy behavior, leave the touched flow internally consistent with this rulebook. Stop and request approval if cleanup would change public behavior, backend contracts, architecture, or many unrelated files.
