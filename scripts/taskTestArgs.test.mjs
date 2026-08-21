import { expect, test } from 'vitest';

import { getTaskTestArgs } from './taskTestArgs.mjs';

test('rejects an invocation without an explicit test path', () => {
    expect(() => getTaskTestArgs([])).toThrow(
        'test:task requires at least one explicit test path',
    );
    expect(() => getTaskTestArgs(['--testNamePattern', 'saves settings'])).toThrow(
        'test:task requires at least one explicit test path',
    );
    expect(() => getTaskTestArgs(['--config', 'config/vitest.config.ts'])).toThrow(
        'test:task requires at least one explicit test path',
    );
    expect(() => getTaskTestArgs(['src/'])).toThrow(
        'test:task requires at least one explicit test path',
    );
});

test('preserves explicit paths and Vitest flags', () => {
    const args = ['src/store/groupsStore.test.ts', '--testNamePattern', 'refreshes groups'];

    expect(getTaskTestArgs(args)).toEqual(args);
});
