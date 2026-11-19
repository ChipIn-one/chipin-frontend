// Spec 04 §2.11 item 4 (04-2d; moved from 03-13): an open expense draft survives an app reload (an
// applied update, the "update required" button, the error fallback). Before the reload an
// `onBeforeAppReload` callback writes it to `sessionStorage` (this tab only, gone with the tab); at
// startup it is read once, the key removed, and the modal reopens with it.
// - Versioned key `chipin_expenseDraft_v1` and a `v` field: another version is dropped.
// - `Money` holds `bigint` units, so the codec writes a bigint as `{ "$bigint": "<digits>" }`.
// - Read data is validated (zod, invariant 6): corrupt or foreign data is dropped.
// - Minimal personal data: a create draft is saved without its `source` (the modal rebuilds it
//   from the live queries); an edit draft keeps only the id, name and picture of its participants.
// - The draft carries its user: it is restored only for the same signed-in user of this tab, and a
//   sign-out or account switch removes it (`store/authStore`).
import { z } from 'zod';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';
import { SS_KEY_EXPENSE_DRAFT } from 'constants/localstorage';
import { type AppReloadContext, onBeforeAppReload } from 'helpers/appUpdate';
import { getTabUserId, SessionStorage } from 'helpers/localStorage';
import { currencyCode } from 'shared/money';
import {
    type ExpenseModalDraft,
    type ExpenseModalSource,
    type ExpenseModalState,
    type ExpenseParticipant,
    useExpenseModalStore,
} from 'store/expenseModalStore';

const DRAFT_VERSION = 1;

// ─── bigint-safe JSON codec ──────────────────────────────────────────────────

const BIGINT_TAG = '$bigint';
const BIGINT_TEXT = /^-?\d+$/;

const isRecord = (value: unknown): value is Partial<Record<string, unknown>> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** `JSON.stringify` that writes a bigint as `{ "$bigint": "<digits>" }`. */
export const encodeWithBigInt = (value: unknown): string =>
    JSON.stringify(value, (_key, item: unknown) =>
        typeof item === 'bigint' ? { [BIGINT_TAG]: item.toString() } : item,
    );

/** `JSON.parse` that reads `{ "$bigint": "<digits>" }` back as a bigint; throws on bad JSON. */
export const decodeWithBigInt = (text: string): unknown =>
    JSON.parse(text, (_key, item: unknown) => {
        if (isRecord(item) && Object.keys(item).length === 1) {
            const digits = item[BIGINT_TAG];

            if (typeof digits === 'string' && BIGINT_TEXT.test(digits)) {
                return BigInt(digits);
            }
        }
        return item;
    });

// ─── schema ──────────────────────────────────────────────────────────────────

const StringRecord = z.record(z.string(), z.string());

const MoneySchema = z
    .object({ minor: z.bigint(), currency: z.string().regex(/^[A-Z]{3}$/) })
    .transform(({ minor, currency }) => ({ minor, currency: currencyCode(currency) }));

const SharingModeSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('AUTO') }),
    z.object({ type: z.literal('EXACT'), customShares: z.record(z.string(), MoneySchema) }),
    z.object({ type: z.literal('PERCENTAGE'), percentageShares: StringRecord }),
    z.object({ type: z.literal('SHARES'), shares: StringRecord }),
]);

const ParticipantSchema = z.object({
    id: z.string().min(1),
    displayName: z.string(),
    picture: z.string().nullable().optional(),
});

const SourceSchema = z.object({
    context: z.enum(['dashboard', 'friends', 'group']),
    currentUser: ParticipantSchema.nullable(),
    defaultCurrency: z.string(),
    defaultCategory: z.string(),
    skipCategory: z.boolean(),
    groups: z.array(
        z.object({
            id: z.string().min(1),
            name: z.string().optional(),
            members: z.array(ParticipantSchema),
            lastUsedCurrency: z.string().nullable().optional(),
        }),
    ),
    knownFriends: z.array(ParticipantSchema),
    defaultGroupId: z.string().optional(),
    preferredFriendId: z.string().optional(),
});

const EditContextSchema = z.object({
    entryId: z.string().min(1),
    groupId: z.string().optional(),
    groupName: z.string().nullable().optional(),
    parentActivityId: z.string().optional(),
    original: z.object({
        description: z.string().nullable(),
        amount: MoneySchema,
        payerId: z.string(),
        participantIds: z.array(z.string()),
        currency: z.string(),
        category: z.string().nullable(),
        subcategory: z.string().nullable(),
        sharingMode: SharingModeSchema,
    }),
});

const DraftSchema = z.object({
    mode: z.enum(['create', 'edit']),
    openingContext: z.literal('friends').optional(),
    openingFriendId: z.string().optional(),
    source: SourceSchema.nullable(),
    targetMode: z.enum(['group', 'friends']),
    groupId: z.string(),
    selectedFriendId: z.string(),
    description: z.string(),
    amount: z.string(),
    date: z.number(),
    currency: z.string(),
    isCurrencyManuallyEdited: z.boolean(),
    category: z.string(),
    paidById: z.string(),
    splitMode: z.enum([
        EXPENSE_SPLIT_MODES.EQUAL,
        EXPENSE_SPLIT_MODES.PERCENT,
        EXPENSE_SPLIT_MODES.AMOUNTS,
        EXPENSE_SPLIT_MODES.SHARES,
    ]),
    percentShares: StringRecord,
    amountShares: StringRecord,
    shareWeights: StringRecord,
    includedParticipantIds: z.record(z.string(), z.boolean()),
    isPercentManuallyEdited: z.boolean(),
    editContext: EditContextSchema.nullable(),
    clientEntryId: z.string().nullable(),
    ownerId: z.string().nullable(),
});

const SavedDraftSchema = z.object({
    v: z.literal(DRAFT_VERSION),
    userId: z.string().min(1),
    draft: DraftSchema,
});

// ─── save and restore ────────────────────────────────────────────────────────

const toParticipant = ({ id, displayName, picture }: ExpenseParticipant) => ({
    id,
    displayName,
    ...(picture === undefined ? {} : { picture }),
});

// An edit draft keeps only the people the edit form shows: the current user, the expense's group
// (its members are the form's participants) and the friends taking part in the expense. Other
// groups and friends are not stored. Trade-off (L4): after a restore, the friend picker of the
// edit form lists only the entry's participants (an edit cannot move an expense to another friend
// anyway, and a fresh edit modal reads the full list again).
const toSavedEditSource = (state: ExpenseModalState): ExpenseModalSource => {
    const { source, editContext } = state;
    const groupId = editContext?.groupId ?? state.groupId;
    const participantIds = new Set([
        ...(editContext?.original.participantIds ?? []),
        ...Object.keys(state.includedParticipantIds),
        state.selectedFriendId,
    ]);

    return {
        ...source,
        currentUser: source.currentUser ? toParticipant(source.currentUser) : null,
        groups: source.groups
            .filter(group => group.id === groupId)
            .map(group => ({ ...group, members: group.members.map(toParticipant) })),
        knownFriends: source.knownFriends
            .filter(friend => participantIds.has(friend.id))
            .map(toParticipant),
    };
};

const toDraft = (state: ExpenseModalState): ExpenseModalDraft => {
    const { isOpened: _isOpened, source: _source, ...fields } = state;

    return { ...fields, source: state.mode === 'edit' ? toSavedEditSource(state) : null };
};

/**
 * Writes the open draft of the signed-in user of this tab; nothing (and an older saved draft is
 * removed) when the modal is closed, there is no user, the draft is another user's, or the reload
 * comes from the error fallback (`keepDraft: false`: the draft may be what crashed the app).
 */
export const saveExpenseDraftForReload = (
    context: AppReloadContext = { keepDraft: true },
): void => {
    const state = useExpenseModalStore.getState();
    const userId = getTabUserId();

    if (
        !context.keepDraft ||
        !state.isOpened ||
        userId === undefined ||
        (state.ownerId !== null && state.ownerId !== userId)
    ) {
        SessionStorage.remove(SS_KEY_EXPENSE_DRAFT);
        return;
    }

    SessionStorage.setRaw(
        SS_KEY_EXPENSE_DRAFT,
        encodeWithBigInt({ v: DRAFT_VERSION, userId, draft: toDraft(state) }),
    );
};

const readSavedDraft = (raw: string): z.infer<typeof SavedDraftSchema> | null => {
    try {
        const parsed = SavedDraftSchema.safeParse(decodeWithBigInt(raw));

        return parsed.success ? parsed.data : null;
    } catch {
        // Not JSON, or a currency `currencyCode` rejects: corrupt data, dropped.
        return null;
    }
};

/**
 * At startup, once: reopens the modal with the saved draft of the signed-in user of this tab and
 * removes the key. Corrupt, foreign-version or another user's data is dropped. Returns whether a
 * draft was restored.
 */
export const restoreExpenseDraftAfterReload = (): boolean => {
    const raw = SessionStorage.getRaw(SS_KEY_EXPENSE_DRAFT);

    if (raw === null) {
        return false;
    }
    SessionStorage.remove(SS_KEY_EXPENSE_DRAFT);

    const saved = readSavedDraft(raw);
    const userId = getTabUserId();

    if (!saved || userId === undefined || saved.userId !== userId) {
        return false;
    }
    if (saved.draft.ownerId !== null && saved.draft.ownerId !== userId) {
        return false;
    }

    useExpenseModalStore.getState().restoreDraft(saved.draft);
    return true;
};

/** The app branch at startup: restore a saved draft, then save the open one before any reload. */
export const startExpenseDraftReload = (): (() => void) => {
    restoreExpenseDraftAfterReload();

    return onBeforeAppReload(saveExpenseDraftForReload);
};
