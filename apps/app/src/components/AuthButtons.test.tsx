import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { lightThemeStyled } from 'constants/styled-themes';
import { copyTextToClipboard } from 'helpers/clipboard';
import { buildAndroidChromeIntentUrl } from 'helpers/inAppBrowser';
import { checkIsPwaInstalled } from 'helpers/pwa';

import { AuthButtons } from './AuthButtons';

import 'i18n/index';

vi.mock('assets/google-icon.svg?react', () => ({
    default: () => <svg aria-hidden="true" />,
}));

vi.mock('helpers/pwa', () => ({ checkIsPwaInstalled: vi.fn(() => false) }));
vi.mock('helpers/clipboard', () => ({ copyTextToClipboard: vi.fn() }));

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.mocked(checkIsPwaInstalled).mockReset().mockReturnValue(false);
    vi.mocked(copyTextToClipboard).mockReset();
    window.history.replaceState(null, '', '/');
});

const renderAuthButtons = () =>
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <AuthButtons />
        </ThemeProvider>,
    );

test('keeps Google sign-in and hides the unfinished Apple sign-in button', () => {
    renderAuthButtons();

    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign in with Apple' })).toBeNull();
});

test('leaves for Google sign-in once and keeps the button busy while the page unloads', () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    renderAuthButtons();
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Sign in with Google' });

    expect(button.disabled).toBe(false);

    return user
        .click(button)
        .then(() => {
            expect(assign).toHaveBeenCalledOnce();
            expect(button.disabled).toBe(true);

            return user.click(button);
        })
        .then(() => {
            expect(assign).toHaveBeenCalledOnce();
        });
});

const IOS_INSTAGRAM_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 307.0.1.24.108 (iPhone14,5; iOS 17_1_2; en_US; en; scale=3.00; 1170x2532; 532277137)';
const ANDROID_FACEBOOK_UA =
    'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.5845.163 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/432.0.0.29.102;]';
const ANDROID_INSTAGRAM_UA =
    'Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 Instagram 309.0.0.40.113 Android (33/13; 480dpi; 1080x2115; samsung; SM-S918B; dm3q; qcom; en_US; 541635890)';
const ANDROID_WEBVIEW_UA =
    'Mozilla/5.0 (Linux; Android 5.1.1; Nexus 5 Build/LMY48B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/43.0.2357.65 Mobile Safari/537.36';
const IOS_SAFARI_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
const INVITE_PATH = '/join/abc123?token=inv-tok_9&utm_source=instagram';
const ANDROID_STEPS =
    /In the app menu \(⋮\), choose Open in Chrome, Open in browser or Open in external browser/;
const IOS_STEPS = /Open in browser, Open in external browser or Open in Safari/;

const mockUserAgent = (userAgent: string) => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent);
};

describe('AUTH-078 in-app browser notice', () => {
    test('is absent in a normal browser', () => {
        mockUserAgent(IOS_SAFARI_UA);
        renderAuthButtons();

        expect(screen.queryByText(/Google sign-in does not work/)).toBeNull();
        expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    });

    test('is absent in an installed PWA', () => {
        mockUserAgent(ANDROID_FACEBOOK_UA);
        vi.mocked(checkIsPwaInstalled).mockReturnValue(true);
        renderAuthButtons();

        expect(screen.queryByText(/Google sign-in does not work/)).toBeNull();
    });

    test('offers Open in Chrome with an intent URL of the current page on Android', () => {
        window.history.replaceState(null, '', INVITE_PATH);
        mockUserAgent(ANDROID_FACEBOOK_UA);
        renderAuthButtons();

        expect(screen.getByText(/Google sign-in does not work/)).toBeTruthy();
        const link = screen.getByRole('link', { name: 'Open in Chrome' });
        expect(link.getAttribute('href')).toBe(buildAndroidChromeIntentUrl(window.location.href));
        expect(link.getAttribute('href')).toContain(`${INVITE_PATH}#Intent;`);
        expect(screen.getByText(ANDROID_STEPS)).toBeTruthy();
        expect(screen.queryByText(IOS_STEPS)).toBeNull();
        expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
        // The Google button stays in case the detection was wrong.
        expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    });

    test('offers Open in Chrome and the Android menu steps in Instagram on Android', () => {
        mockUserAgent(ANDROID_INSTAGRAM_UA);
        renderAuthButtons();

        expect(screen.getByRole('link', { name: 'Open in Chrome' })).toBeTruthy();
        expect(screen.getByText(ANDROID_STEPS)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
    });

    test('shows only the Android menu steps and Copy link in a generic Android WebView', () => {
        mockUserAgent(ANDROID_WEBVIEW_UA);
        renderAuthButtons();

        expect(screen.getByText(/Google sign-in does not work/)).toBeTruthy();
        expect(screen.queryByRole('link', { name: 'Open in Chrome' })).toBeNull();
        expect(screen.getByText(ANDROID_STEPS)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
    });

    test('detects the Telegram webview from window.TelegramWebviewProxy with a Safari user agent', () => {
        mockUserAgent(IOS_SAFARI_UA);
        Object.defineProperty(window, 'TelegramWebviewProxy', { value: {}, configurable: true });

        try {
            renderAuthButtons();

            expect(screen.getByText(/Google sign-in does not work/)).toBeTruthy();
            expect(screen.getByText(IOS_STEPS)).toBeTruthy();
        } finally {
            Reflect.deleteProperty(window, 'TelegramWebviewProxy');
        }
        expect('TelegramWebviewProxy' in window).toBe(false);
    });

    test('shows the app-menu steps and Copy link on iOS', () => {
        mockUserAgent(IOS_INSTAGRAM_UA);
        renderAuthButtons();

        expect(screen.getByText(/Google sign-in does not work/)).toBeTruthy();
        expect(screen.getByText(IOS_STEPS)).toBeTruthy();
        expect(screen.queryByText(ANDROID_STEPS)).toBeNull();
        expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
        expect(screen.queryByRole('link', { name: 'Open in Chrome' })).toBeNull();
    });

    test('confirms a copied link', async () => {
        const user = userEvent.setup();
        window.history.replaceState(null, '', INVITE_PATH);
        mockUserAgent(IOS_INSTAGRAM_UA);
        vi.mocked(copyTextToClipboard).mockResolvedValue('copied');
        renderAuthButtons();

        await user.click(screen.getByRole('button', { name: 'Copy link' }));

        expect(copyTextToClipboard).toHaveBeenCalledWith(window.location.href);
        expect(await screen.findByText(/Link copied/)).toBeTruthy();
        expect(screen.queryByRole('group', { name: 'Link to this page' })).toBeNull();
    });

    test.each([
        ['the clipboard is unsupported', () => Promise.resolve('unsupported' as const)],
        ['the copy rejects', () => Promise.reject(new Error('denied'))],
    ])('shows the full URL as selectable text to copy by hand when %s', async (_, copy) => {
        const user = userEvent.setup();
        window.history.replaceState(null, '', INVITE_PATH);
        mockUserAgent(IOS_INSTAGRAM_UA);
        vi.mocked(copyTextToClipboard).mockImplementation(copy);
        renderAuthButtons();

        await user.click(screen.getByRole('button', { name: 'Copy link' }));

        expect(await screen.findByText(/Could not copy the link/)).toBeTruthy();
        const address = screen.getByRole('group', { name: 'Link to this page' });
        expect(within(address).getByText(window.location.href).tagName).toBe('CODE');
        expect(window.location.href).toContain(INVITE_PATH);
        expect(screen.queryByRole('textbox')).toBeNull();
    });

    test('announces a repeated copy failure again', async () => {
        const user = userEvent.setup();
        mockUserAgent(IOS_INSTAGRAM_UA);
        vi.mocked(copyTextToClipboard).mockResolvedValue('unsupported');
        renderAuthButtons();

        await user.click(screen.getByRole('button', { name: 'Copy link' }));
        expect(await screen.findByText(/Could not copy the link/)).toBeTruthy();

        let resolveCopy: (value: 'unsupported') => void = () => undefined;
        vi.mocked(copyTextToClipboard).mockReturnValue(
            new Promise(resolve => {
                resolveCopy = resolve;
            }),
        );
        await user.click(screen.getByRole('button', { name: 'Copy link' }));
        // The live region is cleared while the copy runs, so the same result is spoken again.
        expect(screen.queryByText(/Could not copy the link/)).toBeNull();

        resolveCopy('unsupported');
        expect(await screen.findByText(/Could not copy the link/)).toBeTruthy();
    });
});
