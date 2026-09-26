import { beforeEach, expect, test, vi } from 'vitest';

import * as statsApi from 'api/statsApi';

import { useLoadingStore } from '../loadingStore';

import { useLandingStatsStore } from './actions';

vi.mock('api/statsApi', () => ({
    fetchStats: vi.fn(),
}));

const stats = {
    usersCount: 51_234,
    groupsCount: 16_789,
    expensesCount: 25_345_678,
    settlementsCount: 321_987,
};

beforeEach(() => {
    vi.clearAllMocks();
    useLandingStatsStore.getState().setInitialLandingStatsStore();
});

test('sets loading immediately and stores every fetched statistic', () => {
    let resolveStats: ((value: typeof stats) => void) | undefined;
    const response = new Promise<typeof stats>(resolve => {
        resolveStats = resolve;
    });

    vi.mocked(statsApi.fetchStats).mockReturnValue(response);

    const request = useLandingStatsStore.getState().fetchSetStats();

    expect(useLandingStatsStore.getState().stats).toBeNull();
    expect(useLoadingStore.getState().landing.stats).toBe('loading');

    resolveStats?.(stats);

    return request.then(() => {
        expect(useLandingStatsStore.getState().stats).toEqual({
            usersCount: 51_234,
            groupsCount: 16_789,
            expensesCount: 25_345_678,
            settlementsCount: 321_987,
        });
        expect(useLoadingStore.getState().landing.stats).toBe('fetched');
    });
});

test('recovers a failed optional request into a safe failed state', () => {
    vi.mocked(statsApi.fetchStats).mockRejectedValue(new Error('offline'));

    return useLandingStatsStore
        .getState()
        .fetchSetStats()
        .then(() => {
            expect(useLandingStatsStore.getState().stats).toBeNull();
            expect(useLoadingStore.getState().landing.stats).toBe('fetched');
        });
});

test('deduplicates concurrent requests', () => {
    let resolveStats: ((value: typeof stats) => void) | undefined;
    const response = new Promise<typeof stats>(resolve => {
        resolveStats = resolve;
    });

    vi.mocked(statsApi.fetchStats).mockReturnValue(response);

    const firstRequest = useLandingStatsStore.getState().fetchSetStats();
    const secondRequest = useLandingStatsStore.getState().fetchSetStats();

    expect(statsApi.fetchStats).toHaveBeenCalledOnce();

    resolveStats?.(stats);

    return Promise.all([firstRequest, secondRequest]).then(() => undefined);
});

test('reuses fetched statistics for the application lifecycle', () => {
    vi.mocked(statsApi.fetchStats).mockResolvedValue(stats);

    return useLandingStatsStore
        .getState()
        .fetchSetStats()
        .then(() => useLandingStatsStore.getState().fetchSetStats())
        .then(() => {
            expect(statsApi.fetchStats).toHaveBeenCalledOnce();
            expect(useLoadingStore.getState().landing.stats).toBe('fetched');
        });
});

test('does not retry failed statistics on a later landing mount', () => {
    vi.mocked(statsApi.fetchStats).mockRejectedValue(new Error('offline'));

    return useLandingStatsStore
        .getState()
        .fetchSetStats()
        .then(() => useLandingStatsStore.getState().fetchSetStats())
        .then(() => {
            expect(statsApi.fetchStats).toHaveBeenCalledOnce();
        });
});
