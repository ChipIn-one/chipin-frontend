import { beforeEach, expect, test, vi } from 'vitest';

import { publicApiInstance } from './chipin.instance';
import { fetchStats } from './statsApi';

vi.mock('./chipin.instance', () => ({
    publicApiInstance: {
        get: vi.fn(),
    },
}));

beforeEach(() => {
    vi.clearAllMocks();
});

test('fetches the complete public landing statistics contract', () => {
    const response = {
        usersCount: 51_234,
        groupsCount: 16_789,
        expensesCount: 25_345_678,
        settlementsCount: 321_987,
    };

    vi.mocked(publicApiInstance.get).mockResolvedValue({ data: response });

    return fetchStats().then(stats => {
        expect(stats).toEqual({
            usersCount: 51_234,
            groupsCount: 16_789,
            expensesCount: 25_345_678,
            settlementsCount: 321_987,
        });
        expect(publicApiInstance.get).toHaveBeenCalledOnce();
        expect(publicApiInstance.get).toHaveBeenCalledWith('/stats');
    });
});
