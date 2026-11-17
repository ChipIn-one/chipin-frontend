import { Box, Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { getPreferredModeRoute, isNavigationRouteActive } from 'helpers/routes';
import { useCanAccessSolo } from 'hooks/useSelfUser';
import { selectIsSoloMode, useUiPrefsStore } from 'store/ui-prefs';

import { NavButton } from 'basics/buttons';

import { getNavElements } from './constants';

const HeaderNav = () => {
    const location = useLocation();
    const { t } = useTranslation('common');
    const canAccessSolo = useCanAccessSolo();
    const isSoloModeFromStore = useUiPrefsStore(selectIsSoloMode);
    const isSoloMode = canAccessSolo && isSoloModeFromStore;
    const activeColor = isSoloMode ? 'violet' : 'green';
    const navElements = getNavElements(getPreferredModeRoute(isSoloMode));

    return (
        <Box display={{ initial: 'none', sm: 'block' }}>
            <Flex justify="between" align="center" gap="5">
                {navElements.map(({ href, labelKey, Icon }) => {
                    const isActive = isNavigationRouteActive(location.pathname, href);

                    return (
                        <NavButton
                            key={href}
                            to={href}
                            variant="ghost"
                            size="3"
                            color={isActive ? activeColor : 'gray'}
                        >
                            <Icon size={24} />
                            <Text size="2" weight="bold">
                                {t(labelKey)}
                            </Text>
                        </NavButton>
                    );
                })}
            </Flex>
        </Box>
    );
};

export default HeaderNav;
