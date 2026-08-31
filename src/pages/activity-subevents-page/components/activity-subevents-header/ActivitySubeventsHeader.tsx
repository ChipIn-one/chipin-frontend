import { LucideInfo } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Flex, Text } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_CATEGORIES } from 'constants/activity';
import { getActivityCategory } from 'helpers/activityEvent';

import { EmptyState } from 'basics/empty-states';
import { ActivityEventSkeleton } from 'components/skeletons/activity-event-skeleton';
import { ActivityEvent } from 'features/activity';

interface Props {
    parentEvent?: AppEvent;
    isLoading: boolean;
    isUnavailable?: boolean;
}

const ActivitySubeventsHeader = ({
    parentEvent,
    isLoading,
    isUnavailable = false,
}: Props) => {
    const { t } = useTranslation('activity');

    if (isUnavailable) {
        return (
            <Box mb="4">
                <EmptyState
                    icon={<LucideInfo size={16} />}
                    iconColor="gray"
                    title={t('subeventsParentUnavailableTitle')}
                    description={t('subeventsParentUnavailableDescription')}
                />
            </Box>
        );
    }

    if (isLoading) {
        return (
            <Box mb="4">
                <ActivityEventSkeleton />
            </Box>
        );
    }

    if (!parentEvent) {
        return null;
    }

    const activityCategory = getActivityCategory(parentEvent);
    const title =
        activityCategory === ACTIVITY_CATEGORIES.SETTLEMENT
            ? t('subeventsSettlementHistoryTitle')
            : t('subeventsExpenseHistoryTitle');

    return (
        <Box mb="4">
            <Flex mb="2">
                <Text size="2" color="gray" weight="medium">
                    {title}
                </Text>
            </Flex>

            <ActivityEvent event={parentEvent} isNavigable={false} />
        </Box>
    );
};

export { ActivitySubeventsHeader };
