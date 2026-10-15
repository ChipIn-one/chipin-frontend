import { LucideArrowRight, LucideLogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { Box, Button, Container, Flex } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';
import { DEFAULT_LOCALE } from 'constants/locales';
import { PUBLIC_HOME_PAGE } from 'constants/publicRouteManifest';
import { ROUTES } from 'constants/routes';
import { getPublicPath, getPublicRoute } from 'helpers/publicRoutes';
import { themeColor } from 'helpers/colors';
import { matchLocale, type SupportedLocale } from 'helpers/locale';
import { suppressPublicLocaleSuggestion } from 'helpers/publicLocaleSuggestion';
import { getHasDesktopSidebar, getPreferredModeRoute } from 'helpers/routes';

import { NavButton } from 'basics/buttons';
import LanguageSelector from 'components/LanguageSelector';
import { ModeLogotype } from 'components/mode-logotype';

import HeaderNav from './nav-bars/HeaderNav';
import DevMenu from './DevMenu';
import { AuthModal } from './modals';
import { LandingNav } from './header/LandingNav';
import { LandingMobileMenu } from './header/LandingMobileMenu';
import { useConnect } from './header/internal/useConnect';

const StickyBox = styled(Box)`
    position: sticky;
    top: 0;
    width: 100%;
    /* The root Theme contains this local layer, so Radix portals still paint above it. */
    z-index: 1;
    border-bottom: 1px solid ${themeColor('green6')};
    backdrop-filter: blur(10px);
`;

const Header = () => {
    const { isAuthResolved, isLoggedIn, canShowDevMenu, isSoloMode } = useConnect();
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const landingLocale = matchLocale(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE;

    const currentPublicRoute = getPublicRoute(location.pathname);
    const getPublicLanguageHref = (locale: SupportedLocale) =>
        currentPublicRoute ? getPublicPath(currentPublicRoute.page, locale) : ROUTES.HOME;
    const onLandingLanguageChange = (locale: SupportedLocale) => {
        if (!currentPublicRoute) {
            return;
        }
        suppressPublicLocaleSuggestion();
        const nextPath = getPublicPath(currentPublicRoute.page, locale);
        if (location.pathname !== nextPath) {
            window.location.assign(nextPath);
        }
    };

    if (!isAuthResolved) {
        return null;
    }

    const isLandingPage = !isLoggedIn && currentPublicRoute?.page === 'home';
    const hasDesktopSidebar = isLoggedIn && getHasDesktopSidebar(location.pathname);
    const logoRoute = isLoggedIn
        ? getPreferredModeRoute(isSoloMode)
        : currentPublicRoute
            ? getPublicPath(PUBLIC_HOME_PAGE, currentPublicRoute.locale)
            : ROUTES.HOME;

    return (
        <StickyBox
            display={
                isLoggedIn
                    ? {
                          initial: 'none',
                          sm: 'block',
                          ...(hasDesktopSidebar && { lg: 'none' }),
                      }
                    : undefined
            }
        >
            <Container size="4" p="4">
                <Flex justify="between" align="center">
                    <NavButton to={logoRoute} aria-label={PROJECT_NAME} unsetStyles>
                        <ModeLogotype
                            isSoloMode={isLoggedIn && isSoloMode}
                            isModeBadgeVisible={isLoggedIn}
                        />
                    </NavButton>

                    {isLoggedIn && <HeaderNav />}
                    {isLandingPage && (
                        <LandingNav
                            value={landingLocale}
                            onChange={onLandingLanguageChange}
                            getHref={getPublicLanguageHref}
                        />
                    )}

                    <Flex gap="4" align="center">
                        {isLoggedIn && canShowDevMenu && <DevMenu />}
                        {!isLoggedIn && isLandingPage && (
                            <Flex align="center" gap="2">
                                <AuthModal>
                                    <Button size="2" variant="soft" color="green" radius="full">
                                        {t('header.signIn')}
                                        <LucideArrowRight size={16} />
                                    </Button>
                                </AuthModal>
                                <Box display={{ initial: 'block', md: 'none' }}>
                                    <LandingMobileMenu
                                        value={landingLocale}
                                        onChange={onLandingLanguageChange}
                                    />
                                </Box>
                            </Flex>
                        )}
                        {!isLoggedIn && !isLandingPage && currentPublicRoute && (
                            <LanguageSelector
                                value={landingLocale}
                                variant="compact"
                                getHref={getPublicLanguageHref}
                                onChange={onLandingLanguageChange}
                            />
                        )}
                        {!isLoggedIn && !isLandingPage && (
                            <AuthModal>
                                <Button
                                    size={{
                                        initial: '2',
                                        sm: '3',
                                    }}
                                    variant="outline"
                                >
                                    {t('header.signIn')}
                                    <LucideLogIn />
                                </Button>
                            </AuthModal>
                        )}
                    </Flex>
                </Flex>
            </Container>
        </StickyBox>
    );
};

export default Header;
