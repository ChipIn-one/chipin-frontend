# Group Debt Simplification Design

## Goal

Implement the existing backend `simplifyDebts` group setting in the ChipIn frontend so an owner can toggle it, the frontend renders the canonical per-currency balances returned by the backend, and all group financial mutations refresh that canonical group detail.

## Scope and constraints

- Work only in `ChipIn-one/chipin-frontend` on `luna/fe-simplify-debts-api-integration`.
- Keep `ChipIn-one/chipin-backend` read-only.
- Do not add dependencies, invent a suggestions endpoint, calculate debt simplification locally, patch financial state optimistically, merge, enable auto-merge, or push protected branches.
- Preserve the existing Promise `.then()`, `.catch()`, and `.finally()` style in touched async code.
- Apply the requested minor version impact: `0.11.0` to `0.12.0`.

## Existing boundaries

The resource API boundary is `UI -> groupsStore -> groupsApi -> shared Axios instance`. The group update endpoint currently remains in the legacy `chipin.ts`; only that endpoint will move to `groupsApi.ts`. `Group` already contains `simplifyDebts: boolean` and member `balancesByCurrency` data.

`groupsStore.updateGroup` already owns metadata mutation lifecycle and canonical group replacement. It will become the single store action for metadata and the setting. Its request state will use the existing `group.update` loading/error fields, with a store-local active mutation Promise to enforce single-flight behavior. The existing request-channel model remains responsible for group-detail GET races; no global request registry will be introduced.

`activity-store/actions.ts` already owns `refreshFinancialData`. Successful group expense creation, expense update, settlement creation, and ledger reversal will continue to call that one orchestration path, which explicitly refetches dashboard, activity, and affected group detail. Refresh failures remain non-fatal after the backend mutation is confirmed.

## API contract

`groupsApi.updateGroup` will accept an input shaped as follows:

```ts
{
    groupId: string;
    groupName?: string;
    groupDescription?: string;
    simplifyDebts?: boolean;
}
```

The PATCH payload will include each optional field only when it is not `undefined`, preserving `false` and empty strings. The request will use `PATCH /groups/{groupId}` and return `response.data` as the canonical `Group`. A response whose `simplifyDebts` is not boolean will reject with an unsupported/inconsistent-contract error; the frontend will not emulate the missing field.

## Store behavior

Before entering `group.update` loading, `updateGroup` will verify that a selected group exists. With no selected group it will normalize/store the error and reject without starting a request or leaving loading active.

While an update is pending, another `updateGroup` call will return the same active Promise and will not issue another PATCH. The confirmed response will replace the matching cached group. `selectedGroup` will be replaced only when the same group id is still selected when the response resolves. Confirmed state is unchanged on failure, and the normalized error remains available through `errorsStore`. Existing reset/auth-session generation guards will prevent late mutations from restoring cleared state.

## Settings UI

`GroupSettingsTab` will render a controlled Radix `Switch` using `group.simplifyDebts`. The control will be enabled only for `group.role === 'OWNER'`, disabled for members, disabled while `group.update` is loading, and disabled with a localized unsupported explanation when runtime data does not contain a boolean setting. Pending state will expose a compact loading indicator. The change handler will call the selected store action with only `{ simplifyDebts: nextValue }`; no debt calculation or local balance transformation will occur.

Failures will leave the controlled value sourced from the confirmed group and show one localized foreground toast through the existing error helpers. New owner-only, unsupported-state, pending/accessibility, and failure copy will be added to the five existing `group.json` locales. `GroupPagePreview` will be compared and changed only if it represents this capability.

## Financial refresh behavior

After a confirmed group expense create/update, group settlement create, or group ledger reversal, `refreshFinancialData` will start the existing canonical dashboard/activity/group-detail refreshes. Mutation failures will not start refreshes. Refresh failures will be contained so they cannot reject an already-confirmed mutation or create a second foreground error.

## Verification

Tests will be added or extended at the API, groups store, activity store, settings component, and directly affected balances boundaries. They will cover false payload preservation, canonical responses, unsupported responses, single-flight and stale-selection behavior, canonical multi-currency/empty balances, owner/member/pending/unsupported UI states, one-toast failure handling, and all required refresh success/failure cases. The final gates are focused tests, `npm run verify`, version bump/check, `npm run verify:full`, staged diff review, commit, task-branch push, PR targeting `dev`, and required `frontend-ci` status.
