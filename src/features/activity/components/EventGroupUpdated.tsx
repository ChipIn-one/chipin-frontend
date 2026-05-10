import { RelativeTime, UserAvatar } from 'basics';
import { LucideUserPen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import { AppEvent } from 'api/activity.types';

interface Props {
    event: Extract<AppEvent, { action: 'GROUP_UPDATED' }>;
}

const EventGroupUpdated = ({ event }: Props) => {
    const { t } = useTranslation('activity');
    //  TODO: add group emoji to metadata when available after api backend
    // TODO: add info what was changed in group to metadata when available after api backend
    return (
        <Card size="1" mb="2">
            <Flex justify="between" align="center" gap="3">
                <Flex gap="4" align="center">
                    <Avatar
                        size="3"
                        variant="soft"
                        color="blue"
                        fallback={<LucideUserPen size={20} />}
                    />
                    <Flex gap="2" align="center" minWidth="0">
                        <UserAvatar size="1" user={event.actorSnapshot} />

                        <Text size="3" as="p">
                            <Text size="3" as="span" weight="medium">
                                {event.actorSnapshot.displayName}
                            </Text>{' '}
                            <Text size="3" as="span" color="gray">
                                {t('event.groupUpdatedMiddleText')}
                            </Text>{' '}
                            <Text size="3" as="span" weight="medium">
                                {event.metadata.groupName}
                            </Text>
                        </Text>
                    </Flex>
                </Flex>

                <RelativeTime createdAt={event.createdAt} />
            </Flex>
        </Card>
    );
};

export default EventGroupUpdated;
