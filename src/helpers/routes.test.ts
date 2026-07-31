import { expect, test } from 'vitest';

import { getPreferredModeRoute } from './routes';

test('selects the Solo route when Solo Mode is the user default', () => {
    expect(getPreferredModeRoute(true)).toBe('/solo');
    expect(getPreferredModeRoute(false)).toBe('/dashboard');
});
