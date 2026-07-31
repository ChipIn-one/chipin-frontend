import { expect, test } from 'vitest';

import { selectIsSoloMode } from './dashboardSelectors';
import { APP_MODES, useDashboardStore } from './dashboardStore';

test('selects whether the active app mode is Solo', () => {
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
    expect(selectIsSoloMode(useDashboardStore.getState())).toBe(false);

    useDashboardStore.setState({ appMode: APP_MODES.SOLO });
    expect(selectIsSoloMode(useDashboardStore.getState())).toBe(true);
});
