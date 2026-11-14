import { Button, Flex } from '@radix-ui/themes';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES } from 'constants/activity';
import type { ActivityEvent } from 'entities/activity';
import {
    getActivityCategory,
    getActivityLedgerEntryId,
    getActivitySubeventsView,
} from 'helpers/activityEvent';
import { toastLedgerWriteError, useDeleteLedgerEntry } from 'hooks/useLedgerMutations';
import { prepareExpenseEdit } from 'store/activityExpenseEdit';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { RemoveLedgerEntryAlertDialog } from 'components/modals/remove-ledger-entry-alert-dialog';

interface Props {
    parentEvent: ActivityEvent;
    currentEvent?: ActivityEvent;
    /** The chain's later events, as the history page loaded them. */
    childEvents: readonly ActivityEvent[];
}

const ActivitySubeventsButtons = ({
    parentEvent,
    currentEvent: currentEventProp,
    childEvents,
}: Props) => {
    const { t } = useTranslation(['activity', 'toasts']);
    const initializeEdit = useExpenseModalStore(state => state.initializeEdit);
    const { deleteLedgerEntry, isPending: isRemoving } = useDeleteLedgerEntry();
    const currentEvent =
        currentEventProp ??
        getActivitySubeventsView(parentEvent, childEvents)?.currentEvent ??
        parentEvent;
    const parentEntryId = getActivityLedgerEntryId(parentEvent);
    const rootActivityId = parentEvent.parentActivityId ?? parentEvent.id;
    const isEntryReversed =
        currentEvent.action === ACTIVITY_ACTIONS.EXPENSE_REVERSED ||
        currentEvent.action === ACTIVITY_ACTIONS.SETTLEMENT_REVERSED;
    const isExpense = getActivityCategory(parentEvent) === ACTIVITY_CATEGORIES.EXPENSE;

    const onEdit = (): void => {
        if (!parentEntryId || !isExpense) {
            return;
        }

        const initialization = prepareExpenseEdit({
            parentEvent,
            childEvents,
            parentActivityId: rootActivityId,
        });

        if (initialization) {
            initializeEdit(initialization);
        }
    };

    const onRemove = (): Promise<void> => {
        if (!parentEntryId) {
            return Promise.reject(new Error('No ledger entry found to remove'));
        }

        return deleteLedgerEntry({
            entryId: parentEntryId,
            groupId: parentEvent.groupId ?? undefined,
            parentActivityId: rootActivityId,
        })
            .then(() => {
                toast.success(t('toasts:ledger.entryDeleted'));
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
            <Button
                size="1"
                variant="soft"
                disabled={!parentEntryId || !isExpense}
                onClick={onEdit}
            >
                <PencilIcon size={14} />
                {t('subeventsUpdateAction')}
            </Button>

            <RemoveLedgerEntryAlertDialog isActionLoading={isRemoving} onAction={onRemove}>
                <Button size="1" variant="soft" color="red" disabled={!parentEntryId || isRemoving}>
                    <Trash2Icon size={14} />
                    {t('subeventsDeleteAction')}
                </Button>
            </RemoveLedgerEntryAlertDialog>
        </Flex>
    );
};

export { ActivitySubeventsButtons };
