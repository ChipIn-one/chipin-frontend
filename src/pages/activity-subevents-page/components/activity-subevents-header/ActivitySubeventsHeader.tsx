import { LucideInfo } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
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

    return (
        <Box mb="4">
            <ActivityEvent event={parentEvent} isNavigable={false} />
        </Box>
    );
};

export { ActivitySubeventsHeader };
