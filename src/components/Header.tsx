import { useState } from 'react';
import { LucideBug, LucideLogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import { Box, Button, Container, Flex, IconButton, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';
import { ROUTES } from 'constants/routes';
import { themeColor } from 'helpers/colors';
import { getIsDevEnv } from 'helpers/env';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import { EmptyRouteLink } from 'basics/EmptyRouteLink';
import UserAvatar from 'components/UserAvatar';

import Logotype from 'assets/logo.svg?react';

import AuthModal from './Modal/AuthModal';
import HeaderNav from './Navs/HeaderNav';
import ThemeSwitcherDev from './ThemeSwitcherDev';

const StickyBox = styled(Box)`
    position: sticky;
    top: 0;
    width: 100%;
    z-index: 1;
    border-bottom: 1px solid ${themeColor('green8')};
    backdrop-filter: blur(10px);
`;

const StyledLogotype = styled(Logotype)`
    width: 40px;
    height: 40px;
`;

const CrashTestButton = () => {
    const [shouldCrash, setShouldCrash] = useState(false);
    const { t } = useTranslation();

    if (shouldCrash) {
        throw new Error('Manual test error triggered from the header crash button.');
    }

    return (
        <IconButton
            size={{
                initial: '2',
                sm: '3',
            }}
            variant="soft"
            color="amber"
            aria-label={t('header.testError')}
            title={t('header.testError')}
            onClick={() => setShouldCrash(true)}
        >
            <LucideBug />
        </IconButton>
    );
};

const Header = () => {
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const { t } = useTranslation();

    return (
        <StickyBox>
            <Container size="4" p="4">
                <Flex justify="between" align="center">
                    <EmptyRouteLink to={isLoggedIn ? ROUTES.DASHBOARD : ROUTES.HOME}>
                        <Flex gap="4" align="center" justify="center">
                            <StyledLogotype />

                            <Box display={{ initial: 'none', sm: 'block' }}>
                                <Text size="6" weight="bold">
                                    {PROJECT_NAME}
                                </Text>
                            </Box>
                        </Flex>
                    </EmptyRouteLink>

                    {isLoggedIn && <HeaderNav />}

                    <Flex gap="4" align="center">
                        {getIsDevEnv() && <CrashTestButton />}
                        {getIsDevEnv() && <ThemeSwitcherDev />}
                        {isLoggedIn ? (
                            <Flex gap="4" align="center">
                                <Box display={{ initial: 'none', sm: 'block' }}>
                                    <Link to={ROUTES.SETTINGS}>
                                        <UserAvatar size="3" />
                                    </Link>
                                </Box>
                            </Flex>
                        ) : (
                            <>
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
                            </>
                        )}
                    </Flex>
                </Flex>
            </Container>
        </StickyBox>
    );
};

export default Header;
