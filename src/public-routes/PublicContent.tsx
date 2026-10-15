import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';

import { Box } from '@radix-ui/themes';

import { getPublicRoute } from 'helpers/publicRoutes';
import type { PublicRoute } from 'types/publicRoutes';

import BackgroundBox from 'basics/BackgroundBox';
import Header from 'components/Header';
import { BackendUnavailableGate } from 'components/backend-unavailable-page/BackendUnavailableGate';
import HomePage from 'pages/HomePage';
import PrivacyPage from 'pages/PrivacyPage';
import TermsPage from 'pages/TermsPage';

import { PublicEffects } from './PublicEffects';
import { PublicLanguageLinks } from './PublicLanguageLinks';

// Both SSR and the initial hydration render skip browser-only auth/network effects.
const subscribeToHydration = () => () => undefined;
const getClientHydration = () => true;
const getServerHydration = () => false;

const PublicContent = ({ initialRoute, isDark }: { initialRoute: PublicRoute; isDark: boolean }) => {
    const isHydrated = useSyncExternalStore(
        subscribeToHydration,
        getClientHydration,
        getServerHydration,
    );
    const location = useLocation();
    const route = getPublicRoute(location.pathname) ?? initialRoute;

    useEffect(() => {
        if (!getPublicRoute(location.pathname)) {
            window.location.assign(location.pathname + location.search + location.hash);
        }
    }, [location.hash, location.pathname, location.search]);

    let Page = HomePage;
    if (route.page === 'privacy') {
        Page = PrivacyPage;
    } else if (route.page === 'terms') {
        Page = TermsPage;
    }

    return (
        <>
            {isHydrated && <PublicEffects route={route} isDark={isDark} />}
            <BackendUnavailableGate>
                <BackgroundBox>
                    <Header />
                    {!isHydrated && <PublicLanguageLinks route={route} />}
                    <Box px="4"><Page /></Box>
                </BackgroundBox>
            </BackendUnavailableGate>
        </>
    );
};

export { PublicContent };
