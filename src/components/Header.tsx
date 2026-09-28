import { UserAvatar } from 'basics';
import { LucideArrowRight, LucideLogIn, LucideMenu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useShallow } from 'zustand/react/shallow';

import * as Sentry from '@sentry/react';
import { Box, Button, Container, Flex, IconButton, Link } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';
import { ROUTES } from 'constants/routes';
import { themeColor } from 'helpers/colors';
import {
    matchLocale,
    saveLocalePreference,
    SUPPORTED_LOCALES,
    type SupportedLocale,
} from 'helpers/locale';
import { getHasDesktopSidebar, getPreferredModeRoute } from 'helpers/routes';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectIsSoloMode } from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';
import { selectCanAccessSolo, selectIsUserAdmin, useUsersStore } from 'store/users-store';

import { NavButton } from 'basics/buttons';
import LanguageSelector from 'components/LanguageSelector';
import { ModeLogotype } from 'components/mode-logotype';

import HeaderNav from './nav-bars/HeaderNav';
import DevMenu from './DevMenu';
import Dropdown from './Dropdown';
import { AuthModal } from './modals';

const StickyBox = styled(Box)`
    position: sticky;
    top: 0;
    width: 100%;
    /* The root Theme contains this local layer, so Radix portals still paint above it. */
    z-index: 1;
    border-bottom: 1px solid ${themeColor('green6')};
    backdrop-filter: blur(10px);
`;

const LANDING_NAV_LINKS = [
    { labelKey: 'nav.features', href: '#features' },
    { labelKey: 'nav.howItWorks', href: '#how-it-works' },
    { labelKey: 'nav.pricing', href: '#pricing' },
] as const;

interface LandingLanguageProps {
    value: SupportedLocale;
    onChange: (locale: SupportedLocale) => void;
}

const LandingNav = ({ value, onChange }: LandingLanguageProps) => {
    const { t } = useTranslation('landing');

    return (
        <Box display={{ initial: 'none', md: 'block' }}>
            <Flex align="center" gap="6">
                {LANDING_NAV_LINKS.map(({ labelKey, href }) => (
                    <Button key={href} variant="ghost" color="gray" size="3" asChild>
                        <Link href={href} color="gray" underline="none">
                            {t(labelKey)}
                        </Link>
                    </Button>
                ))}
                <LanguageSelector value={value} variant="compact" onChange={onChange} />
            </Flex>
        </Box>
    );
};

const LandingMobileMenu = ({ value, onChange }: LandingLanguageProps) => {
    const { t } = useTranslation('landing');
    const { t: tSettings } = useTranslation('settings');

    const navItems = LANDING_NAV_LINKS.map(({ labelKey, href }) => ({
        value: href,
        label: t(labelKey),
        onSelect: () => {
            window.location.href = href;
        },
    }));
    const languageItems = SUPPORTED_LOCALES.map(locale => ({
        value: locale,
        label: tSettings(`language.options.${locale}`),
        color: locale === value ? ('green' as const) : undefined,
        onSelect: () => {
            onChange(locale);
        },
    }));

    return (
        <Dropdown
            sections={[
                { items: navItems },
                {
                    label: tSettings('common:fields.interfaceLanguage'),
                    items: languageItems,
                },
            ]}
            trigger={
                <IconButton variant="ghost" color="gray" size="2">
                    <LucideMenu />
                </IconButton>
            }
            align="end"
        />
    );
};

const Header = () => {
    const isAuthResolved = useAuthStore(selectIsAuthResolved);
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const { user, canAccessSolo, canShowDevMenu } = useUsersStore(
        useShallow(state => ({
            user: state.user,
            canAccessSolo: selectCanAccessSolo(state),
            canShowDevMenu: selectIsUserAdmin(state),
        })),
    );
    const isSoloModeFromStore = useDashboardStore(selectIsSoloMode);
    const isSoloMode = canAccessSolo && isSoloModeFromStore;
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const landingLocale = matchLocale(i18n.resolvedLanguage ?? i18n.language) ?? 'en';

    const onLandingLanguageChange = (locale: SupportedLocale) => {
        return i18n
            .changeLanguage(locale)
            .then(() => {
                saveLocalePreference(locale);
            })
            .catch((error: unknown) => {
                Sentry.captureException(error);
            });
    };

    if (!isAuthResolved) {
        return null;
    }

    const isLandingPage = !isLoggedIn && location.pathname === ROUTES.HOME;
    const hasDesktopSidebar = isLoggedIn && getHasDesktopSidebar(location.pathname);
    const logoRoute = isLoggedIn
        ? getPreferredModeRoute(isSoloMode)
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
                        />
                    )}

                    <Flex gap="4" align="center">
                        {canShowDevMenu && <DevMenu />}
                        {isLoggedIn ? (
                            <Flex gap="4" align="center">
                                <Box display={{ initial: 'none', sm: 'block' }}>
                                    <NavButton to={ROUTES.SETTINGS} variant="ghost" radius="full">
                                        <UserAvatar size="3" user={user ?? undefined} />
                                    </NavButton>
                                </Box>
                            </Flex>
                        ) : isLandingPage ? (
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
                        ) : (
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
