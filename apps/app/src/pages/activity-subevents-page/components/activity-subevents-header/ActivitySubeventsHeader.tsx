import { PROP_COLOR } from '@chipin/tokens/theme';
import { Box } from '@radix-ui/themes';
import { InfoIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ActivityEvent as ActivityEventModel } from 'entities/activity';
import { ActivityEvent } from 'features/activity';

import { EmptyState } from 'basics/empty-states';
import { ActivityEventSkeleton } from 'components/skeletons/activity-event-skeleton';

interface Props {
    parentEvent?: ActivityEventModel;
    isLoading: boolean;
    isUnavailable?: boolean;
}

const ActivitySubeventsHeader = ({ parentEvent, isLoading, isUnavailable = false }: Props) => {
    const { t } = useTranslation('activity');

    if (isUnavailable) {
        return (
            <Box mb="4">
                <EmptyState
                    icon={<InfoIcon size={20} />}
                    iconColor={PROP_COLOR.neutral}
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
