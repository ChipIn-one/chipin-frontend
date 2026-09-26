# Group Debt Simplification Implementation Plan

> **For inline execution:** Use \`superpowers:executing-plans\` to implement this plan task-by-task. Subagent execution is explicitly forbidden by the task authorization.

**Goal:** Integrate the backend-backed group \`simplifyDebts\` setting, preserve canonical per-currency balances, and guarantee canonical group refreshes after group financial mutations.

**Architecture:** Keep the existing \`UI -> groupsStore -> groupsApi -> shared Axios\` boundary. Move only the group update endpoint into \`groupsApi\`, make \`groupsStore.updateGroup\` the single-flight canonical mutation, and keep \`refreshFinancialData\` as the sole financial refresh orchestrator. The settings component reads the confirmed group value and never computes debt data.

**Tech Stack:** Vite 7, React 19, strict TypeScript, Zustand 5, Axios, Radix Themes, styled-components, i18next, Vitest, React Testing Library, user-event, Sonner.

**Spec:** \`docs/superpowers/specs/2026-09-03-group-debt-simplification-design.md\`

## Global Constraints

- Work only in \`ChipIn-one/chipin-frontend\` on \`luna/fe-simplify-debts-api-integration\`, based on \`origin/dev\` at \`f7ef830e6b45af8f13e1fddd4b0cdd42feae860b\`.
- Keep \`ChipIn-one/chipin-backend\` read-only; do not use subagents or ChatGPT Work execution.
- Do not add dependencies, invent a suggestions endpoint, calculate simplification locally, patch financial state optimistically, merge, enable auto-merge, force-push, reset, clean, stash, or discard user work.
- New or touched async code uses Promise \`.then()\`, \`.catch()\`, and \`.finally()\` chains; do not add \`async\`/\`await\`.
- Backend responses remain authoritative; preserve raw per-currency balances and empty results exactly as returned.
- User-facing text, accessibility names, error messages, and toast content use i18n.
- Version impact is \`minor\`: \`0.11.0\` to \`0.12.0\`.

## File Map

- API contract: \`src/api/groupsApi.ts\`, \`src/api/groupsApi.test.ts\`, \`src/api/chipin.ts\`, \`src/api/chipin.params.ts\`, \`src/api/chipin.test.ts\`.
- Group mutation state: \`src/store/groupsStore.ts\`, \`src/store/groupsStore.test.ts\`.
- Settings capability: \`src/pages/group-page/components/GroupSettingsTab.tsx\`, new \`src/pages/group-page/components/GroupSettingsTab.test.tsx\`, and the five \`src/i18n/locales/*/group.json\` files.
- Financial refresh: \`src/store/activity-store/actions.ts\`, \`src/store/activity-store/actions.test.ts\`.
- Canonical balance regression: \`src/pages/group-page/components/GroupBalancesTab.test.tsx\`, changing production code only if the test demonstrates a missing existing behavior.
- Landing comparison: \`src/features/landing/showcase-sections/components/group-page-preview/GroupPagePreview.tsx\`; leave untouched unless it actually represents the settings capability.
- Integration metadata: \`package.json\`, \`package-lock.json\`, and task branch/PR state after runtime changes are verified.

### Task 1: Move and harden the group update API

**Files:**
- Modify: \`src/api/chipin.params.ts\`
- Modify: \`src/api/groupsApi.ts\`
- Test: \`src/api/groupsApi.test.ts\`
- Modify: \`src/api/chipin.ts\`
- Modify: \`src/api/chipin.test.ts\`

**Interfaces:**
- \`UpdateGroupParams\` produces \`{ groupId: string; groupName?: string; groupDescription?: string; simplifyDebts?: boolean }\`.
- \`groupsApi.updateGroup(params: UpdateGroupParams): Promise<Group>\` returns the canonical group or rejects.
- The legacy \`updateApiGroup\` export is removed; unrelated \`chipin.ts\` endpoints remain unchanged.

- [ ] **Step 1: Add the API RED tests.** Extend the \`groupsApi\` mock with \`patch\`, import \`updateGroup\`, and add tests asserting that \`{ groupName: 'Updated', groupDescription: '', simplifyDebts: false }\` produces \`PATCH /groups/group-1\` with \`{ name: 'Updated', description: '', simplifyDebts: false }\`, that the exact response object is returned, and that a response with \`simplifyDebts: undefined\` rejects with an unsupported-contract error. Keep the test response as a real \`Group\` fixture with empty and multi-currency \`balancesByCurrency\` cases.

\`\`\`ts
test('sends false simplifyDebts and returns the canonical response', () => {
    vi.mocked(apiInstance.patch).mockResolvedValue({ data: group });

    return updateGroup({
        groupId: group.id,
        groupName: 'Updated',
        groupDescription: '',
        simplifyDebts: false,
    }).then(result => {
        expect(apiInstance.patch).toHaveBeenCalledWith('/groups/group-1', {
            name: 'Updated',
            description: '',
            simplifyDebts: false,
        });
        expect(result).toBe(group);
    });
});

test('rejects a response without a boolean simplifyDebts contract', () => {
    vi.mocked(apiInstance.patch).mockResolvedValue({
        data: { ...group, simplifyDebts: undefined },
    });

    return expect(updateGroup({ groupId: group.id })).rejects.toThrow(
        'Unsupported group simplifyDebts response',
    );
});
\`\`\`

- [ ] **Step 2: Run only the new API tests and confirm the expected RED failure.**

Run: \`npm run test:task -- src/api/groupsApi.test.ts\`

Expected: FAIL because \`updateGroup\` is not exported from \`groupsApi\` and \`apiInstance.patch\` is not yet wired there. Confirm the unsupported-response assertion is failing for the missing implementation, not because of a test setup error.

- [ ] **Step 3: Write the minimal API implementation.** Make all three update fields independently optional in \`UpdateGroupParams\`. In \`groupsApi.ts\`, create a payload with explicit \`!== undefined\` checks so empty strings and \`false\` survive. Call \`apiInstance.patch<Group>(\`/groups/\${groupId}\`, payload)\`, inspect \`response.data.simplifyDebts\` with a small local type guard, throw \`new Error('Unsupported group simplifyDebts response')\` when it is not boolean, and otherwise return the canonical group. Remove only the old update import, parameter destructuring, function, and export from \`chipin.ts\`; remove its direct update test and leave other legacy tests intact.

- [ ] **Step 4: Run the API tests and typecheck the boundary.**

Run: \`npm run test:task -- src/api/groupsApi.test.ts src/api/chipin.test.ts\`

Expected: PASS, with no \`updateApiGroup\` reference remaining in \`src/api\` and the API module still rejecting Axios/backend failures.

- [ ] **Step 5: Review the API diff.** Check that no store/UI import entered \`groupsApi.ts\`, no unrelated endpoint moved, \`false\` is not filtered by truthiness, and the response guard does not transform or emulate backend balances.

### Task 2: Make \`groupsStore.updateGroup\` canonical and single-flight

**Files:**
- Modify: \`src/store/groupsStore.ts\`
- Test: \`src/store/groupsStore.test.ts\`

**Interfaces:**
- \`GroupsStore.updateGroup(params: { groupName?: string; groupDescription?: string; simplifyDebts?: boolean }): Promise<Group>\` is the only group update action consumed by metadata forms and settings.
- A store-local active update Promise and its group identity enforce one request without changing the existing request-channel model.

- [ ] **Step 1: Add focused RED tests before changing the store.** Mock \`groupsApi.updateGroup\` and cover: a successful simplified response updates the matching cache and selected group; empty and multi-currency member balances remain exactly from the response; no selected group rejects without entering \`group.update: loading\`; a rejected API call preserves the confirmed group and records \`errors.group.update\`; two calls while the first is pending return the same Promise and call the API once; and a response resolving after selecting another group updates the cache but does not replace the newer selection.

\`\`\`ts
test('reuses one pending update request and preserves false in the input', () => {
    let resolveUpdate: ((value: Group) => void) | undefined;
    const request = new Promise<Group>(resolve => {
        resolveUpdate = resolve;
    });
    vi.mocked(groupsApi.updateGroup).mockReturnValue(request);
    useGroupsStore.getState().setSelectedGroup(group);

    const first = useGroupsStore.getState().updateGroup({ simplifyDebts: false });
    const duplicate = useGroupsStore.getState().updateGroup({ simplifyDebts: true });

    expect(duplicate).toBe(first);
    expect(groupsApi.updateGroup).toHaveBeenCalledOnce();
    expect(groupsApi.updateGroup).toHaveBeenCalledWith({
        groupId: group.id,
        simplifyDebts: false,
    });

    resolveUpdate?.({ ...group, simplifyDebts: false });
    return first;
});
\`\`\`

- [ ] **Step 2: Run the store tests and confirm RED.**

Run: \`npm run test:task -- src/store/groupsStore.test.ts\`

Expected: FAIL because the store still calls the legacy API, requires \`groupName\`, updates the selected group unconditionally, and has no active Promise reuse.

- [ ] **Step 3: Write the minimal store implementation.** Import \`groupsApi.updateGroup\` as the resource call. Validate \`get().selectedGroup\` before clearing/setting \`group.update\` loading; when absent, normalize/store the error and reject immediately. Keep a module-local active mutation record containing the selected group id, auth/session guard, and Promise. If a matching update is pending, return the same Promise. For the first call, clear \`group.update\`, set loading, call \`groupsApi.updateGroup({ groupId, ...defined input fields })\`, and in the success branch use functional \`set\` to replace only the matching cached group. Replace \`selectedGroup\` only when its current id equals the request group id. On failure normalize/store and re-reject. In \`finally\`, settle loading only for the active request and clear the active record only if it still points to that Promise. Increment/reset the local mutation record through the existing \`setInitialGroupsStore\` generation protection without introducing a global registry.

- [ ] **Step 4: Run store tests GREEN and check canonical invariants.**

Run: \`npm run test:task -- src/store/groupsStore.test.ts\`

Expected: PASS, including no duplicate PATCH, no optimistic data mutation, confirmed response preservation on failure, stale selection protection, and existing reset/auth-session tests.

- [ ] **Step 5: Review the store diff.** Verify precondition validation precedes loading, all async paths use Promise chains, \`group.update\` is the only lifecycle, late results cannot restore a different selection, and the existing group-detail request channel remains unchanged.

### Task 3: Implement the owner-only settings Switch and localized states

**Files:**
- Modify: \`src/pages/group-page/components/GroupSettingsTab.tsx\`
- Create: \`src/pages/group-page/components/GroupSettingsTab.test.tsx\`
- Modify: \`src/i18n/locales/en/group.json\`
- Modify: \`src/i18n/locales/ru/group.json\`
- Modify: \`src/i18n/locales/es/group.json\`
- Modify: \`src/i18n/locales/pt-BR/group.json\`
- Modify: \`src/i18n/locales/pt-PT/group.json\`

**Interfaces:**
- The component receives the existing \`Group\` prop and selects \`updateGroup\` plus \`group.update\` loading through existing stores/selectors.
- The Switch is named with \`group:page.settings.simplifyDebtsTitle\`, controlled by a runtime-validated boolean, and calls only \`{ simplifyDebts: nextValue }\`.

- [ ] **Step 1: Add the component RED tests.** Create a focused RTL test with lightweight mocks for \`useGroupInvite\`, modal components, \`useUsersStore\`, \`useGroupsStore\`, \`sonner\`, and translation keys. Test by role/name that an owner can toggle and the action receives only \`{ simplifyDebts: false }\`; a member sees a disabled read-only Switch; pending \`group.update\` disables it and exposes localized loading text/indicator; missing/non-boolean runtime data disables it and renders the unsupported explanation; and a rejected update yields exactly one \`toast.error\` using \`resolveApiErrorMessageFromError\` while the controlled checked state remains the prior confirmed value.

\`\`\`tsx
test('lets the owner toggle simplify debts through the store action', () => {
    const user = userEvent.setup();
    const updateGroup = vi.fn().mockResolvedValue({ ...group, simplifyDebts: false });
    useGroupsStore.setState({ updateGroup });
    useUsersStore.setState({ user: owner });

    render(<GroupSettingsTab group={group} />);

    return user.click(screen.getByRole('switch', { name: 'Simplify group debts' })).then(() => {
        expect(updateGroup).toHaveBeenCalledWith({ simplifyDebts: false });
    });
});
\`\`\`

- [ ] **Step 2: Run the component test and confirm RED.**

Run: \`npm run test:task -- src/pages/group-page/components/GroupSettingsTab.test.tsx\`

Expected: FAIL because the existing Switch is always disabled, uncontrolled, unnamed, and not connected to a store action.

- [ ] **Step 3: Add the five locale keys.** Preserve existing \`group.json\` ordering/style and add localized keys next to the current simplify title/subtitle: \`simplifyDebtsOwnerOnly\`, \`simplifyDebtsUnsupported\`, and \`simplifyDebtsUpdating\`. Use natural translations for English, Russian, Spanish, Brazilian Portuguese, and European Portuguese; do not add a new locale or a non-i18n fallback in JSX.

- [ ] **Step 4: Write the minimal UI implementation.** Add the existing \`useShallow\` store connection if the component needs multiple subscriptions. Derive \`isGroupOwner\` from \`group.role === 'OWNER'\`, \`isGroupUpdatePending\` from \`selectGroupUpdating\`, and \`hasSupportedSimplifyDebts\` with \`typeof group.simplifyDebts === 'boolean'\` against an \`unknown\` runtime boundary if the prop fixture must model malformed data. Render the controlled Switch with \`checked={group.simplifyDebts}\` only when supported, \`disabled={!isGroupOwner || !hasSupportedSimplifyDebts || isGroupUpdatePending}\`, \`aria-label={t(...)}\`, and a compact Radix loading indicator with localized text while pending. Render owner-only/member and unsupported explanations using localized \`Text\`. On change, call \`updateGroup({ simplifyDebts: nextValue })\`; catch once and call \`toast.error(resolveApiErrorMessageFromError(error, t('toasts:group.updateError')))\` without altering local confirmed state. Do not add local optimistic state or debt calculations.

- [ ] **Step 5: Run the settings tests GREEN plus directly related page tests.**

Run: \`npm run test:task -- src/pages/group-page/components/GroupSettingsTab.test.tsx src/pages/group-page/GroupPage.test.tsx src/pages/group-page/components/GroupTabsContent.test.tsx\`

Expected: PASS with accessible role/name queries and one toast on a rejected mutation.

- [ ] **Step 6: Compare the landing preview.** Read \`GroupPagePreview.tsx\` and its test after the settings change. Since the current preview exposes landing tabs but no settings-panel capability, leave it unchanged unless the comparison demonstrates that it is intended to model this setting; record the decision in the final report.

### Task 4: Prove canonical balances and financial refresh guarantees

**Files:**
- Modify: \`src/pages/group-page/components/GroupBalancesTab.test.tsx\`
- Modify: \`src/store/activity-store/actions.ts\`
- Test: \`src/store/activity-store/actions.test.ts\`

**Interfaces:**
- \`GroupBalancesTab\` continues to render \`member.balancesByCurrency\` through \`BalanceSummaryText\` without local simplification.
- \`refreshFinancialData(activityState, context)\` remains the single explicit refresh path and resolves successfully even if any post-mutation refresh rejects.

- [ ] **Step 1: Add RED regressions for canonical balance shapes.** Extend the existing balances tests with a backend response containing separate USD/EUR balances and another response whose \`balancesByCurrency\` is empty. Assert the rendered currency values remain separate and the existing settled/empty state is preserved; do not assert private Radix markup.

- [ ] **Step 2: Add RED refresh-failure tests.** In \`actions.test.ts\`, add group expense creation, expense update, settlement creation, and reversal cases that configure \`fetchSetGroupById(groupId, true)\` and the other refresh fakes. Add rejection to each refresh fake and assert the mutation Promise still resolves after the ledger API succeeds. Keep mutation rejection tests asserting no refresh call. Add/retain explicit assertions that group expense creation and update pass the affected group id.

\`\`\`ts
test('does not reject a confirmed group expense when group refresh fails', () => {
    vi.mocked(ledgerApi.createExpense).mockResolvedValue({} as never);
    useDashboardStore.setState({
        fetchSetDashboard: vi.fn().mockRejectedValue(new Error('stale')),
    });
    useActivityStore.setState({
        fetchSetActivity: vi.fn().mockResolvedValue(undefined),
    });
    useGroupsStore.setState({
        fetchSetGroupById: vi.fn().mockRejectedValue(new Error('group unavailable')),
    });

    return useActivityStore.getState().createExpense({
        groupId: 'group-1',
        description: 'Dinner',
        amount: 20,
        date: 1,
        payerId: 'user-1',
        participantIds: ['user-2'],
        currency: 'USD',
    }).then(result => {
        expect(result).toBeUndefined();
    });
});
\`\`\`

- [ ] **Step 3: Run the balance/refresh tests and confirm RED.**

Run: \`npm run test:task -- src/pages/group-page/components/GroupBalancesTab.test.tsx src/store/activity-store/actions.test.ts\`

Expected: balance tests fail only if current assertions expose a missing canonical rendering case; refresh-failure tests fail because create expense, settlement, and reversal currently propagate refresh rejection.

- [ ] **Step 4: Write the minimal refresh implementation.** Keep the existing \`requests\` array and explicit group-detail request. Make the success stage of create expense, create settlement, and reverse ledger entry contain \`refreshFinancialData(get(), context).catch(() => undefined)\`, matching the already protected expense-update path. Do not add another refresh system, local balance patches, retries, or a second error/toast. Change \`GroupBalancesTab.tsx\` only if the new public behavior tests prove the current renderer does not preserve backend currencies/empty state.

- [ ] **Step 5: Run refresh and related tests GREEN.**

Run: \`npm run test:task -- src/store/activity-store/actions.test.ts src/pages/group-page/components/GroupBalancesTab.test.tsx src/store/groupsSelectors.test.ts\`

Expected: PASS for all four mutation refreshes, no refresh after mutation failure, non-fatal refresh failure, empty settled state, and separate currencies.

- [ ] **Step 6: Review the cross-layer diff.** Confirm no local debt simplification algorithm, no activity/store refresh duplication, and no mutation response is replaced by a calculated balance.

### Task 5: Full local validation and task-owned diff review

**Files:**
- All task-owned runtime files from Tasks 1–4.

- [ ] **Step 1: Run the required focused suite.**

Run:

\`\`\`bash
npm run test:task -- \\
  src/api/groupsApi.test.ts \\
  src/store/groupsStore.test.ts \\
  src/store/activity-store/actions.test.ts \\
  src/pages/group-page/components/GroupSettingsTab.test.tsx \\
  src/pages/group-page/components/GroupBalancesTab.test.tsx
\`\`\`

Expected: exit 0 with all focused tests passing.

- [ ] **Step 2: Run the fast verification gate.**

Run: \`npm run verify\`

Expected: ESLint quiet mode and TypeScript build both exit 0.

- [ ] **Step 3: Re-review the complete task-owned diff in five batches.** Use \`git diff origin/dev...HEAD -- <paths>\` and \`git diff --check\`. Review API payload/guard, store lifecycle/concurrency/reset/stale selection, UI permissions/loading/error/unsupported/i18n/accessibility, financial refresh, and cross-layer currency/raw-data invariants. Use \`rg\` to prove \`updateApiGroup\` is absent from runtime code and no \`async\`/\`await\` was introduced in touched async code. Fix only confirmed task-local issues and rerun affected focused tests.

- [ ] **Step 4: Check version bump prerequisites.** Confirm \`git status --short\` contains only task-owned changes and the existing design/plan artifacts. Do not stage unrelated files.

### Task 6: Version, commit, push, PR, and remote gate

**Files:**
- Modify through script: \`package.json\`, \`package-lock.json\`.
- Stage only task-owned runtime, test, locale, version, and required design/plan artifact files.

- [ ] **Step 1: Apply and validate the minor version.**

Run:

\`\`\`bash
npm run version:bump -- minor
npm run version:check
npm run verify:full
\`\`\`

Expected: package and lockfile become \`0.12.0\`; version check, lint, full Vitest suite, and production build all exit 0.

- [ ] **Step 2: Perform the final staged diff review.** Stage only the files listed in the file map, inspect \`git diff --cached --check\`, \`git diff --cached --stat\`, and the complete cached diff. Confirm no backend path, unrelated branch file, generated artifact, or dependency change is staged.

- [ ] **Step 3: Commit the implementation with the prescribed message.**

Run:

\`\`\`bash
git commit -m "feat: integrate group debt simplification"
\`\`\`

Expected: a signed commit is created on \`luna/fe-simplify-debts-api-integration\`; do not amend the design commit.

- [ ] **Step 4: Push only the task branch.**

Run: \`git push origin luna/fe-simplify-debts-api-integration\`

Expected: the task branch is published; no protected branch is pushed.

- [ ] **Step 5: Create or update the PR with the explicit base.**

Run: \`npm run pr:create\`

Expected: output contains a real GitHub \`/pull/<number>\` URL and the PR base is \`dev\`.

- [ ] **Step 6: Verify remote readiness without merging.** Inspect the PR checks and wait for required \`frontend-ci\`; treat Vercel as informational only. Report the real PR URL, base, \`frontend-ci\` status, preview status when available, and either \`READY FOR HUMAN MERGE\` or \`BLOCKED\` with exact evidence. Never merge or enable auto-merge.
