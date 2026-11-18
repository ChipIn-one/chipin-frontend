import { Button, Flex } from '@radix-ui/themes';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES } from 'constants/activity';
import type { ActivityEvent } from 'entities/activity';
import {
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
import { prepareExpenseEdit } from 'store/activityExpenseEdit';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { RemoveLedgerEntryAlertDialog } from 'components/modals/remove-ledger-entry-alert-dialog';

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
    const { pendingDeletes } = useOutboxOverlay();
    const isDeleteQueued = parentEntryId !== undefined && pendingDeletes.has(parentEntryId);
    const isChangeable = canChange && !isDeleteQueued;
    const observedEntryId =
        isOfflineWritable && isExpense && canChange && !isEntryReversed ? parentEntryId : undefined;

    const onEdit = (): void => {
        if (!parentEntryId || !isExpense || !isChangeable) {
            return;
        }

        const initialization = prepareExpenseEdit({
            parentEvent,
            childEvents,
            parentActivityId,
        });

        if (initialization) {
            initializeEdit(initialization);
        }
    };

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

    return (
        <Flex align="center" gap="2" wrap="wrap">
            {observedEntryId ? <LedgerEntryObserver entryId={observedEntryId} /> : null}
            <Button
                size="1"
                variant="soft"
                disabled={!parentEntryId || !isExpense || !isChangeable}
                onClick={onEdit}
            >
                <PencilIcon size={14} />
                {t('subeventsUpdateAction')}
            </Button>

            <RemoveLedgerEntryAlertDialog isActionLoading={isRemoving} onAction={onRemove}>
                <Button
                    size="1"
                    variant="soft"
                    color="red"
                    disabled={!parentEntryId || isRemoving || !isChangeable}
                >
                    <Trash2Icon size={14} />
                    {t('subeventsDeleteAction')}
                </Button>
            </RemoveLedgerEntryAlertDialog>
        </Flex>
    );
};

export { ActivitySubeventsButtons };
