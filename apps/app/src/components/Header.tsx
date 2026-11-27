import { Box, Button, Container, Flex } from '@radix-ui/themes';
import { LogInIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { PROJECT_NAME } from 'constants/chipin';
import { ROUTES } from 'constants/routes';
import { getHasDesktopSidebar, getPreferredModeRoute } from 'helpers/routes';
import { SITE_PATHS } from 'helpers/sitePaths';
import { useCanAccessSolo, useIsUserAdmin } from 'hooks/useSelfUser';
import { selectIsAuthResolved, selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectIsSoloMode, useUiPrefsStore } from 'store/ui-prefs';

import { ModeLogotype } from 'components/mode-logotype';
import { NavButton, UnstyledButton } from 'components/NavButton';

import { DevMenu } from './DevMenu';
import { SignInEntry } from './modals/auth-modal';
import { HeaderNav } from './nav-bars/HeaderNav';

import styles from './Header.module.css';

const Header = () => {
    const { isAuthResolved, isLoggedIn } = useAuthStore(
        useShallow(state => ({
            isAuthResolved: selectIsAuthResolved(state),
            isLoggedIn: selectIsLoggedIn(state),
        })),
    );
    const canAccessSolo = useCanAccessSolo();
    const canShowDevMenu = useIsUserAdmin();
    const isSoloModeFromStore = useUiPrefsStore(selectIsSoloMode);
    const isSoloMode = canAccessSolo && isSoloModeFromStore;
    const location = useLocation();
    const { t } = useTranslation();

    if (!isAuthResolved) {
        return null;
    }

    const hasDesktopSidebar = isLoggedIn && getHasDesktopSidebar(location.pathname);
    // Signed out, the logo leads to the site: a plain link, never a router navigation (§2.1).
    const siteHomeHref = SITE_PATHS.home();
    const logo = (
        <ModeLogotype isSoloMode={isLoggedIn && isSoloMode} isModeBadgeVisible={isLoggedIn} />
    );
    // The sign-in page itself needs no sign-in button.
    const isLoginPage = location.pathname === ROUTES.LOGIN;

    return (
        <Box
            className={styles.root}
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
                    {isLoggedIn ? (
                        <NavButton
                            to={getPreferredModeRoute(isSoloMode)}
                            aria-label={PROJECT_NAME}
                            unsetStyles
                        >
                            {logo}
                        </NavButton>
                    ) : (
                        <UnstyledButton asChild>
                            <a href={siteHomeHref} aria-label={PROJECT_NAME}>
                                {logo}
                            </a>
                        </UnstyledButton>
                    )}

                    {isLoggedIn && <HeaderNav />}

                    <Flex gap="4" align="center">
                        {isLoggedIn && canShowDevMenu && <DevMenu />}
                        {!isLoggedIn && !isLoginPage && (
                            <SignInEntry>
                                <Button
                                    size={{
                                        initial: '2',
                                        sm: '3',
                                    }}
                                    variant="outline"
                                >
                                    {t('header.signIn')}
                                    <LogInIcon />
                                </Button>
                            </SignInEntry>
                        )}
                    </Flex>
                </Flex>
            </Container>
        </Box>
    );
};

export { Header };
