import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { Box, Flex, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { getPreferredModeRoute } from 'helpers/routes';
import { selectIsSoloMode } from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';

import { NavButton } from 'basics/buttons';
import AddExpenseButton from 'components/AddExpenseButton';

import { getNavElements, type NavElement } from './constants';

const BoxWrapper = styled(Box)`
    /* Keep the persistent navigation above in-flow content without competing with Radix portals. */
    z-index: 0;
    overflow: visible;
`;

const NavSurface = styled(Box)<{ $showNotch?: boolean }>`
    position: absolute;
    inset: 0;
    background: ${({ $showNotch, theme }) =>
        $showNotch
            ? `radial-gradient(circle var(--space-7) at 50% 0, transparent var(--space-7), ${theme.colors['grass3']} calc(var(--space-7)))`
            : theme.colors['grass3']};
`;

const NavContent = styled(Flex)`
    position: relative;
    min-height: var(--space-9);
    align-items: end;
`;

const CenterAction = styled(Box)`
    position: absolute;
    top: 0;
    left: 50%;
    transform: translate(-50%, -50%);
`;

const NavItems = styled(Flex)`
    width: 100%;
    align-items: end;
`;

const MobileNavItemButton = styled(NavButton)`
    width: 100%;
    min-height: var(--space-9);
    box-shadow: none;
`;

const MobileNavBar = () => {
    const location = useLocation();
    const { t } = useTranslation('common');
    const isSoloMode = useDashboardStore(selectIsSoloMode);
    const activeColor = isSoloMode ? 'violet' : 'green';
    const navElements = getNavElements(
        getPreferredModeRoute(isSoloMode),
    );

    const isVisibleExpenseButton = location.pathname !== ROUTES.SETTINGS;

    const renderNavItem = ({ labelKey, href, Icon }: NavElement) => {
        const isActive = location.pathname === href || location.pathname.startsWith(`${href}/`);

        return (
            <Box key={href} flexGrow="1">
                <MobileNavItemButton
                    to={href}
                    color={isActive ? activeColor : 'gray'}
                    radius="none"
                    variant={isActive ? 'solid' : 'surface'}
                >
                    <Flex direction="column" align="center" justify="center" gap="1" py="1">
                        <Icon size={20} />
                        <Text size="1" {...(!isActive && { color: 'gray' })}>
                            {t(labelKey)}
                        </Text>
                    </Flex>
                </MobileNavItemButton>
            </Box>
        );
    };

    return (
        <BoxWrapper
            display={{ initial: 'block', sm: 'none' }}
            position="fixed"
            bottom="0"
            left="0"
            right="0"
        >
            <NavSurface $showNotch={isVisibleExpenseButton} />

            <NavContent align="stretch">
                <NavItems justify="between" align="stretch">
                    {navElements.map(renderNavItem)}
                </NavItems>

                <CenterAction>
                    <AddExpenseButton type="mobile" />
                </CenterAction>
            </NavContent>
        </BoxWrapper>
    );
};

export default MobileNavBar;
