import { Avatar, Card, Flex, Text } from '@radix-ui/themes';
import { UserRoundXIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { GroupActivityEvent } from 'entities/activity';
import { isUserTime24H } from 'entities/users';
import { useUserSetting } from 'hooks/useSelfUser';

import { RelativeTime } from 'basics';

import { EventActorInlineAvatar, EventIcon } from './activity-event';

interface Props {
    event: GroupActivityEvent;
}

const EventGroupDeleted = ({ event }: Props) => {
    const isTime24H = useUserSetting(isUserTime24H);
    const { t } = useTranslation('activity');

    return (
        <Card size="1" mb="2">
            <Flex justify="between" align="center" gap="3">
                <Flex gap="4" align="center">
                    <EventIcon event={event} isActorInText>
                        <Avatar
                            size="4"
                            variant="soft"
                            color="red"
                            fallback={<UserRoundXIcon size={20} />}
                        />
                    </EventIcon>
                    <Flex gap="2" align="center" minWidth="0">
                        <EventActorInlineAvatar event={event} />

                        <Text size="3" as="p">
                            <Text size="3" as="span" weight="medium">
                                {event.actorSnapshot.displayName}
                            </Text>{' '}
                            <Text size="3" as="span" color="gray">
                                {t('event.groupDeletedMiddleText')}
                            </Text>{' '}
                            <Text size="3" as="span" weight="medium">
                                {event.metadata.groupName}
                            </Text>
                        </Text>
                    </Flex>
                </Flex>

                <RelativeTime createdAt={event.createdAt} isTime24H={isTime24H} />
            </Flex>
        </Card>
    );
};

export default EventGroupDeleted;
