import { LucideLogIn, LucideUserRoundPlus } from 'lucide-react';
import styled from 'styled-components';

import { Avatar, Box, Button, Container, Flex, IconButton, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';
import { ROUTES } from 'constants/routes';
import { useAuthStore } from 'store/authStore';

import { EmptyRouteLink } from 'basics/EmptyRouteLink';

import Logotype from 'assets/logo.svg?react';

import AuthModal from './Modal/AuthModal';

const StickyBox = styled(Box)`
    position: sticky;
    top: 0;
    width: 100%;
    z-index: 1;

    border-bottom: 1px solid var(--accent-6);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
`;

const StyledLogotype = styled(Logotype)`
    width: 40px;
    height: 40px;
`;

const Header = () => {
    const { isLoggedIn } = useAuthStore();

    return (
        <StickyBox>
            <Container size="4" p="4">
                <Flex justify="between" align="center">
                    <EmptyRouteLink to={isLoggedIn ? ROUTES.BALANCES : ROUTES.HOME}>
                        <Flex gap="4" align="center" justify="center">
                            <StyledLogotype />

                            <Text size="6" weight="bold">
                                {PROJECT_NAME}
                            </Text>
                        </Flex>
                    </EmptyRouteLink>

                    <Flex gap="4" align="center">
                        {isLoggedIn ? (
                            <Flex gap="4" align="center">
                                <Box display={{ initial: 'block', md: 'none' }}>
                                    <IconButton variant="ghost">
                                        <LucideUserRoundPlus />
                                    </IconButton>
                                </Box>
                                <Box display={{ initial: 'none', md: 'block' }}>
                                    <Avatar
                                        size="3"
                                        src="https://images.unsplash.com/photo-1607346256330-dee7af15f7c5?&w=64&h=64&dpr=2&q=70&crop=focalpoint&fp-x=0.67&fp-y=0.5&fp-z=1.4&fit=crop"
                                        radius="full"
                                        fallback="A"
                                    />
                                </Box>
                            </Flex>
                        ) : (
                            <AuthModal
                                triggerElement={
                                    <Button
                                        size={{
                                            initial: '2',
                                            sm: '3',
                                        }}
                                        variant="outline"
                                    >
                                        Sign in
                                        <LucideLogIn />
                                    </Button>
                                }
                            />
                        )}
                    </Flex>
                </Flex>
            </Container>
        </StickyBox>
    );
};

export default Header;
