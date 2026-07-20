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
- Reserve `Api*Request` and `Api*Response` names for wire contracts. Pages, features, components,
  and basics import domain/core names such as `Group` and `GroupUser`, never `Api*` names.
- Export reusable semantic domain types from the core types module. Do not expose indexed-access
  expressions such as `Group['members'][number]['user']` in component props or UI imports.

## Naming

- Components and types: `PascalCase`; functions and variables: `camelCase`; shared constants: `UPPER_SNAKE_CASE`.
- Booleans use `is*`, `has*`, `can*`, or `should*` when practical.
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

## Modules And Control Flow

- Prefer named exports. Default exports are limited to established framework boundaries or existing local patterns.
- Every directory boundary consumed by its parent or an external consumer exposes that boundary through
  `index.ts`; consumers do not deep-import its files. Files within the same directory may import siblings
  directly to avoid barrel cycles. Follow the recursive structure in `10-architecture.md` for new and
  substantially refactored directories; do not create empty structure or migrate unrelated legacy folders.
- Prefer early returns and explicit branches over deeply nested logic.
- Do not create an abstraction until it removes real duplication or establishes a necessary boundary.
- Keep functions focused. Split by responsibility, not by an arbitrary line limit.
- Comments explain why a non-obvious decision exists and remain in English.

## Touched-Code Rule

When the requested change depends on nearby legacy behavior, leave the touched flow internally consistent with this rulebook. Stop and request approval if cleanup would change public behavior, backend contracts, architecture, or many unrelated files.
