import { RelativeTime, UserAvatar } from 'basics';
import { LucideUserMinus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import { AppEvent } from 'api/activity.types';

interface Props {
    event: Extract<AppEvent, { action: 'MEMBER_LEFT' }>;
}

const EventMemberLeft = ({ event }: Props) => {
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
                        size="3"
                        variant="soft"
                        color="orange"
                        fallback={
                            groupEmoji ? <Text>{groupEmoji}</Text> : <LucideUserMinus size={20} />
                        }
                    />
                    <Flex gap="2" align="center" minWidth="0">
                        <UserAvatar
                            size="1"
                            src={event.actorSnapshot.picture}
                            fallback={event.actorSnapshot.displayName.charAt(0)}
                        />

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
