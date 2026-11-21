import { expect, test } from 'vitest';

import { cx } from './cx';

test('joins class names and skips empty ones', () => {
    expect(cx('root', undefined, false, null, '', 'external')).toBe('root external');
    expect(cx()).toBe('');
});
