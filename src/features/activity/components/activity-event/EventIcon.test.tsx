import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { AppEvent } from 'api/activity.types';

import { FullActivityFeedContext } from './ActivityFeedContext';
import { EventActorInlineAvatar, EventIcon } from './EventIcon';

vi.mock('basics', () => ({
    UserAvatar: ({
        className,
        user,
        role,
        'aria-hidden': ariaHidden,
        'aria-label': ariaLabel,
        'data-testid': testId,
    }: {
        className?: string;
        user?: { displayName: string; picture?: string | null };
        role?: string;
        'aria-hidden'?: boolean;
        'aria-label'?: string;
        'data-testid'?: string;
    }) => (
        <span
            className={className}
            data-picture={user?.picture ?? ''}
            data-testid={testId}
            role={role}
            aria-hidden={ariaHidden}
            aria-label={ariaLabel}
        >
            {user?.displayName.charAt(0)}
        </span>
    ),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: { actor?: string }) =>
            key === 'event.actorAvatarLabel'
                ? `Performed by ${params?.actor}`
                : key,
    }),
}));

type EventForIcon = Pick<AppEvent, 'actorSnapshot' | 'actorUserId'>;

const eventWithActor: EventForIcon = {
    actorUserId: 'actor-1',
    actorSnapshot: {
        displayName: 'Misha',
        picture: 'https://example.com/avatar.jpg',
    },
};

const renderIcon = (
    event: EventForIcon,
    isFullActivityFeed = true,
    isActorInText = false,
): void => {
    const eventIcon: ReactNode = <span data-testid="event-icon" />;

    render(
        <FullActivityFeedContext.Provider value={isFullActivityFeed}>
            <EventIcon event={event} isActorInText={isActorInText}>
                {eventIcon}
            </EventIcon>
        </FullActivityFeedContext.Provider>,
    );
};

test('shows the actor image badge in the full activity feed', () => {
    renderIcon(eventWithActor);

    expect(screen.getByTestId('event-icon')).toBeTruthy();
    expect(screen.getByTestId('activity-actor-avatar').dataset.picture).toBe(
        'https://example.com/avatar.jpg',
    );
});

test('uses the standard actor fallback when the actor has no image', () => {
    renderIcon({
        ...eventWithActor,
        actorSnapshot: {
            displayName: 'Misha',
            picture: null,
        },
    });

    expect(screen.getByTestId('activity-actor-avatar').textContent).toBe('M');
});

test('does not render an actor badge for a system or no-actor event', () => {
    renderIcon({
        ...eventWithActor,
        actorUserId: null,
        actorSnapshot: {
            displayName: 'System',
            picture: null,
        },
    });

    expect(screen.queryByTestId('activity-actor-avatar')).toBeNull();
});

test('does not render the actor badge for compact activity consumers', () => {
    renderIcon(eventWithActor, false);

    expect(screen.queryByTestId('activity-actor-avatar')).toBeNull();
});

test('renders the actor badge at 24px with reduced icon overlap', () => {
    renderIcon(eventWithActor);

    const actorAvatar = screen.getByTestId('activity-actor-avatar');
    const style = getComputedStyle(actorAvatar);

    expect(style.width).toBe('24px');
    expect(style.height).toBe('24px');
    expect(style.right).toBe('-7px');
    expect(style.bottom).toBe('-7px');
});

test('exposes actor identity when event text does not identify the actor', () => {
    renderIcon(eventWithActor);

    expect(
        screen.getByRole('img', { name: 'Performed by Misha' }),
    ).toBeTruthy();
});

test('hides redundant actor identity only when the renderer marks it as visible', () => {
    renderIcon(eventWithActor, true, true);

    const actorAvatar = screen.getByTestId('activity-actor-avatar');

    expect(actorAvatar.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('img', { name: 'Performed by Misha' })).toBeNull();
});

test('hides the existing inline actor avatar in the full activity feed', () => {
    render(
        <FullActivityFeedContext.Provider value>
            <EventActorInlineAvatar event={eventWithActor} />
        </FullActivityFeedContext.Provider>,
    );

    expect(screen.queryByTestId('activity-inline-actor-avatar')).toBeNull();
});

test('keeps the existing inline actor avatar in compact activity consumers', () => {
    render(<EventActorInlineAvatar event={eventWithActor} />);

    expect(screen.getByTestId('activity-inline-actor-avatar').textContent).toBe('M');
});
