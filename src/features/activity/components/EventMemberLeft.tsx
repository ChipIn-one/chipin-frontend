import { RelativeTime } from 'basics';
import { LucideUserMinus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import type { MemberLeftAction } from 'constants/activity';

import { EventActorInlineAvatar, EventIcon } from './activity-event';

interface Props {
    event: Extract<AppEvent, { action: MemberLeftAction }>;
}

const EventMemberLeft = ({ event }: Props) => {
    const { t } = useTranslation('activity');
    const targetUserDisplayName =
        event.metadata.targetUserDisplayName || event.actorSnapshot.displayName;
    const groupName = event.metadata.groupName;
    const isActorInText = targetUserDisplayName === event.actorSnapshot.displayName;

    return (
        <Card size="1" mb="2">
            <Flex justify="between" align="center" gap="3">
                <Flex gap="4" align="center">
                    <EventIcon event={event} isActorInText={isActorInText}>
                        <Avatar
                            size="4"
                            variant="soft"
                            color="orange"
                            fallback={<LucideUserMinus size={20} />}
                        />
                    </EventIcon>
                    <Flex gap="2" align="center" minWidth="0">
                        <EventActorInlineAvatar event={event} />

                        <Text size="3" as="p">
                            <Text size="3" as="span" weight="medium">
                                {targetUserDisplayName}
                            </Text>{' '}
                            <Text size="3" as="span" color="gray">
                                {t('event.memberLeftMiddleText')}
                            </Text>{' '}
                            <Text size="3" as="span" weight="medium">
                                {groupName}
                            </Text>
                        </Text>
                    </Flex>
                </Flex>

                <RelativeTime createdAt={event.createdAt} />
            </Flex>
        </Card>
    );
};

export default EventMemberLeft;
