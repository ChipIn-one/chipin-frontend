import { useContext } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { ActivityEvent } from 'entities/activity';

import { UserAvatar } from 'basics';

import { FullActivityFeedContext } from './ActivityFeedContext';

import styles from './EventIcon.module.css';

type EventActor = Pick<ActivityEvent, 'actorSnapshot' | 'actorUserId'>;

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
        <UserAvatar
            className={styles.actorAvatar}
            size="1"
            user={event.actorSnapshot}
            decorative={isActorInText}
            alt={t('event.actorAvatarLabel', { actor: event.actorSnapshot.displayName })}
            data-testid="activity-actor-avatar"
        />
    );
};

interface EventActorInlineAvatarProps {
    event: Pick<ActivityEvent, 'actorSnapshot'>;
    // The event text names the actor: the avatar is decorative, so the name is not read twice.
    isActorInText?: boolean;
}

const EventActorInlineAvatar = ({ event, isActorInText = false }: EventActorInlineAvatarProps) => {
    const { t } = useTranslation('activity');
    const isFullActivityFeed = useContext(FullActivityFeedContext);

    if (isFullActivityFeed) {
        return null;
    }

    return (
        <UserAvatar
            size="1"
            user={event.actorSnapshot}
            decorative={isActorInText}
            alt={t('event.actorAvatarLabel', { actor: event.actorSnapshot.displayName })}
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
    <span className={styles.root}>
        {children}
        <ActorAvatar event={event} isActorInText={isActorInText} />
    </span>
);

export { EventActorInlineAvatar, EventIcon };
