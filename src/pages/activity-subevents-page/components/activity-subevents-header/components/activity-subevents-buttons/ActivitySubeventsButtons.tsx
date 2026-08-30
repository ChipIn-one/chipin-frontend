import { LucidePencil, LucideTrash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button, Flex, Skeleton } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_CATEGORIES } from 'constants/activity';
import { getActivityCategory, getActivityLedgerEntryId } from 'helpers/activityEvent';
import { resolveApiErrorMessageFromError } from 'helpers/errors';

import { RemoveLedgerEntryAlertDialog } from 'components/modals';

import { hasLedgerEntryReversedEvent } from '../../../../internal';

import { useConnect } from './internal';

interface Props {
    parentEvent: AppEvent;
}

const ActivitySubeventsButtons = ({ parentEvent }: Props) => {
    const { t } = useTranslation(['activity', 'toasts']);
    const {
        reverseLedgerEntry,
        prepareExpenseEdit,
        initializeEdit,
        subevents,
        subeventsParent,
        isLoading,
        isEditing,
        isRemoving,
    } = useConnect();
    const parentEntryId = getActivityLedgerEntryId(parentEvent);
    const rootActivityId = parentEvent.parentActivityId ?? parentEvent.id;
    const isCurrentParentLoaded = subeventsParent?.id === rootActivityId;
    const isEntryReversed =
        isCurrentParentLoaded &&
        hasLedgerEntryReversedEvent(subevents);
    const isExpense = getActivityCategory(parentEvent) === ACTIVITY_CATEGORIES.EXPENSE;

    const onEdit = (): Promise<void> => {
        if (!parentEntryId || !isExpense) {
            return Promise.resolve();
        }

        return prepareExpenseEdit({
            entryId: parentEntryId,
            activityEvents: [parentEvent, ...subevents],
            parentActivityId: rootActivityId,
        })
            .then(initialization => {
                if (initialization) {
                    initializeEdit(initialization);
                }
            })
            .catch(error => {
                toast.error(resolveApiErrorMessageFromError(
                    error,
                    t('toasts:common.requestFailed'),
                ));
                return Promise.reject(error);
            });
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

    if (isLoading || !isCurrentParentLoaded) {
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
                disabled={!parentEntryId || !isExpense || isEditing}
                loading={isEditing}
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
