import { RelativeTime } from 'basics';
import { LucideUserPen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import type { GroupUpdatedAction } from 'constants/activity';

import { EventActorInlineAvatar, EventIcon } from './activity-event';

interface Props {
    event: Extract<AppEvent, { action: GroupUpdatedAction }>;
}

const EventGroupUpdated = ({ event }: Props) => {
    const { t } = useTranslation('activity');
    // TODO: add info what was changed in group to metadata when available after api backend
    return (
        <Card size="1" mb="2">
            <Flex justify="between" align="center" gap="3">
                <Flex gap="4" align="center">
                    <EventIcon event={event} isActorInText>
                        <Avatar
                            size="4"
                            variant="soft"
                            color="blue"
                            fallback={<LucideUserPen size={20} />}
                        />
                    </EventIcon>
                    <Flex gap="2" align="center" minWidth="0">
                        <EventActorInlineAvatar event={event} />

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
