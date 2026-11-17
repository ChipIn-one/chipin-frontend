import { useEffect, useState } from 'react';

import { getLegacyHostAppDashboardUrl } from 'helpers/legacyHost';
import { hasAuthSessionHint } from 'helpers/localStorage';
import { useCheckSignIn } from 'hooks/useCheckSignIn';
import { AUTH_STATUS, UNAUTH_REASON } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

const PublicSessionCheck = () => {
    useCheckSignIn();
    return null;
};

// Spec 04 §4.1, §4.5 step 1 (04-4a2): on a legacy host the landing makes no auth call at all.
// `useCheckSignIn` would refresh for any visitor with a session hint and rotate the old host-only
// cookie with a new `Set-Cookie` there; instead a visitor with a hint goes straight to the app host,
// and one without it is anonymous locally (no request), so the landing renders its header.
const LegacyHostSessionHandoff = ({ appDashboardUrl }: { appDashboardUrl: string }) => {
    const setUnauthenticated = useAuthStore(state => state.setUnauthenticated);

    useEffect(() => {
        if (hasAuthSessionHint()) {
            window.location.replace(appDashboardUrl);
            return;
        }
        if (useAuthStore.getState().status === AUTH_STATUS.UNKNOWN) {
            setUnauthenticated(UNAUTH_REASON.MISSING);
        }
    }, [appDashboardUrl, setUnauthenticated]);

    return null;
};

/** The session check of the public branch; mounted only after hydration (browser only). */
const PublicSession = () => {
    const [appDashboardUrl] = useState(() =>
        getLegacyHostAppDashboardUrl(window.location.hostname),
    );

    return appDashboardUrl === null ? (
        <PublicSessionCheck />
    ) : (
        <LegacyHostSessionHandoff appDashboardUrl={appDashboardUrl} />
    );
};

export { PublicSession };
