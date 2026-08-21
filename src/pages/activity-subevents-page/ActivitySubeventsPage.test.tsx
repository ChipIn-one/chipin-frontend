import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { useActivityStore } from 'store/activity-store';
import { useLoadingStore } from 'store/loadingStore';

import ActivitySubeventsPage from './ActivitySubeventsPage';

vi.mock('components/nav-bars', () => ({
    MobileNavBar: () => null,
}));

vi.mock('./components', () => ({
    ActivitySubeventsFeed: () => <span data-testid="subevents-feed" />,
    ActivitySubeventsHeader: ({
        isUnavailable,
    }: {
        isUnavailable: boolean;
    }) => (
        isUnavailable ? <span data-testid="parent-unavailable" /> : null
    ),
}));

test('shows a parent fallback and still loads children on a direct visit', () => {
    useActivityStore.setState({ subeventsParent: null });
    useLoadingStore.getState().setInitialLoadingStore();

    render(
        <MemoryRouter initialEntries={['/activity/activity-1']}>
            <Routes>
                <Route
                    path="/activity/:parentActivityId"
                    element={<ActivitySubeventsPage />}
                />
            </Routes>
        </MemoryRouter>,
    );

    expect(screen.getByTestId('parent-unavailable')).toBeTruthy();
    expect(screen.getByTestId('subevents-feed')).toBeTruthy();
});
