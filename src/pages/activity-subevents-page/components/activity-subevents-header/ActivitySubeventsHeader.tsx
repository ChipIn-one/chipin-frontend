import { LucideCircleAlert, LucideRefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Button, Flex, Text } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_CATEGORIES } from 'constants/activity';
import { getActivityCategory } from 'helpers/activityEvent';

import { EmptyState } from 'basics/empty-states';
import { ActivityEventSkeleton } from 'components/skeletons/activity-event-skeleton';
import { ActivityEvent } from 'features/activity';

import { ActivitySubeventsButtons } from './components';

interface Props {
    parentEvent?: AppEvent;
    isLoading: boolean;
    isError?: boolean;
    onRetry?: () => void;
}

const ActivitySubeventsHeader = ({
    parentEvent,
    isLoading,
    isError = false,
    onRetry,
}: Props) => {
    const { t } = useTranslation('activity');

    if (isError) {
        return (
            <Box mb="4">
                <EmptyState
                    icon={<LucideCircleAlert size={16} />}
                    iconColor="red"
                    title={t('subeventsParentLoadErrorTitle')}
                    description={t('subeventsParentLoadErrorDescription')}
                    action={
                        onRetry ? (
                            <Button
                                type="button"
                                size="1"
                                variant="soft"
                                onClick={onRetry}
                            >
                                <LucideRefreshCw size={14} />
                                {t('retryAction')}
                            </Button>
                        ) : undefined
                    }
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
            <Flex
                justify="between"
                align={{ initial: 'start', sm: 'center' }}
                gap="3"
                mb="2"
                direction={{ initial: 'column', sm: 'row' }}
            >
                <Text size="2" color="gray" weight="medium">
                    {title}
                </Text>

                <ActivitySubeventsButtons parentEvent={parentEvent} />
            </Flex>

            <ActivityEvent event={parentEvent} isNavigable={false} />
        </Box>
    );
};

export { ActivitySubeventsHeader };
