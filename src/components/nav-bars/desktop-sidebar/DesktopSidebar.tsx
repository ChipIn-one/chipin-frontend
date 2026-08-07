import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { Box, Flex, Separator, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';
import { getPreferredModeRoute } from 'helpers/routes';
import { selectIsSoloMode } from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';
import { selectIsUserAdmin, useUsersStore } from 'store/users-store';

import { NavButton } from 'basics/buttons';
import AddExpenseButton from 'components/AddExpenseButton';
import DevMenu from 'components/DevMenu';
import { ModeLogotype } from 'components/mode-logotype';
import ViewModeSwitch from 'components/ViewModeSwitch';

import { getNavElements } from '../constants';

import { ProfileActions } from './components';
import { DESKTOP_SIDEBAR_WIDTH } from './constants';
import { SidebarNavButton, SidebarSurface } from './styled';

const DesktopSidebar = () => {
    const location = useLocation();
    const { t } = useTranslation('common');
    const isSoloMode = useDashboardStore(selectIsSoloMode);
    const canShowDevMenu = useUsersStore(selectIsUserAdmin);
    const homeRoute = getPreferredModeRoute(isSoloMode);
    const activeColor = isSoloMode ? 'violet' : 'green';
    const navElements = getNavElements(homeRoute);

    return (
        <Box
            display={{ initial: 'none', lg: 'block' }}
            width={DESKTOP_SIDEBAR_WIDTH}
            flexShrink="0"
        >
            <SidebarSurface>
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
                                    const isActive =
                                        location.pathname === href ||
                                        location.pathname.startsWith(`${href}/`);

                                    return (
                                        <SidebarNavButton
                                            key={href}
                                            $isActive={isActive}
                                            $isSoloMode={isSoloMode}
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
                                        </SidebarNavButton>
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
            </SidebarSurface>
        </Box>
    );
};

export default DesktopSidebar;
