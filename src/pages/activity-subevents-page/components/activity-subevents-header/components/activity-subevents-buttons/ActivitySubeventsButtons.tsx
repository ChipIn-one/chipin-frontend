import { LucidePencil, LucideTrash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { Button, Flex, Skeleton } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import { getActivityCategory, getActivityLedgerEntryId } from 'helpers/activityEvent';
import { useActivityStore } from 'store/activity-store';
import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { selectActivitySubeventsLoading, selectLedgerEntryRemoving } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import { RemoveLedgerEntryAlertDialog } from 'components/modals';

import { hasLedgerEntryReversedEvent } from '../../../../internal';

interface Props {
    parentEvent: AppEvent;
}

const ActivitySubeventsButtons = ({ parentEvent }: Props) => {
    const { t } = useTranslation('activity');
    const {
        subevents,
        subeventsParentId,
        fetchSetActivity,
        fetchSetActivitySubevents,
        removeLedgerEntry,
    } =
        useActivityStore(
            useShallow(state => ({
                subevents: state.subevents,
                subeventsParentId: state.subeventsParentId,
                fetchSetActivity: state.fetchSetActivity,
                fetchSetActivitySubevents: state.fetchSetActivitySubevents,
                removeLedgerEntry: state.removeLedgerEntry,
            })),
        );
    const fetchSetDashboardData = useDashboardStore(
        state => state.fetchSetDashboardData,
    );
    const fetchSetGroups = useGroupsStore(state => state.fetchSetGroups);
    const fetchSetFriends = useUsersStore(state => state.fetchSetFriends);
    const isLoading = useLoadingStore(selectActivitySubeventsLoading);
    const isRemoving = useLoadingStore(selectLedgerEntryRemoving);
    const parentEntryId = getActivityLedgerEntryId(parentEvent);
    const activityCategory = getActivityCategory(parentEvent);
    const isCurrentParentLoaded = subeventsParentId === parentEvent.id;
    const isEntryReversed =
        isCurrentParentLoaded &&
        hasLedgerEntryReversedEvent(subevents);

    const onRemove = (): Promise<void> => {
        if (!parentEntryId) {
            return Promise.reject(new Error('No ledger entry found to remove'));
        }

        return removeLedgerEntry(parentEntryId)
            .then(() => {
                toast.success(t('toasts:ledger.entryDeleted'));
                void fetchSetActivitySubevents({
                    parentActivityId: parentEvent.id,
                    category: activityCategory,
                }).catch(() => undefined);
                void fetchSetActivity();
                fetchSetDashboardData();
                void fetchSetGroups().catch(() => undefined);
                void fetchSetFriends().catch(() => undefined);
            })
            .catch(error => {
                toast.error(t('toasts:ledger.entryDeleteError'));
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
            <Button size="1" variant="soft" disabled>
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
