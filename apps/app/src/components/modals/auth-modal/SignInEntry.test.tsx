import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';

import { SignInEntry } from './SignInEntry';

vi.mock('assets/google-icon.svg?react', () => ({
    default: () => <svg aria-hidden="true" />,
}));

const pwa = vi.hoisted(() => ({ isInstalled: false }));

vi.mock('helpers/pwa', () => ({ checkIsPwaInstalled: () => pwa.isInstalled }));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const SIGN_IN = 'Sign in';

const stubHost = (hostname: string) => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, hostname, assign });
    return assign;
};

afterEach(() => {
    vi.unstubAllGlobals();
    pwa.isInstalled = false;
});

const renderEntry = () =>
    render(
        <SignInEntry>
            <button type="button">{SIGN_IN}</button>
        </SignInEntry>,
    );

// 04-4a2 (spec 04 §4.5 step 1): the legacy-host landing signs nobody in.
test.each([
    ['chipin.one', 'https://app.chipin.one/dashboard'],
    ['dev.chipin.one', 'https://app-dev.chipin.one/dashboard'],
])('on the legacy host %s the CTA opens %s instead of the auth modal', (hostname, target) => {
    const assign = stubHost(hostname);
    renderEntry();

    return userEvent
        .setup()
        .click(screen.getByRole('button', { name: SIGN_IN }))
        .then(() => {
            expect(assign).toHaveBeenCalledExactlyOnceWith(target);
            expect(screen.queryByRole('dialog')).toBeNull();
        });
});

test.each(['app.chipin.one', 'app-dev.chipin.one', 'chipin-git-x.vercel.app', 'localhost'])(
    'on %s the CTA opens the auth modal, as before',
    hostname => {
        const assign = stubHost(hostname);
        renderEntry();

        return userEvent
            .setup()
            .click(screen.getByRole('button', { name: SIGN_IN }))
            .then(() => {
                expect(assign).not.toHaveBeenCalled();
                expect(screen.getByRole('dialog', { name: 'modal.title' })).toBeTruthy();
            });
    },
);

test('prerenders the modal trigger whatever the host (no host on the server)', () => {
    stubHost('chipin.one');

    const html = renderToString(
        <SignInEntry>
            <button type="button">{SIGN_IN}</button>
        </SignInEntry>,
    );

    expect(html).toContain('aria-haspopup="dialog"');
});

// #758: in an icon installed from a legacy host the CTA would open the app host in an in-app sheet,
// so it is not rendered (the public routes show the notice instead).
test.each(['chipin.one', 'dev.chipin.one'])(
    'on the legacy host %s in standalone mode renders no CTA',
    hostname => {
        const assign = stubHost(hostname);
        pwa.isInstalled = true;
        renderEntry();

        expect(screen.queryByRole('button', { name: SIGN_IN })).toBeNull();
        expect(assign).not.toHaveBeenCalled();
    },
);

test.each(['app.chipin.one', 'app-dev.chipin.one', 'chipin-git-x.vercel.app', 'localhost'])(
    'on %s in standalone mode the CTA still opens the auth modal',
    hostname => {
        const assign = stubHost(hostname);
        pwa.isInstalled = true;
        renderEntry();

        return userEvent
            .setup()
            .click(screen.getByRole('button', { name: SIGN_IN }))
            .then(() => {
                expect(assign).not.toHaveBeenCalled();
                expect(screen.getByRole('dialog', { name: 'modal.title' })).toBeTruthy();
            });
    },
);

test('prerenders the modal trigger in standalone mode on a legacy host (no host on the server)', () => {
    stubHost('chipin.one');
    pwa.isInstalled = true;

    const html = renderToString(
        <SignInEntry>
            <button type="button">{SIGN_IN}</button>
        </SignInEntry>,
    );

    expect(html).toContain('aria-haspopup="dialog"');
});
