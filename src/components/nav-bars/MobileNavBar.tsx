import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { Box, Flex, Text } from '@radix-ui/themes';

import {
    getPreferredModeRoute,
    isNavigationRouteActive,
} from 'helpers/routes';
import { useAddExpenseAvailability } from 'hooks/useAddExpenseAvailability';

import AddExpenseButton from 'components/AddExpenseButton';

import { getNavElements, type NavElement } from './constants';
import {
    MobileNavBarWrapper,
    MobileNavCenterAction,
    MobileNavContent,
    MobileNavItemButton,
    MobileNavItems,
    MobileNavSurface,
} from './styled';

const MobileNavBar = () => {
    const location = useLocation();
    const { t } = useTranslation('common');
    const { isSoloMode, isVisible: isAddExpenseVisible } =
        useAddExpenseAvailability(location.pathname);
    const activeColor = isSoloMode ? 'violet' : 'green';
    const navElements = getNavElements(
        getPreferredModeRoute(isSoloMode),
    );

    const renderNavItem = ({ labelKey, href, Icon }: NavElement) => {
        const isActive = isNavigationRouteActive(
            location.pathname,
            href,
        );

        return (
            <Box key={href} flexGrow="1">
                <MobileNavItemButton
                    to={href}
                    color={isActive ? activeColor : 'gray'}
                    radius="none"
                    variant={isActive ? 'solid' : 'surface'}
                >
                    <Flex
                        direction="column"
                        align="center"
                        justify="center"
                        gap="1"
                        py="1"
                    >
                        <Icon size={20} />
                        <Text
                            size="1"
                            {...(!isActive && { color: 'gray' })}
                        >
                            {t(labelKey)}
                        </Text>
                    </Flex>
                </MobileNavItemButton>
            </Box>
        );
    };

    return (
        <MobileNavBarWrapper
            display={{ initial: 'block', sm: 'none' }}
            position="fixed"
            bottom="0"
            left="0"
            right="0"
        >
            <MobileNavSurface
                $hasCenterAction={isAddExpenseVisible}
            />

            <MobileNavContent align="stretch">
                <MobileNavItems justify="between" align="stretch">
                    {navElements.map(renderNavItem)}
                </MobileNavItems>

                {isAddExpenseVisible && (
                    <MobileNavCenterAction>
                        <AddExpenseButton type="mobile" />
                    </MobileNavCenterAction>
                )}
            </MobileNavContent>
        </MobileNavBarWrapper>
    );
};

export default MobileNavBar;
