import { data } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

import { loaderArgs } from 'test/loaderArgs';

import { loader } from './route';

vi.mock('./ActivitySubeventsPage', () => ({ default: () => null }));

const call = (parentActivityId: string) => loader(loaderArgs({ parentActivityId }));

test('04-2a3: the activityDetails route validates parentActivityId synchronously', () => {
    expect(call('3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b')).toBeNull();

    try {
        call('123');
        expect.unreachable();
    } catch (error: unknown) {
        expect(error).toEqual(data(null, { status: 404 }));
    }
});
