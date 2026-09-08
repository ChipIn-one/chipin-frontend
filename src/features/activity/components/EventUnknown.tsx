import { RelativeTime } from 'basics';
import { LucideAlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import { AppEvent } from 'api/activity.types';

interface EventUnknownProps {
    event: AppEvent;
}

const EventUnknown = ({ event }: EventUnknownProps) => {
    const { t } = useTranslation('activity');
    const eventType = [event.domain, event.action].join('_');

    return (
        <Card size="1" mb="2">
            <Flex justify="between" align="center" gap="3">
                <Flex gap="4" align="center">
                    <Avatar
                        size="4"
                        variant="soft"
                        color="amber"
                        fallback={<LucideAlertTriangle size={20} />}
                    />
                    <Flex gap="1" direction="column">
                        <Text size="3" as="span" weight="medium">
                            {eventType}
                        </Text>
                        <Text size="2" as="span" color="gray">
                            {t('event.unknownDescription')}
                        </Text>
                    </Flex>
                </Flex>

                <RelativeTime createdAt={event.createdAt} />
            </Flex>
        </Card>
    );
};

export default EventUnknown;
