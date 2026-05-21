import { useState } from 'react';
import { UserAvatar } from 'basics';
import {
    LucideArrowRight,
    LucideBug,
    LucideFlaskConical,
    LucideLogIn,
    LucideMenu,
    LucideMoon,
    LucideSun,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { Box, Button, Container, Flex, IconButton, Link, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';
import { ROUTES } from 'constants/routes';
import { themeColor } from 'helpers/colors';
import { getIsDevEnv } from 'helpers/env';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { useUsersStore } from 'store/usersStore';

import { NavButton } from 'basics/buttons';

import Logotype from 'assets/logo.svg?react';

import AuthModal from './modals/AuthModal';
import HeaderNav from './nav-bars/HeaderNav';
import Dropdown from './Dropdown';

const StickyBox = styled(Box)`
    position: sticky;
    top: 0;
    width: 100%;
    z-index: 1;
    border-bottom: 1px solid ${themeColor('green6')};
    backdrop-filter: blur(10px);
`;

const StyledLogotype = styled(Logotype)`
    width: 40px;
    height: 40px;
`;

const LANDING_NAV_LINKS = [
    { labelKey: 'nav.features', href: '#features' },
    { labelKey: 'nav.howItWorks', href: '#how-it-works' },
    { labelKey: 'nav.pricing', href: '#pricing' },
] as const;

const LandingNav = () => {
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
            </Flex>
        </Box>
    );
};

const LandingMobileMenu = () => {
    const { t } = useTranslation('landing');

    const items = LANDING_NAV_LINKS.map(({ labelKey, href }) => ({
        value: href,
        label: t(labelKey),
        onSelect: () => {
            window.location.href = href;
        },
    }));

    return (
        <Dropdown
            items={items}
            trigger={
                <IconButton variant="ghost" color="gray" size="2">
                    <LucideMenu />
                </IconButton>
            }
            align="end"
        />
    );
};

const DevMenu = () => {
    const [shouldCrash, setShouldCrash] = useState(false);
    const { theme, setTheme } = useTheme();
    const { t } = useTranslation();

    if (shouldCrash) {
        throw new Error('Manual test error triggered from the header crash button.');
    }

    const isDark = theme === 'dark';

    const items = [
        {
            value: 'switchTheme',
            label: t('header.switchTheme'),
            icon: isDark ? <LucideSun size={16} /> : <LucideMoon size={16} />,
            onSelect: () => setTheme(isDark ? 'light' : 'dark'),
        },
        {
            value: 'testError',
            label: t('header.testError'),
            icon: <LucideBug size={16} />,
            onSelect: () => setShouldCrash(true),
        },
    ];

    return (
        <Dropdown
            items={items}
            trigger={
                <IconButton
                    size={{
                        initial: '2',
                        sm: '3',
                    }}
                    variant="soft"
                    color="gray"
                    aria-label={t('header.devMenu')}
                >
                    <LucideFlaskConical />
                </IconButton>
            }
            align="end"
        />
    );
};

const Header = () => {
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const user = useUsersStore(s => s.user);
    const location = useLocation();
    const { t } = useTranslation();

    const isLandingPage = !isLoggedIn && location.pathname === ROUTES.HOME;

    return (
        <StickyBox>
            <Container size="4" p="4">
                <Flex justify="between" align="center">
                    <NavButton to={isLoggedIn ? ROUTES.DASHBOARD : ROUTES.HOME} unsetStyles>
                        <Flex gap="4" align="center" justify="center">
                            <StyledLogotype />

                            <Box display={{ initial: 'none', sm: 'block' }}>
                                <Text size="6" weight="bold">
                                    {PROJECT_NAME}
                                </Text>
                            </Box>
                        </Flex>
                    </NavButton>

                    {isLoggedIn && <HeaderNav />}
                    {isLandingPage && <LandingNav />}

                    <Flex gap="4" align="center">
                        {getIsDevEnv() && <DevMenu />}
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
                                    <LandingMobileMenu />
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
