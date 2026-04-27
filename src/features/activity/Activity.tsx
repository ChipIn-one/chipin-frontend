import { useTranslation } from 'react-i18next';

import { Card, Flex, Text } from '@radix-ui/themes';

import { useActivityStore } from 'store/activityStore';
import { selectDashboardLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import ActivityHeader, { ActivityHeaderContext } from './ActivityHeader';
import { EventUnknown, renderSpecialEvent } from './components';

interface ActivityProps {
    context?: ActivityHeaderContext;
}

const Activity = ({ context = 'dashboard' }: ActivityProps) => {
    const { t } = useTranslation('activity');
    const activity = useActivityStore(state => state.items);
    const isLoading = useLoadingStore(selectDashboardLoading);

    const shouldShowHeader = context !== 'group';

    return (
        <>
            {shouldShowHeader ? <ActivityHeader isLoading={isLoading} context={context} /> : null}

            {!isLoading && activity.length === 0 ? (
                <Card size="2">
                    <Flex direction="column" gap="1">
                        <Text size="4" weight="medium" as="p">
                            {t('emptyTitle')}
                        </Text>
                        <Text size="2" color="gray" as="p">
                            {t('emptyDescription')}
                        </Text>
                    </Flex>
                </Card>
            ) : (
                activity.map(event => {
                    const specialEvent = renderSpecialEvent(event);

                    if (specialEvent) {
                        return specialEvent;
                    }

                    return <EventUnknown key={event.id} event={event} />;
                })
            )}
        </>
    );
};

export default Activity;
