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
// cookie with a new `Set-Cookie` there; instead a visitor with a hint on the home page (any locale)
// goes straight to the app host, like the logged-in redirect of the public home. Every other visitor,
// and any visitor of another public page (privacy, terms: linked from stores, OAuth consent and
// mail), is anonymous locally (no request), so the page renders its header. Nothing on the legacy
// host clears the hint, so this handoff of the home page is permanent for such a browser.
const LegacyHostSessionHandoff = ({
    appDashboardUrl,
    isHome,
}: {
    appDashboardUrl: string;
    isHome: boolean;
}) => {
    const setUnauthenticated = useAuthStore(state => state.setUnauthenticated);

    useEffect(() => {
        if (isHome && hasAuthSessionHint()) {
            window.location.replace(appDashboardUrl);
            return;
        }
        if (useAuthStore.getState().status === AUTH_STATUS.UNKNOWN) {
            setUnauthenticated(UNAUTH_REASON.MISSING);
        }
    }, [appDashboardUrl, isHome, setUnauthenticated]);

    return null;
};

/** The session check of the public branch; mounted only after hydration (browser only). */
const PublicSession = ({ isHome }: { isHome: boolean }) => {
    const [appDashboardUrl] = useState(() =>
        getLegacyHostAppDashboardUrl(window.location.hostname),
    );

    return appDashboardUrl === null ? (
        <PublicSessionCheck />
    ) : (
        <LegacyHostSessionHandoff appDashboardUrl={appDashboardUrl} isHome={isHome} />
    );
};

export { PublicSession };
