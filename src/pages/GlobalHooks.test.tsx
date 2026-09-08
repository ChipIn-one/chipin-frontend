import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';

import GlobalHooks from './GlobalHooks';

vi.mock('hooks/pwaHooks', () => ({
    useCheckOnlineStatus: vi.fn(),
    useCheckPwa: vi.fn(),
}));

vi.mock('hooks/useAuthToasts', () => ({
    useAuthToasts: vi.fn(),
}));

vi.mock('hooks/useCheckSignIn', () => ({
    useCheckSignIn: vi.fn(),
}));

vi.mock('hooks/useRoutesMeta', () => ({
    useRoutesMeta: vi.fn(),
}));

vi.mock('hooks/useSyncAppMode', () => ({
    useSyncAppMode: vi.fn(),
}));

vi.mock('hooks/useSyncUserSettings', () => ({
    useSyncUserSettings: vi.fn(),
}));

const NavigationControls = () => {
    const navigate = useNavigate();

    return (
        <>
            <button
                type="button"
                aria-label="Activity"
                onClick={() => navigate('/activity')}
            />
            <button
                type="button"
                aria-label="Settings"
                onClick={() => navigate('/settings')}
            />
            <button type="button" aria-label="Back" onClick={() => navigate(-1)} />
            <button type="button" aria-label="Forward" onClick={() => navigate(1)} />
        </>
    );
};

const scrollToMock = vi.fn();

beforeEach(() => {
    vi.stubGlobal('scrollTo', scrollToMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    scrollToMock.mockClear();
});

test('scrolls to the page top when navigating to another route or the current route', () => {
    render(
        <MemoryRouter initialEntries={['/activity']}>
            <GlobalHooks />
            <NavigationControls />
        </MemoryRouter>,
    );
    scrollToMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Activity' }));
    expect(scrollToMock).toHaveBeenLastCalledWith(0, 0);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(scrollToMock).toHaveBeenCalledTimes(2);
    expect(scrollToMock).toHaveBeenLastCalledWith(0, 0);
});

test('scrolls to the page top when navigating backward or forward', () => {
    render(
        <MemoryRouter initialEntries={['/activity', '/settings']} initialIndex={1}>
            <GlobalHooks />
            <NavigationControls />
        </MemoryRouter>,
    );
    scrollToMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(scrollToMock).toHaveBeenLastCalledWith(0, 0);

    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    expect(scrollToMock).toHaveBeenCalledTimes(2);
    expect(scrollToMock).toHaveBeenLastCalledWith(0, 0);
});
