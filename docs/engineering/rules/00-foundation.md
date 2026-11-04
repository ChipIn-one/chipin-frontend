# Foundation Rules

Legacy and touched-code policy lives in `70-testing.md` §Legacy Baseline.

## TypeScript

- Use `unknown` for untrusted values and narrow with type guards.
- Do not add `any`, `as any`, unjustified assertions, `@ts-ignore`, or non-null assertions that hide missing validation.
- Mark type-only imports with `type` (`import type { X }`, or `import { type X, y }` when mixed); tsc
  `verbatimModuleSyntax` requires it and `npx eslint --fix` adds it (`consistent-type-imports`).
- UI (pages, features, components, basics) imports domain types such as `Group` and `GroupUser`, never
  wire `Api*Request`/`Api*Response` types.

## Promises

- Do not swallow errors. Normalize or record the error, then reject unless the operation explicitly recovers.
- Read actions record expected request errors in `errorsStore` and resolve after handling them, so callers do not
  need fire-and-forget wrappers. Mutations reject when the caller must react; do not add no-op catches or `void`
  wrappers around requests.
- Do not wrap an existing Promise with `new Promise`.

```ts
export const fetchGroup = (groupId: string): Promise<Group> => {
    return groupsApi.fetchGroup(groupId).then(mapGroupResponse);
};
```

## Collections

- Traverse a dynamic collection once per computation; collect every derived array, counter, or lookup in that pass.
- Do not copy a `reduce` accumulator with object or array spread on every iteration.
- Use a `Map` or `Set` for repeated keyed lookup instead of nested scans such as `items.map(item => others.find(...))`.

## Modules

- Prefer named exports. Default exports are limited to established framework boundaries or existing local patterns.
- Every `index.ts` imports its public values and types first, then ends with exactly one explicit named
  `export { ... }` block. Do not use inline re-exports such as `export { Component } from './component'`,
  wildcard exports, multiple export statements, or a default export from an index file.
- Which directories have an `index.ts` and how imports cross a slice boundary: `10-architecture.md`
  §Index Files And Import Boundaries.

```ts
import { AddExpenseModal, type AddExpenseModalProps } from './AddExpenseModal';

export { AddExpenseModal, type AddExpenseModalProps };
```
