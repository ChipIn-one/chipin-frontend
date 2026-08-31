import { LucidePencil, LucideTrash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button, Flex, Skeleton } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_CATEGORIES } from 'constants/activity';
import {
    getActivityCategory,
    getActivityLedgerEntryId,
    getActivitySubeventsView,
} from 'helpers/activityEvent';
import { resolveApiErrorMessageFromError } from 'helpers/errors';

import { RemoveLedgerEntryAlertDialog } from 'components/modals';

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
    const {
        reverseLedgerEntry,
        prepareExpenseEdit,
        initializeEdit,
        subevents,
        isLoading,
        isRemoving,
    } = useConnect();
    const childEvents = childEventsProp ?? subevents;
    const currentEvent = currentEventProp ?? getActivitySubeventsView(
        parentEvent,
        childEvents,
    )?.currentEvent ?? parentEvent;
    const parentEntryId = getActivityLedgerEntryId(parentEvent);
    const rootActivityId = parentEvent.parentActivityId ?? parentEvent.id;
    const isEntryReversed = currentEvent.action.endsWith('_REVERSED');
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

        return reverseLedgerEntry({
            entryId: parentEntryId,
            groupId: parentEvent.groupId ?? undefined,
            parentActivityId: rootActivityId,
        })
            .then(() => {
                toast.success(t('toasts:ledger.entryDeleted'));
            })
            .catch(error => {
                toast.error(resolveApiErrorMessageFromError(
                    error,
                    t('toasts:common.requestFailed'),
                ));
                return Promise.reject(error);
            });
    };

    if (isLoading) {
        return (
            <Flex align="center" gap="2" wrap="wrap">
                <Skeleton>
                    <Button size="1" variant="soft">
                        <LucidePencil size={14} />
                        {t('subeventsUpdateAction')}
                    </Button>
                </Skeleton>

                <Skeleton>
                    <Button size="1" variant="soft" color="red">
                        <LucideTrash2 size={14} />
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
                <LucidePencil size={14} />
                {t('subeventsUpdateAction')}
            </Button>

            <RemoveLedgerEntryAlertDialog
                isActionLoading={isRemoving}
                onAction={onRemove}
            >
                <Button
                    size="1"
                    variant="soft"
                    color="red"
                    disabled={!parentEntryId || isRemoving}
                >
                    <LucideTrash2 size={14} />
                    {t('subeventsDeleteAction')}
                </Button>
            </RemoveLedgerEntryAlertDialog>
        </Flex>
    );
};

export { ActivitySubeventsButtons };
