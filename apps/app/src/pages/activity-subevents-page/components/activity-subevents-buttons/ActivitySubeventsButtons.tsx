import { useCallback, useEffect } from 'react';
import { Button, Flex } from '@radix-ui/themes';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES } from 'constants/activity';
import { ONLINE_ONLY_ACTIONS } from 'constants/onlineOnlyActions';
import type { ActivityEvent } from 'entities/activity';
import {
    dropDeletedConflictDraft,
    useIsOfflineWriteAvailable,
    useLedgerEntryObserver,
    useOutboxOverlay,
} from 'entities/ledger';
import {
    getActivityCategory,
    getActivityLedgerEntryId,
    getActivitySubeventsView,
} from 'helpers/activityEvent';
import { toastLedgerWriteError, useDeleteLedgerEntry } from 'hooks/useLedgerMutations';
import { prepareExpenseEdit, withConflictDraft } from 'store/activityExpenseEdit';
import { useConflictDraftStore } from 'store/conflictDraftStore';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { RemoveLedgerEntryAlertDialog } from 'components/modals/remove-ledger-entry-alert-dialog';
import { OnlineOnly } from 'components/online-only';

// Keeps the expense's `ledger.entry(id)` read while it is shown (spec 03 §2.9 C2-33: an outbox edit
// or delete needs it). Rendered only while offline writes are available.
const LedgerEntryObserver = ({ entryId }: { entryId: string }) => {
    useLedgerEntryObserver(entryId);
    return null;
};

interface Props {
    parentEvent: ActivityEvent;
    currentEvent?: ActivityEvent;
    /** The chain's later events, as the history page loaded them. */
    childEvents: readonly ActivityEvent[];
    /** The id the history query is keyed by (the route's): invalidated after a write. */
    parentActivityId: string | undefined;
    /** False when the shown state may be stale (an unreadable event): no edit or delete. */
    canChange?: boolean;
}

const ActivitySubeventsButtons = ({
    parentEvent,
    currentEvent: currentEventProp,
    childEvents,
    parentActivityId,
    canChange = true,
}: Props) => {
    const { t } = useTranslation(['activity', 'toasts']);
    const initializeEdit = useExpenseModalStore(state => state.initializeEdit);
    const requestedDraftEntryId = useConflictDraftStore(state => state.requestedEntryId);
    const { deleteLedgerEntry, isPending: isRemoving } = useDeleteLedgerEntry();
    const currentEvent =
        currentEventProp ??
        getActivitySubeventsView(parentEvent, childEvents)?.currentEvent ??
        parentEvent;
    const parentEntryId = getActivityLedgerEntryId(parentEvent);
    const isEntryReversed =
        currentEvent.action === ACTIVITY_ACTIONS.EXPENSE_REVERSED ||
        currentEvent.action === ACTIVITY_ACTIONS.SETTLEMENT_REVERSED;
    const isExpense = getActivityCategory(parentEvent) === ACTIVITY_CATEGORIES.EXPENSE;
    const isOfflineWritable = useIsOfflineWriteAvailable();
    // 03-16a A review N5: a queued delete of the entry is its last word; no edit or second delete.
    const { pendingDeletes, conflictDraftEntryIds } = useOutboxOverlay();
    const isDeleteQueued = parentEntryId !== undefined && pendingDeletes.has(parentEntryId);
    // §2.6: an expense with a conflict draft (flag off: never).
    const hasDraft = parentEntryId !== undefined && conflictDraftEntryIds.has(parentEntryId);
    const isChangeable = canChange && !isDeleteQueued;
    const observedEntryId =
        isOfflineWritable && isExpense && canChange && !isEntryReversed ? parentEntryId : undefined;

    const onEdit = useCallback((): void => {
        if (!parentEntryId || !isExpense || !isChangeable) {
            return;
        }

        const initialization = prepareExpenseEdit({
            parentEvent,
            childEvents,
            parentActivityId,
        });

        if (!initialization) {
            return;
        }
        // §2.6: with a conflict draft the form opens on it ("your unsaved changes").
        const opened = hasDraft
            ? withConflictDraft(initialization)
            : { initialization, isDraft: false };

        useConflictDraftStore.getState().setOpened(opened.isDraft ? parentEntryId : null);
        initializeEdit(opened.initialization);
    }, [
        childEvents,
        hasDraft,
        initializeEdit,
        isChangeable,
        isExpense,
        parentActivityId,
        parentEntryId,
        parentEvent,
    ]);

    // "Open my changes" (the toast, `OutboxSheet`) navigated here: open the form on the draft once.
    useEffect(() => {
        const store = useConflictDraftStore.getState();

        if (
            parentEntryId === undefined ||
            requestedDraftEntryId !== parentEntryId ||
            store.requestedEntryId !== parentEntryId
        ) {
            return;
        }
        store.clearRequest();
        onEdit();
    }, [onEdit, parentEntryId, requestedDraftEntryId]);

    // §2.6: a reversed expense drops its draft (the history shows the deletion).
    useEffect(() => {
        if (isEntryReversed && hasDraft && parentEntryId !== undefined) {
            void dropDeletedConflictDraft(parentEntryId);
        }
    }, [hasDraft, isEntryReversed, parentEntryId]);

    const onRemove = (): Promise<void> => {
        if (!parentEntryId || !isChangeable) {
            return Promise.reject(new Error('No ledger entry found to remove'));
        }

        return deleteLedgerEntry({
            entryId: parentEntryId,
            groupId: parentEvent.groupId ?? undefined,
            parentActivityId,
        })
            .then(({ queued }) => {
                // A queued delete is not done on the server yet: its toast is the outbox's (L5).
                if (!queued) {
                    toast.success(t('toasts:ledger.entryDeleted'));
                }
            })
            .catch((error: unknown) => {
                toastLedgerWriteError(error, t('toasts:common.requestFailed'));
                return Promise.reject(error);
            });
    };

    if (isEntryReversed) {
        return null;
    }

    const editButton = (
        <Button
            size="1"
            variant="soft"
            disabled={!parentEntryId || !isExpense || !isChangeable}
            onClick={onEdit}
        >
            <PencilIcon size={14} />
            {t('subeventsUpdateAction')}
        </Button>
    );
    const deleteButton = (
        <Button
            size="1"
            variant="soft"
            color="red"
            disabled={!parentEntryId || isRemoving || !isChangeable}
        >
            <Trash2Icon size={14} />
            {t('subeventsDeleteAction')}
        </Button>
    );

    // §2.9 C2-02: a settlement is changed only online (an expense may go through the outbox).
    return (
        <Flex align="center" gap="2" wrap="wrap">
            {observedEntryId ? <LedgerEntryObserver entryId={observedEntryId} /> : null}
            {isExpense ? (
                editButton
            ) : (
                <OnlineOnly action={ONLINE_ONLY_ACTIONS.settlementEdit}>{editButton}</OnlineOnly>
            )}

            <RemoveLedgerEntryAlertDialog isActionLoading={isRemoving} onAction={onRemove}>
                {isExpense ? (
                    deleteButton
                ) : (
                    <OnlineOnly action={ONLINE_ONLY_ACTIONS.settlementDelete}>
                        {deleteButton}
                    </OnlineOnly>
                )}
            </RemoveLedgerEntryAlertDialog>
        </Flex>
    );
};

export { ActivitySubeventsButtons };
