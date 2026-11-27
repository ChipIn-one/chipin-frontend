import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';

import { SignInEntry } from './SignInEntry';

vi.mock('assets/google-icon.svg?react', () => ({
    default: () => <svg aria-hidden="true" />,
}));

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
});

const renderEntry = () =>
    render(
        <SignInEntry>
            <button type="button">{SIGN_IN}</button>
        </SignInEntry>,
    );

test.each(['app.chipin.one', 'app-dev.chipin.one', 'chipin-git-x.vercel.app', 'localhost'])(
    'on %s the CTA opens the auth modal',
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

test('prerenders the modal trigger', () => {
    const html = renderToString(
        <SignInEntry>
            <button type="button">{SIGN_IN}</button>
        </SignInEntry>,
    );

    expect(html).toContain('aria-haspopup="dialog"');
});
