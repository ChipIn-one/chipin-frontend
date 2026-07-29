import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useActivityStore } from 'store/activity-store';
import { useLoadingStore } from 'store/loadingStore';

import ActivitySubeventsPage from './ActivitySubeventsPage';

vi.mock('components/nav-bars', () => ({
    MobileNavBar: () => null,
}));

vi.mock('./components', () => ({
    ActivitySubeventsFeed: () => null,
    ActivitySubeventsHeader: ({
        isError,
        onRetry,
    }: {
        isError: boolean;
        onRetry: () => void;
    }) => (
        <>
            {isError ? <span data-testid="parent-load-error" /> : null}
            <button
                type="button"
                aria-label="retry-parent"
                onClick={onRetry}
            />
        </>
    ),
}));

test('retries loading the parent activity after a failed direct visit', () => {
    const user = userEvent.setup();
    const fetchSetSelectedEvent = vi
        .fn()
        .mockRejectedValue(new Error('Activity unavailable'));
    useActivityStore.setState({
        selectedEvent: null,
        fetchSetSelectedEvent,
    });
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

    return waitFor(() => {
        expect(screen.getByTestId('parent-load-error')).toBeTruthy();
    })
        .then(() => user.click(screen.getByRole('button', { name: 'retry-parent' })))
        .then(() => {
            expect(fetchSetSelectedEvent).toHaveBeenCalledTimes(2);
        });
});
