import { type ReactElement, useSyncExternalStore } from 'react';
import { Slot } from '@radix-ui/themes';

import { getLegacyHostAppDashboardUrl } from 'helpers/legacyHost';
import { useLegacyHostStandaloneAppHost } from 'hooks/useLegacyHostStandaloneAppHost';

import { AuthModal } from './AuthModal';

// Spec 04 §4.5 step 1 (04-4a2): on a legacy host (`chipin.one`, `dev.chipin.one`) the landing signs
// nobody in, so a sign-in CTA is a full navigation to `<app host>/dashboard`, where the guard shows
// the sign-in. Every other host (the app hosts, previews, localhost) opens the auth modal, as before.
// The prerendered HTML and the hydration render have no host (server snapshot `null`), so both
// render the modal trigger; the host decides right after hydration.
// #758: in an icon installed from a legacy host (standalone display mode) that navigation opens an
// in-app sheet whose session never reaches the icon, so the CTA is not rendered at all; the public
// routes show `LegacyHostStandaloneNotice` instead.
const subscribeToNothing = () => () => undefined;
const getClientAppDashboardUrl = () => getLegacyHostAppDashboardUrl(window.location.hostname);
const getServerAppDashboardUrl = () => null;

const SignInEntry = ({ children }: { children: ReactElement }) => {
    const appDashboardUrl = useSyncExternalStore(
        subscribeToNothing,
        getClientAppDashboardUrl,
        getServerAppDashboardUrl,
    );
    const standaloneAppHost = useLegacyHostStandaloneAppHost();

    if (standaloneAppHost !== null) {
        return null;
    }

    if (appDashboardUrl !== null) {
        return (
            <Slot
                onClick={() => {
                    window.location.assign(appDashboardUrl);
                }}
            >
                {children}
            </Slot>
        );
    }

    return <AuthModal>{children}</AuthModal>;
};

export { SignInEntry };
