import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { Box, Flex, Text } from '@radix-ui/themes';

import { getPreferredModeRoute } from 'helpers/routes';
import { selectIsSoloMode } from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';

import { NavButton } from 'basics/buttons';

import { getNavElements } from './constants';

const HeaderNav = () => {
    const location = useLocation();
    const { t } = useTranslation('common');
    const isSoloMode = useDashboardStore(selectIsSoloMode);
    const activeColor = isSoloMode ? 'violet' : 'green';
    const navElements = getNavElements(
        getPreferredModeRoute(isSoloMode),
    );

    return (
        <Box display={{ initial: 'none', sm: 'block' }}>
            <Flex justify="between" align="center" gap="5">
                {navElements.map(({ href, labelKey, Icon }) => {
                    const isActive =
                        location.pathname === href || location.pathname.startsWith(`${href}/`);

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
