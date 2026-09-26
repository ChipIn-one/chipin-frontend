# Activity Subevents History Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Activity subevents page around a shared latest-state view-model and initialize Expense editing exclusively from Activity metadata while preserving existing mutation and feed behavior.

**Architecture:** Add a pure Activity subevents view selector that retains the root event and selects the greatest-seq current event from loaded children. Compose the page with Container size 4 and InternalPageColumnsFromSm; render one shared details model in a desktop contextual card and a mobile disclosure. Keep the history feed and store-owned mutation refreshes intact, but replace canonical ledger reads in prepareExpenseEdit with synchronous metadata mapping.

**Tech Stack:** React 19, TypeScript strict, Vite, React Router 7, Zustand, styled-components 6, @radix-ui/themes 3, lucide-react, sonner, Vitest, and React Testing Library.

**Spec:** docs/superpowers/specs/2026-08-31-activity-subevents-history-redesign-design.md

## Global Constraints

- Work only on the frontend; backend contracts remain unchanged.
- Do not implement breadcrumbs or add a second navigation column.
- Do not use className, inline styles, shadcn, or a new UI library.
- Preserve ActivitySubeventsFeed pagination, loading, retry, empty, and end-of-feed behavior.
- Treat Activity metadata as the current Expense source of truth; do not call GET /ledger/entries/{entryId} during edit preparation.
- Require shares[].displayName; do not add compatibility for missing display names.
- Use the root parent event createdAt for contextual Created at.
- Keep Expense business date behavior for create mode and omit date from edit UI, comparison, and PATCH generation.
- Preserve subcategory in the Activity model and edit original state without clearing it when unchanged.
- Keep Settlement editing out of scope; Settlement may retain reverse/delete behavior only.
- Use then, catch, and finally for touched asynchronous code; do not add async/await.
- User-facing strings, labels, action names, and toasts use i18n in every supported locale.
- Monetary rendering uses Amount; participant rows use metadata display names and concrete shares, without avatar dependencies.
- Helpers remain pure and UI calls store actions rather than API modules.

## File and module map

- src/api/activity.types.ts — final Activity Expense metadata and share contract.
- src/helpers/activityEvent.ts — pure latest-event and subevents view selection.
- src/helpers/activityEvent.test.ts — root-only, child-selected, and unordered sequence coverage.
- src/store/expenseModalEditMapping.ts — Activity snapshot to modal edit-state mapper.
- src/store/activity-store/types.ts and actions.ts — synchronous metadata-based edit preparation.
- src/store/expenseModalStore.ts and expenseModalUpdate.ts — edit date removal and partial update rules.
- src/pages/activity-subevents-page/ — wide page composition, contextual details, and relocated actions.
- src/i18n/locales/*/activity.json — localized contextual details and disclosure labels.
- Existing Activity, store, modal, and page tests — focused behavior regression coverage.

### Task 1: Add the shared current-state selector and final Activity metadata types

**Files:**
- Modify: src/api/activity.types.ts
- Modify: src/helpers/activityEvent.ts
- Test: src/helpers/activityEvent.test.ts
- Modify: all existing typed Activity event fixtures that contain shares

**Interfaces:**
- Export ExpenseActivityShare with required userId, displayName, shareAmount, and currency.
- Export ExpenseActivityMetadata with nullable category, subcategory, date, and sharingMode plus payer and shares.
- Export ActivitySubeventsView with originalEvent and currentEvent.
- Export getActivitySubeventsView(parentEvent: AppEvent | null | undefined, childEvents: readonly AppEvent[]): ActivitySubeventsView | undefined.

- [ ] **Step 1: Write the failing selector tests**

Add parent-only, latest-child, unordered-child, and reversed-child cases to src/helpers/activityEvent.test.ts.

```ts
test('uses the parent as current state when no children are loaded', () => {
    expect(getActivitySubeventsView(parentEvent, [])).toEqual({
        originalEvent: parentEvent,
        currentEvent: parentEvent,
    });
});

test('uses the highest-sequence child regardless of array order', () => {
    const olderChild = createExpenseEvent({ id: 'older', seq: 2 });
    const newestChild = createExpenseEvent({ id: 'newest', seq: 7 });

    expect(getActivitySubeventsView(parentEvent, [newestChild, olderChild])).toEqual({
        originalEvent: parentEvent,
        currentEvent: newestChild,
    });
});
```

Update every existing Activity event fixture so every share contains a real displayName. The production field remains required.

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
npm run test:task -- src/helpers/activityEvent.test.ts
```

Expected: FAIL because the selector is missing and the current required share contract is not implemented.

- [ ] **Step 3: Implement the final types and pure selector**

In src/api/activity.types.ts, export the semantic metadata types and use them in ExpenseCreatedEvent, ExpenseUpdatedEvent, and ExpenseReversedEvent:

```ts
export type ExpenseActivityShare = {
    userId: UUID;
    displayName: string;
    shareAmount: number;
    currency: string;
};

export type ExpenseActivityMetadata = {
    type: 'expense';
    entryId: UUID;
    groupId?: UUID | null;
    groupName?: string | null;
    description?: string | null;
    amount: number;
    currency: string;
    category?: string | null;
    subcategory?: string | null;
    date?: number | null;
    sharingMode?: SharingMode | null;
    payerId?: UUID | null;
    payerDisplayName: string;
    shares?: ExpenseActivityShare[];
    fieldDiffs?: unknown;
};
```

In src/helpers/activityEvent.ts, select without a combined-array allocation and without mutating input:

```ts
export interface ActivitySubeventsView {
    originalEvent: AppEvent;
    currentEvent: AppEvent;
}

export const getActivitySubeventsView = (
    parentEvent: AppEvent | null | undefined,
    childEvents: readonly AppEvent[],
): ActivitySubeventsView | undefined => {
    if (!parentEvent) {
        return undefined;
    }

    let currentEvent = parentEvent;

    for (const childEvent of childEvents) {
        if (childEvent.seq > currentEvent.seq) {
            currentEvent = childEvent;
        }
    }

    return { originalEvent: parentEvent, currentEvent };
};
```

Keep the helper independent of stores and runtime API modules.

- [ ] **Step 4: Run selector tests and typecheck**

Run:

```bash
npm run test:task -- src/helpers/activityEvent.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/activity.types.ts src/helpers/activityEvent.ts src/helpers/activityEvent.test.ts src/store/dashboardStore.test.ts src/store/activity-store/actions.test.ts src/features/activity/components/activity-event/ActivityEvent.test.tsx src/features/activity/components/event-expense/EventExpense.test.tsx src/features/activity/internal/selectors.test.ts src/pages/activity-subevents-page/components/activity-subevents-header/ActivitySubeventsHeader.test.tsx src/pages/activity-subevents-page/components/activity-subevents-header/components/activity-subevents-buttons/ActivitySubeventsButtons.test.tsx
git commit -m "feat: add activity current-state selector"
```

### Task 2: Replace canonical ledger reads with Activity-metadata Expense edit mapping

**Files:**
- Modify: src/store/expenseModalEditMapping.ts and its test
- Modify: src/store/activity-store/types.ts, actions.ts, and actions.test.ts
- Modify: the existing ActivitySubeventsButtons component, connector, and test

**Interfaces:**
- PrepareExpenseEditParams becomes { parentEvent: AppEvent; childEvents: readonly AppEvent[]; parentActivityId?: string }.
- prepareExpenseEdit returns ExpenseModalEditInitialization | null synchronously.
- Export mapActivityExpenseToModalState({ parentEvent, childEvents, source, parentActivityId }): ExpenseModalEditInitialization | null.
- Remove isExpenseLedgerEntry from this flow and remove all fetchLedgerEntry calls from edit preparation.

- [ ] **Step 1: Write failing metadata-mapping and no-GET tests**

Replace the canonical ledger fixture in src/store/expenseModalEditMapping.test.ts with Activity parent/child events. Cover the newest child, a former participant absent from local groups/friends, payer identity, category, subcategory, and sharing mode.

```ts
test('maps the latest Activity Expense snapshot without a canonical ledger entry', () => {
    const result = mapActivityExpenseToModalState({
        parentEvent,
        childEvents: [latestExpenseEvent],
        source,
        parentActivityId: parentEvent.id,
    });

    expect(result).toMatchObject({
        mode: 'edit',
        description: 'Updated dinner',
        amount: '150',
        paidById: 'former-user',
        category: 'food',
        editContext: {
            entryId: 'expense-1',
            original: {
                category: 'food',
                subcategory: 'restaurants',
            },
        },
    });
    expect(result?.source.groups[0].members).toEqual(
        expect.arrayContaining([
            { id: 'former-user', displayName: 'Former participant' },
        ]),
    );
});
```

In src/store/activity-store/actions.test.ts, call prepareExpenseEdit synchronously, assert the latest child snapshot, and assert ledgerApi.fetchLedgerEntry was not called.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
npm run test:task -- src/store/expenseModalEditMapping.test.ts src/store/activity-store/actions.test.ts src/pages/activity-subevents-page/components/activity-subevents-header/components/activity-subevents-buttons/ActivitySubeventsButtons.test.tsx
```

Expected: FAIL because the mapper still requires an ApiExpenseLedgerEntry and the store action still performs a ledger read.

- [ ] **Step 3: Implement the Activity mapper and synchronous store action**

Use getActivitySubeventsView to select currentEvent. Narrow the current event to ExpenseCreated, ExpenseUpdated, or ExpenseReversed with expense metadata; return null for another category.

Create minimal participants from each share:

```ts
const toActivityParticipant = (
    share: ExpenseActivityShare,
): ExpenseParticipant => ({
    id: share.userId,
    displayName: share.displayName,
});

const getActivitySharingMode = (
    metadata: ExpenseActivityMetadata,
): SharingMode => metadata.sharingMode ?? {
    type: 'EXACT',
    customShares: getShareAmounts(metadata.shares ?? []),
};
```

Use metadata shares for participant IDs, exact fallback amounts, and display names. Merge current local users only when they exist. Add a minimal snapshot group if its group ID is not locally available; add minimal snapshot users to direct-expense knownFriends while excluding the current user. Do not fabricate email, names beyond displayName, or pictures.

Map metadata entryId, description, amount, currency, category, payerId, groupId/groupName, shares, and nullable sharingMode into the existing split-state shape. Keep category and subcategory in the original state. Do not map Activity createdAt or metadata date into an editable date.

In src/store/activity-store/actions.ts, remove the ledgerApi.fetchLedgerEntry call and edit loading lifecycle. prepareExpenseEdit calls mapActivityExpenseToModalState with getExpenseEditSource and returns directly. Update buttons to pass the root parent and loaded children and initialize immediately. Keep updateExpense and reverseLedgerEntry unchanged.

- [ ] **Step 4: Run mapper, store, and button tests**

Run:

```bash
npm run test:task -- src/store/expenseModalEditMapping.test.ts src/store/activity-store/actions.test.ts src/pages/activity-subevents-page/components/activity-subevents-header/components/activity-subevents-buttons/ActivitySubeventsButtons.test.tsx
```

Expected: PASS, including no ledger GET and restoration of former participant names.

- [ ] **Step 5: Commit**

```bash
git add src/store/expenseModalEditMapping.ts src/store/expenseModalEditMapping.test.ts src/store/activity-store/types.ts src/store/activity-store/actions.ts src/store/activity-store/actions.test.ts src/pages/activity-subevents-page/components/activity-subevents-header/components/activity-subevents-buttons
git commit -m "refactor: initialize expense edits from activity"
```

### Task 3: Remove Expense business date from edit mode only

**Files:**
- Modify: src/store/expenseModalStore.ts
- Modify: src/store/expenseModalUpdate.ts and its test
- Modify: src/components/modals/add-expense-modal/components/expense-details-section/ExpenseDetailsSection.tsx and its test
- Modify: affected edit initialization fixtures

**Interfaces:**
- Keep ExpenseModalState.date and selectExpensePayload date behavior for create mode.
- Remove date from ExpenseModalEditInitialization and ExpenseModalOriginalState.
- buildExpenseUpdateParams ignores draft.date entirely.
- ExpenseModalEditContext.original retains category and subcategory but no business date.

- [ ] **Step 1: Write failing date tests**

Replace the existing changed-date expectation and add a date-only case:

```ts
test('does not include date in an edit patch', () => {
    expect(buildExpenseUpdateParams(original, {
        ...draft,
        date: original.date + 1,
        description: 'Lunch',
    })).toEqual({
        type: 'EXPENSE',
        expense: { description: 'Lunch' },
    });
});

test('does not create an update for a date-only edit', () => {
    expect(buildExpenseUpdateParams(original, {
        ...draft,
        date: original.date + 1,
    })).toBeNull();
});
```

Add a details-section test that edit mode has no datetime-local input and create mode still has one.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
npm run test:task -- src/store/expenseModalUpdate.test.ts src/components/modals/add-expense-modal/components/expense-details-section/ExpenseDetailsSection.test.tsx src/store/expenseModalStore.test.ts src/components/modals/add-expense-modal/internal/hooks.test.tsx
```

Expected: FAIL because date is still compared/sent and the field is still rendered for edit.

- [ ] **Step 3: Implement the edit-only date boundary**

Remove date from edit initialization/original types and edit fixtures. Keep date in the common modal state because create mode owns it.

Render the field conditionally:

```tsx
const mode = useExpenseModalStore(state => state.mode);

return (
    <Grid columns={{ initial: '1', sm: '2' }} gap="3" align="stretch">
        <ExpenseAmountFields />
        <ExpenseCurrencyCategoryFields />
        {mode === 'create' && <ExpenseDateField />}
    </Grid>
);
```

Delete only the draft.date comparison from buildExpenseUpdateParams. Keep original subcategory populated from Activity metadata; because the current UI has no separate subcategory setter, an unchanged edit will not emit a category/subcategory patch and cannot clear the stored value. A changed category continues to send only category.

- [ ] **Step 4: Run date, modal, and create regression tests**

Run:

```bash
npm run test:task -- src/store/expenseModalUpdate.test.ts src/components/modals/add-expense-modal/components/expense-details-section/ExpenseDetailsSection.test.tsx src/store/expenseModalStore.test.ts src/components/modals/add-expense-modal/internal/hooks.test.tsx src/store/expenseModalEditMapping.test.ts
```

Expected: PASS; create payloads still contain date and edit patches do not.

- [ ] **Step 5: Commit**

```bash
git add src/store/expenseModalStore.ts src/store/expenseModalUpdate.ts src/store/expenseModalUpdate.test.ts src/components/modals/add-expense-modal/components/expense-details-section/ExpenseDetailsSection.tsx src/components/modals/add-expense-modal/components/expense-details-section/ExpenseDetailsSection.test.tsx src/components/modals/add-expense-modal/internal/hooks.test.tsx src/store/expenseModalStore.test.ts src/store/expenseModalEditMapping.test.ts
git commit -m "fix: omit expense date from edits"
```

### Task 4: Add contextual details and move actions out of the header

**Files:**
- Create: src/pages/activity-subevents-page/components/activity-subevents-details/ActivitySubeventsDetails.tsx, styled.ts, index.ts, and test
- Create: src/pages/activity-subevents-page/components/activity-subevents-buttons/ActivitySubeventsButtons.tsx, index.ts, internal/useConnect.ts, internal/index.ts, and test
- Delete: the old ActivitySubeventsButtons files under activity-subevents-header/components
- Modify: ActivitySubeventsHeader.tsx, its test, page components/index.ts, and all five activity locale files

**Interfaces:**
- ActivitySubeventsDetails accepts { view?: ActivitySubeventsView; isLoading: boolean }.
- ActivitySubeventsButtons accepts { parentEvent: AppEvent; currentEvent: AppEvent; isLoading: boolean }.
- Desktop and mobile use the same details content; only the Radix responsive wrapper differs.
- Buttons consume store commands and loaded children, never runtime API modules.

- [ ] **Step 1: Write failing details and action relocation tests**

Move the button tests to the new owner. Add tests for latest description, concrete share, historical display name, root creation time, Settlement direction without Expense participants, reversed Edit suppression, and header action absence.

```tsx
test('renders the latest Expense snapshot and root creation time', () => {
    render(
        <ActivitySubeventsDetails
            view={{ originalEvent: parentEvent, currentEvent: latestExpenseEvent }}
            isLoading={false}
        />,
    );

    expect(screen.getByText('Updated dinner')).toBeTruthy();
    expect(screen.getByText('Former participant')).toBeTruthy();
    expect(screen.getByText('75 USD')).toBeTruthy();
    expect(screen.getByText(/Created at/)).toBeTruthy();
});

test('hides Edit when the latest Expense state is reversed', () => {
    render(
        <ActivitySubeventsDetails
            view={{ originalEvent: parentEvent, currentEvent: reversedExpenseEvent }}
            isLoading={false}
        />,
    );

    expect(screen.queryByRole('button', { name: 'subeventsUpdateAction' })).toBeNull();
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
npm run test:task -- src/pages/activity-subevents-page/components/activity-subevents-header/ActivitySubeventsHeader.test.tsx src/pages/activity-subevents-page/components/activity-subevents-details/ActivitySubeventsDetails.test.tsx src/pages/activity-subevents-page/components/activity-subevents-buttons/ActivitySubeventsButtons.test.tsx
```

Expected: FAIL because the new owners do not exist and the old header still renders actions.

- [ ] **Step 3: Implement the shared contextual details content**

Remove buttons from ActivitySubeventsHeader but retain the History heading, root event, skeleton, and unavailable state.

Create one content renderer that shows:

- Expense description, Amount amount/currency, payer, root createdAt, group/scope, category, subcategory when present, sharing mode when present, participant count, participant displayName, and Amount from shareAmount/currency.
- Settlement amount/currency, From, To, root createdAt, scope, and relevant actions, without an Expense split list.
- Localized labels and sharing-mode names in en, es, pt-BR, pt-PT, and ru.

Use formatActivityAbsoluteDate(view.originalEvent.createdAt, i18n.language). Use Amount for all money. Use LedgerScopeBadge for the existing scope presentation. The compact mobile summary must show amount, payer/direction, root creation time, and participant count before expanding.

Wrap the same content in Radix responsive surfaces:

```tsx
<Box display={{ initial: 'none', sm: 'block' }}>
    <DetailsCard>{content}</DetailsCard>
</Box>
<Box display={{ initial: 'block', sm: 'none' }}>
    <Accordion.Root type="single" collapsible>
        <Accordion.Item value="details">
            <Accordion.Header>
                <Accordion.Trigger>{t('subeventsDetailsAction')}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>{content}</Accordion.Content>
        </Accordion.Item>
    </Accordion.Root>
</Box>
```

Move ActivitySubeventsButtons into its own page component directory. Bind availability to currentEvent: use its latest metadata entry ID, current action for reversed suppression, and the root parent ID for refresh. Hide Edit for Settlement and latest reversed Expense. Keep RemoveLedgerEntryAlertDialog, loading, permission checks, error toasts, and reverse/delete calls.

- [ ] **Step 4: Run details and action tests**

Run:

```bash
npm run test:task -- src/pages/activity-subevents-page/components/activity-subevents-header/ActivitySubeventsHeader.test.tsx src/pages/activity-subevents-page/components/activity-subevents-details/ActivitySubeventsDetails.test.tsx src/pages/activity-subevents-page/components/activity-subevents-buttons/ActivitySubeventsButtons.test.tsx
```

Expected: PASS with no actions in the header, current metadata in details, root creation time, and no Settlement participant split list.

- [ ] **Step 5: Commit**

```bash
git add src/pages/activity-subevents-page/components src/i18n/locales/en/activity.json src/i18n/locales/es/activity.json src/i18n/locales/pt-BR/activity.json src/i18n/locales/pt-PT/activity.json src/i18n/locales/ru/activity.json
git commit -m "feat: add activity current-state details"
```

### Task 5: Compose the wide page and preserve the History stream

**Files:**
- Modify: src/pages/activity-subevents-page/ActivitySubeventsPage.tsx
- Modify: src/pages/activity-subevents-page/ActivitySubeventsPage.test.tsx
- Modify: src/pages/activity-subevents-page/components/index.ts
- Modify: only imports or focused tests in ActivitySubeventsFeed if required

**Interfaces:**
- Consume getActivitySubeventsView, ActivitySubeventsHeader, ActivitySubeventsDetails, and the unchanged ActivitySubeventsFeed boundary.
- Keep ActivitySubeventsFeed responsible for child fetching, pagination, retry, loading, empty, and end handling.
- Produce one existing global sidebar from InternalPageLayout plus one contextual details side panel.

- [ ] **Step 1: Write failing page composition tests**

Extend ActivitySubeventsPage.test.tsx to assert that the page passes a parent/child view to details while the History header and feed remain present:

```tsx
test('renders contextual details and keeps History content', () => {
    useActivityStore.setState({
        subeventsParent: parentEvent,
        subevents: [latestExpenseEvent],
    });
    useLoadingStore.getState().setInitialLoadingStore();

    renderPage();

    expect(screen.getByTestId('subevents-details')).toBeTruthy();
    expect(screen.getByTestId('subevents-header')).toBeTruthy();
    expect(screen.getByTestId('subevents-feed')).toBeTruthy();
    expect(screen.getByTestId('parent-event')).toBeTruthy();
});
```

Keep the direct-visit fallback test and assert details receives no view while data is unavailable.

- [ ] **Step 2: Run page test and verify failure**

Run:

```bash
npm run test:task -- src/pages/activity-subevents-page/ActivitySubeventsPage.test.tsx
```

Expected: FAIL because the page still uses Container size 2 and has no contextual details side panel.

- [ ] **Step 3: Implement the wide responsive composition**

Subscribe to subeventsParent and subevents once, derive the pure view during render, and compose:

```tsx
<Container size="4" pb={{ initial: '9', sm: '6' }}>
    <InternalPageColumnsFromSm
        sidePanel={
            <ActivitySubeventsDetails
                view={activityView}
                isLoading={isLoading}
            />
        }
    >
        <ActivitySubeventsHeader
            parentEvent={parentEvent}
            isLoading={isLoading}
            isUnavailable={!isLoading && !parentEvent}
        />
        <ActivitySubeventsFeed
            parentActivityId={parentActivityId}
            activityCategory={activityCategory}
        />
    </InternalPageColumnsFromSm>
</Container>
```

Use only the loaded root parent in the History header. Do not replace it with currentEvent. Keep the existing ActivitySubeventsFeed effect and behavior unchanged.

- [ ] **Step 4: Run page, feed, and activity component tests**

Run:

```bash
npm run test:task -- src/pages/activity-subevents-page/ActivitySubeventsPage.test.tsx src/pages/activity-subevents-page/components/activity-subevents-feed/ActivitySubeventsFeed.test.tsx src/features/activity/components/activity-event/ActivityEvent.test.tsx src/features/activity/components/event-expense/EventExpense.test.tsx src/features/activity/components/event-settlement/EventSettlement.test.tsx
```

Expected: PASS; the root parent remains in History and child pagination remains covered.

- [ ] **Step 5: Commit**

```bash
git add src/pages/activity-subevents-page
git commit -m "feat: widen activity subevents page"
```

### Task 6: Verify refresh consistency and complete the repository gate

**Files:**
- Modify: src/store/activity-store/actions.test.ts
- Modify: the details, buttons, and mapper tests for current-state refresh coverage
- Inspect: all changed files and the final diff

- [ ] **Step 1: Add and run refresh consistency coverage**

Add a store test that stubs canonical fetch actions and asserts a successful update refreshes visible Activity children:

```ts
test('refreshes visible Activity children after a successful Expense update', () => {
    const fetchSetActivitySubevents = vi.fn().mockResolvedValue(undefined);

    useActivityStore.setState({
        fetchSetActivitySubevents,
        subeventsParent: parentEvent,
        subeventsCategory: ACTIVITY_CATEGORIES.EXPENSE,
    });

    return useActivityStore.getState().updateExpense({
        entryId: 'expense-1',
        entry: { type: 'EXPENSE', expense: { description: 'Latest dinner' } },
        groupId: 'group-1',
        parentActivityId: parentEvent.id,
    }).then(() => {
        expect(fetchSetActivitySubevents).toHaveBeenCalledWith({
            parentActivityId: parentEvent.id,
            category: ACTIVITY_CATEGORIES.EXPENSE,
            force: true,
        });
    });
});
```

Run the focused refresh tests and confirm they pass. Keep refreshFinancialData unchanged unless the tests reveal a concrete regression.

- [ ] **Step 2: Run the complete focused changed-module suite**

Run:

```bash
npm run test:task -- src/helpers/activityEvent.test.ts src/store/expenseModalEditMapping.test.ts src/store/activity-store/actions.test.ts src/store/expenseModalUpdate.test.ts src/store/expenseModalStore.test.ts src/components/modals/add-expense-modal/components/expense-details-section/ExpenseDetailsSection.test.tsx src/components/modals/add-expense-modal/internal/hooks.test.tsx src/pages/activity-subevents-page/ActivitySubeventsPage.test.tsx src/pages/activity-subevents-page/components/activity-subevents-header/ActivitySubeventsHeader.test.tsx src/pages/activity-subevents-page/components/activity-subevents-details/ActivitySubeventsDetails.test.tsx src/pages/activity-subevents-page/components/activity-subevents-buttons/ActivitySubeventsButtons.test.tsx src/pages/activity-subevents-page/components/activity-subevents-feed/ActivitySubeventsFeed.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run repository verification**

Run:

```bash
npm run verify
npm run test:full
npm run build
```

Expected: lint/typecheck, full Vitest, and production build pass. Record exact pre-existing failures separately without changing unrelated code.

- [ ] **Step 4: Run static scope checks**

Run:

```bash
rg -n "prepareExpenseEdit|fetchLedgerEntry|ledgerApi\.fetchLedgerEntry" src
rg -n "draft\.date|expense\.date" src/store/expenseModalUpdate.ts src/store/expenseModalEditMapping.ts src/components/modals/add-expense-modal
rg -n "shares: \[|displayName" src/api/activity.types.ts src/features/activity src/pages/activity-subevents-page src/store/expenseModalEditMapping.ts
rg -n "breadcrumb|Breadcrumb" src/pages/activity-subevents-page src/components/internal-page-layout
git diff --check
```

Expected: no Expense-edit fetchLedgerEntry call, no date comparison or edit PATCH field, participant mapping/rendering uses displayName, and no breadcrumbs were added. The presence of create-mode date handling is expected.

- [ ] **Step 5: Inspect final diff and report evidence**

Run:

```bash
git diff --stat dev...HEAD
git diff --name-only dev...HEAD
git status --short --branch
```

Confirm only the approved Activity subevents, Expense edit, tests, translations, and design/plan documents changed. Report commits, changed components, responsive behavior, tests, verification results, and any remaining caveats.
