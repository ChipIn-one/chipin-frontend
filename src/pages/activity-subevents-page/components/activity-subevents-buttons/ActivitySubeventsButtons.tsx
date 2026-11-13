import { Button, Flex, Skeleton } from '@radix-ui/themes';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES } from 'constants/activity';
import {
    getActivityCategory,
    getActivityLedgerEntryId,
    getActivitySubeventsView,
} from 'helpers/activityEvent';
import {
    isRepeatedLedgerWrite,
    ledgerWriteErrorMessage,
    useDeleteLedgerEntry,
} from 'hooks/useLedgerMutations';

import { RemoveLedgerEntryAlertDialog } from 'components/modals/remove-ledger-entry-alert-dialog';

import { useConnect } from './internal';

interface Props {
    parentEvent: AppEvent;
    currentEvent?: AppEvent;
    childEvents?: readonly AppEvent[];
}

const ActivitySubeventsButtons = ({
    parentEvent,
    currentEvent: currentEventProp,
    childEvents: childEventsProp,
}: Props) => {
    const { t } = useTranslation(['activity', 'toasts']);
    const { prepareExpenseEdit, initializeEdit, subevents, isLoading } = useConnect();
    const { deleteLedgerEntry, isPending: isRemoving } = useDeleteLedgerEntry();
    const childEvents = childEventsProp ?? subevents;
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
                if (!isRepeatedLedgerWrite(error)) {
                    toast.error(ledgerWriteErrorMessage(error, t('toasts:common.requestFailed')));
                }
                return Promise.reject(error);
            });
    };

    if (isLoading) {
        return (
            <Flex align="center" gap="2" wrap="wrap">
                <Skeleton>
                    <Button size="1" variant="soft">
                        <PencilIcon size={14} />
                        {t('subeventsUpdateAction')}
                    </Button>
                </Skeleton>

                <Skeleton>
                    <Button size="1" variant="soft" color="red">
                        <Trash2Icon size={14} />
                        {t('subeventsDeleteAction')}
                    </Button>
                </Skeleton>
            </Flex>
        );
    }

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
