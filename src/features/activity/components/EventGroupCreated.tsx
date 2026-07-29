import { RelativeTime, UserAvatar } from 'basics';
import { LucideUserRoundCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import type { GroupCreatedAction } from 'constants/activity';

interface Props {
    event: Extract<AppEvent, { action: GroupCreatedAction }>;
}

const EventGroupCreated = ({ event }: Props) => {
    const { t } = useTranslation('activity');

    return (
        <Card size="1" mb="2">
            <Flex justify="between" align="center" gap="3">
                <Flex gap="4" align="center">
                    <Avatar
                        size="4"
                        variant="soft"
                        color="green"
                        fallback={<LucideUserRoundCheck size={20} />}
                    />
                    <Flex gap="2" align="center" minWidth="0">
                        <UserAvatar size="1" user={event.actorSnapshot} />

                        <Text size="3" as="p">
                            <Text size="3" as="span" weight="medium">
                                {event.actorSnapshot.displayName}
                            </Text>{' '}
                            <Text size="3" as="span" color="gray">
                                {t('event.groupCreatedMiddleText')}
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

export default EventGroupCreated;
