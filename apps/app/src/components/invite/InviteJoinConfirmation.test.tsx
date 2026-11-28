import { Theme } from '@radix-ui/themes';
import { onlineManager } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { MEDIA_QUERIES } from 'constants/breakpoints';
import type { InviteConfirmationStatus } from 'hooks/useInviteConfirmation';

import { InviteJoinConfirmation, type InviteJoinVariant } from './InviteJoinConfirmation';

import 'i18n/index';

const LABELS = {
    title: 'Join this group?',
    description: 'Members will see your name.',
    confirmLabel: 'Join',
    cancelLabel: 'Cancel',
    retryLabel: 'Try again',
    invalidTitle: 'Link not valid',
    invalidDescription: 'Ask for a new link.',
    goHomeLabel: 'Go to home',
};

// jsdom has no `matchMedia`: without it the hook reads the desktop (card) layout.
const emulatePhone = () => {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: (query: string) => ({
            matches: query === MEDIA_QUERIES.belowSm,
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        }),
    });
};

afterEach(() => {
    Reflect.deleteProperty(window, 'matchMedia');
});

const renderConfirmation = ({
    status = 'ready',
    variant = 'group',
    errorMessage,
}: {
    status?: InviteConfirmationStatus;
    variant?: InviteJoinVariant;
    errorMessage?: string;
} = {}) =>
    render(
        <Theme>
            <InviteJoinConfirmation
                {...LABELS}
                variant={variant}
                status={status}
                errorMessage={errorMessage}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        </Theme>,
    );

const layout = (container: HTMLElement) =>
    container.querySelector('[data-invite-join-layout]')?.getAttribute('data-invite-join-layout');
const actions = (container: HTMLElement) => {
    const element = container.querySelector('[data-invite-join-actions]');
    if (!(element instanceof HTMLElement)) {
        throw new Error('No actions row');
    }
    return element;
};
const buttonNames = () => screen.getAllByRole('button').map(button => button.textContent);

test('#971 on a phone the screen has no card, full-size actions and the primary on top', () => {
    emulatePhone();

    const { container } = renderConfirmation();

    expect(layout(container)).toBe('phone');
    expect(container.querySelector('.rt-Card')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: LABELS.title })).toBeTruthy();
    // The DOM keeps Cancel before Join; the reversed column shows Join above Cancel.
    expect(buttonNames()).toEqual([LABELS.cancelLabel, LABELS.confirmLabel]);
    expect(actions(container).classList.contains('rt-r-fd-column-reverse')).toBe(true);
    for (const button of screen.getAllByRole('button')) {
        expect(button.classList.contains('rt-r-size-3')).toBe(true);
    }
});

test('#971 from sm the screen keeps the card with Cancel, then Join at the end', () => {
    const { container } = renderConfirmation();

    expect(layout(container)).toBe('card');
    expect(container.querySelector('.rt-Card')).not.toBeNull();
    expect(buttonNames()).toEqual([LABELS.cancelLabel, LABELS.confirmLabel]);
    expect(actions(container).classList.contains('rt-r-fd-row')).toBe(true);
    for (const button of screen.getAllByRole('button')) {
        expect(button.classList.contains('rt-r-size-2')).toBe(true);
    }
});

test.each([
    ['group', 'ready', 'green'],
    ['friend', 'ready', 'cyan'],
    ['group', 'invalid', 'gray'],
    ['friend', 'invalid', 'gray'],
] as const)(
    '#971 a %s invite in the %s state has a decorative %s icon tile',
    (variant, status, color) => {
        const { container } = renderConfirmation({ variant, status });

        const tile = container.querySelector('.rt-AvatarRoot');
        expect(tile?.closest('[aria-hidden="true"]')).not.toBeNull();
        expect(tile?.getAttribute('data-accent-color')).toBe(color);
    },
);

test('#971 the invalid state explains what to do and offers only Go to home', () => {
    emulatePhone();

    renderConfirmation({ status: 'invalid' });

    expect(screen.getByRole('heading', { level: 1, name: LABELS.invalidTitle })).toBeTruthy();
    expect(screen.getByText(LABELS.invalidDescription)).toBeTruthy();
    expect(screen.queryByText(LABELS.description)).toBeNull();
    expect(buttonNames()).toEqual([LABELS.goHomeLabel]);
});

test('the error state keeps the alert, Go to home and Retry', () => {
    renderConfirmation({ status: 'error', errorMessage: 'Could not join' });

    expect(screen.getByRole('alert').textContent).toBe('Could not join');
    expect(buttonNames()).toEqual([LABELS.goHomeLabel, LABELS.retryLabel]);
});

test('#971 offline on a phone the blocked Join stays full width above Cancel', () => {
    emulatePhone();
    onlineManager.setOnline(false);

    try {
        renderConfirmation();

        const join = screen.getByRole('button', { name: LABELS.confirmLabel });
        expect(join.hasAttribute('disabled')).toBe(true);
        const blockedWrapper = join.closest('[data-online-only]');
        expect(blockedWrapper instanceof HTMLElement && blockedWrapper.style.width).toBe('100%');
        expect(join.style.getPropertyValue('--width')).toBe('100%');
        expect(screen.getByRole('button', { name: LABELS.cancelLabel })).toBeTruthy();
    } finally {
        onlineManager.setOnline(true);
    }
});

test.each([
    ['phone', true, { tile: '5', heading: '6', text: '3' }],
    ['sm and up', false, { tile: '4', heading: '5', text: '2' }],
] as const)(
    '#971 on %s the tile, title, description and error have their sizes',
    (_name, isPhone, sizes) => {
        if (isPhone) {
            emulatePhone();
        }

        const { container } = renderConfirmation({
            status: 'error',
            errorMessage: 'Could not join',
        });

        const hasSize = (element: Element | null, size: string) =>
            element?.classList.contains(`rt-r-size-${size}`);
        expect(hasSize(container.querySelector('.rt-AvatarRoot'), sizes.tile)).toBe(true);
        expect(hasSize(screen.getByRole('heading', { level: 1 }), sizes.heading)).toBe(true);
        expect(hasSize(screen.getByText(LABELS.description), sizes.text)).toBe(true);
        const error = screen.getByRole('alert');
        expect(hasSize(error, sizes.text)).toBe(true);
        expect(error.getAttribute('data-accent-color')).toBe('red');
    },
);
