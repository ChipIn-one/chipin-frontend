import { LucideChartBar, LucideChartPie, LucideSettings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { Box, Button, Flex, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';

const NAV_ELEMENTS = [
    {
        label: 'Dashboard',
        href: ROUTES.DASHBOARD,
        Icon: LucideChartPie,
    },
    {
        label: 'Activity',
        href: ROUTES.ACTIVITY,
        Icon: LucideChartBar,
    },
    {
        label: 'Settings',
        href: ROUTES.SETTINGS,
        Icon: LucideSettings,
    },
];

const BoxWrapper = styled(Box)`
    background: ${({ theme }) => theme.colors.indigo2};
`;

const NavButton = styled(Button)`
    width: 100%;
    height: 100%;
    box-shadow: none;
`;

const MobileNavigationBar = () => {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <BoxWrapper
            display={{ initial: 'block', sm: 'none' }}
            position="fixed"
            bottom="0"
            left="0"
            right="0"
        >
            <Flex justify="between" align="center">
                {NAV_ELEMENTS.map(({ label, href, Icon }) => {
                    const isActive =
                        location.pathname === href || location.pathname.startsWith(`${href}/`);

                    return (
                        <Box key={href} flexGrow="1">
                            <NavButton
                                onClick={() => navigate(href)}
                                radius="none"
                                variant={isActive ? 'classic' : 'surface'}
                                {...(!isActive && { color: 'gray' })}
                            >
                                <Flex
                                    direction="column"
                                    align="center"
                                    justify="center"
                                    gap="1"
                                    pt="2"
                                    pb="2"
                                >
                                    <Icon size={24} strokeWidth={isActive ? 2.5 : 1.5} />
                                    <Text
                                        size="2"
                                        weight={isActive ? 'medium' : 'regular'}
                                        {...(!isActive && { color: 'gray' })}
                                    >
                                        {label}
                                    </Text>
                                </Flex>
                            </NavButton>
                        </Box>
                    );
                })}
            </Flex>
        </BoxWrapper>
    );
};

export default MobileNavigationBar;
