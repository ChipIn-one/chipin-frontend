import type { ReactNode } from 'react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import type { AppEvent } from 'api/activity.types';

import { UserAvatar } from 'basics';

import { FullActivityFeedContext } from './ActivityFeedContext';

const EventIconContainer = styled.span`
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    line-height: 0;
`;

const ActorAvatarImage = styled(UserAvatar)`
    position: absolute;
    right: -7px;
    bottom: -7px;
    width: 24px;
    height: 24px;
    pointer-events: none;
    box-shadow: 0 0 0 2px var(--gray-1);
`;

type EventActor = Pick<AppEvent, 'actorSnapshot' | 'actorUserId'>;

interface ActorAvatarProps {
    event: EventActor;
    isActorInText: boolean;
}

const ActorAvatar = ({ event, isActorInText }: ActorAvatarProps) => {
    const { t } = useTranslation('activity');
    const isFullActivityFeed = useContext(FullActivityFeedContext);

    if (!isFullActivityFeed || !event.actorUserId) {
        return null;
    }

    return (
        <ActorAvatarImage
            size="1"
            user={event.actorSnapshot}
            role={isActorInText ? undefined : 'img'}
            aria-hidden={isActorInText || undefined}
            aria-label={
                isActorInText
                    ? undefined
                    : t('event.actorAvatarLabel', {
                          actor: event.actorSnapshot.displayName,
                      })
            }
            data-testid="activity-actor-avatar"
        />
    );
};

interface EventActorInlineAvatarProps {
    event: Pick<AppEvent, 'actorSnapshot'>;
}

const EventActorInlineAvatar = ({ event }: EventActorInlineAvatarProps) => {
    const isFullActivityFeed = useContext(FullActivityFeedContext);

    if (isFullActivityFeed) {
        return null;
    }

    return (
        <UserAvatar
            size="1"
            user={event.actorSnapshot}
            data-testid="activity-inline-actor-avatar"
        />
    );
};

interface Props {
    event: EventActor;
    children: ReactNode;
    isActorInText?: boolean;
}

const EventIcon = ({ event, children, isActorInText = false }: Props) => (
    <EventIconContainer>
        {children}
        <ActorAvatar event={event} isActorInText={isActorInText} />
    </EventIconContainer>
);

export { EventActorInlineAvatar, EventIcon };
