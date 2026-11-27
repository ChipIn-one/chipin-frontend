import { Box, Card, Flex, Separator, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { PROJECT_NAME } from 'constants/chipin';
import { getPreferredModeRoute, isNavigationRouteActive } from 'helpers/routes';
import { useCanAccessSolo, useIsUserAdmin } from 'hooks/useSelfUser';
import { selectIsSoloMode, useUiPrefsStore } from 'store/ui-prefs';

import { AddExpenseButton } from 'components/AddExpenseButton';
import { DevMenu } from 'components/DevMenu';
import { ModeLogotype } from 'components/mode-logotype';
import { NavButton } from 'components/NavButton';
import { ViewModeSwitch } from 'components/ViewModeSwitch';

import { getNavElements } from '../constants';

import { ProfileActions } from './components';
import { DESKTOP_SIDEBAR_WIDTH } from './constants';

import styles from './DesktopSidebar.module.css';

const DesktopSidebar = () => {
    const location = useLocation();
    const { t } = useTranslation('common');
    const canAccessSolo = useCanAccessSolo();
    const isSoloModeFromStore = useUiPrefsStore(selectIsSoloMode);
    const isSoloMode = canAccessSolo && isSoloModeFromStore;
    const canShowDevMenu = useIsUserAdmin();
    const homeRoute = getPreferredModeRoute(isSoloMode);
    const activeColor = isSoloMode ? 'violet' : 'green';
    const navElements = getNavElements(homeRoute);

    return (
        <Box
            className={styles.root}
            data-variant={isSoloMode ? 'solo' : 'group'}
            display={{ initial: 'none', lg: 'block' }}
            width={DESKTOP_SIDEBAR_WIDTH}
            flexShrink="0"
        >
            <Card className={styles.surface}>
                <Flex direction="column" gap="4" height="100%">
                    <NavButton
                        to={homeRoute}
                        aria-label={`${PROJECT_NAME} ${t(isSoloMode ? 'modes.solo' : 'modes.group')}`}
                        unsetStyles
                    >
                        <ModeLogotype isSoloMode={isSoloMode} />
                    </NavButton>

                    <Box asChild>
                        <nav>
                            <Flex direction="column" gap="4">
                                {navElements.map(({ href, labelKey, Icon }) => {
                                    const isActive = isNavigationRouteActive(
                                        location.pathname,
                                        href,
                                    );

                                    return (
                                        <NavButton
                                            key={href}
                                            className={styles.navButton}
                                            data-active={isActive}
                                            to={href}
                                            aria-current={isActive ? 'page' : undefined}
                                            variant="ghost"
                                            size="3"
                                            color={isActive ? activeColor : 'gray'}
                                        >
                                            <Icon size={24} />
                                            <Text size="3" weight={isActive ? 'bold' : 'medium'}>
                                                {t(labelKey)}
                                            </Text>
                                        </NavButton>
                                    );
                                })}
                            </Flex>
                        </nav>
                    </Box>

                    <Flex direction="column" gap="4">
                        <Separator size="4" />
                        <AddExpenseButton type="sidebar" />

                        {canShowDevMenu && (
                            <Box>
                                <DevMenu isShowLabel />
                            </Box>
                        )}
                    </Flex>

                    <Flex direction="column" gap="4" mt="auto">
                        <ViewModeSwitch />
                        <Separator size="4" />
                        <ProfileActions isSoloMode={isSoloMode} />
                    </Flex>
                </Flex>
            </Card>
        </Box>
    );
};

export { DesktopSidebar };
