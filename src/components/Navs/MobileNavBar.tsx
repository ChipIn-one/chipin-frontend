import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { Box, Button, Flex, Text } from '@radix-ui/themes';

import { NAV_ELEMENTS } from './constants';

const BoxWrapper = styled(Box)`
    background-color: ${({ theme }) => theme.colors.grass3};
`;

const NavButton = styled(Button)`
    width: 100%;
    height: 100%;
    box-shadow: none;
`;

const MobileNavBar = () => {
    const location = useLocation();

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
                            <Link to={href}>
                                <NavButton
                                    radius="none"
                                    variant={isActive ? 'soft' : 'surface'}
                                    {...(!isActive && { color: 'gray' })}
                                >
                                    <Flex
                                        direction="column"
                                        align="center"
                                        justify="center"
                                        gap="1"
                                        py="1"
                                    >
                                        <Icon size={20} />
                                        <Text size="1" {...(!isActive && { color: 'gray' })}>
                                            {label}
                                        </Text>
                                    </Flex>
                                </NavButton>
                            </Link>
                        </Box>
                    );
                })}
            </Flex>
        </BoxWrapper>
    );
};

export default MobileNavBar;
