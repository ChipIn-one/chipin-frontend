import { RelativeTime, UserAvatar } from 'basics';
import { LucideUserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import type { MemberJoinedAction } from 'constants/activity';

interface EventMemberJoinProps {
    event: Extract<AppEvent, { action: MemberJoinedAction }>;
}

const EventMemberJoin = ({ event }: EventMemberJoinProps) => {
    const { t } = useTranslation('activity');
    const targetUserDisplayName =
        event.metadata.targetUserDisplayName || event.actorSnapshot.displayName;
    const groupName = event.metadata.groupName;
    const groupEmoji = event.metadata.groupEmoji;
    // TODO: add group emoji to metadata when available after api backend
    return (
        <Card size="1" mb="2">
            <Flex justify="between" align="center" gap="3">
                <Flex gap="4" align="center">
                    <Avatar
                        size="4"
                        variant="soft"
                        color="cyan"
                        fallback={
                            groupEmoji ? <Text>{groupEmoji}</Text> : <LucideUserPlus size={20} />
                        }
                    />
                    <Flex gap="2" align="center" minWidth="0">
                        <UserAvatar size="1" user={event.actorSnapshot} />

                        <Text size="3" as="p">
                            <Text size="3" as="span" weight="medium">
                                {targetUserDisplayName}
                            </Text>{' '}
                            <Text size="3" as="span" color="gray">
                                {t('event.memberJoinedMiddleText')}
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

export default EventMemberJoin;
