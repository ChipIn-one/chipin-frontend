import { useSyncExternalStore } from 'react';

import { getLegacyHostStandaloneAppHost } from 'helpers/legacyHost';
import { checkIsPwaInstalled } from 'helpers/pwa';

// #758: the prerendered HTML and the hydration render have no host and no display mode (server
// snapshot `null`), so both render the normal landing; the host and the display mode decide right
// after hydration, as in `SignInEntry`.
const subscribeToNothing = () => () => undefined;
const getClientAppHost = () =>
    getLegacyHostStandaloneAppHost(window.location.hostname, checkIsPwaInstalled());
const getServerAppHost = () => null;

/**
 * The bare app host when the landing runs as an installed web app on a legacy host
 * (`chipin.one`, `dev.chipin.one`), else `null`: the sign-in CTAs then give way to the notice.
 */
export const useLegacyHostStandaloneAppHost = (): string | null =>
    useSyncExternalStore(subscribeToNothing, getClientAppHost, getServerAppHost);
