// Vitest stand-in for `virtual:pwa-register/react` (spec 04 §2.11): the virtual module exists only
// in a build with VitePWA. It registers nothing; tests that check the registration `vi.mock` it.
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

export const useRegisterSW = (_options?: RegisterSWOptions) => ({
    needRefresh: [false, () => undefined] as const,
    offlineReady: [false, () => undefined] as const,
    updateServiceWorker: (_reloadPage?: boolean): Promise<void> => Promise.resolve(),
});
