import { LucideLogIn, LucideUserRoundPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import { Avatar, Box, Button, Flex, IconButton, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';
import { ROUTES } from 'constants/routes';
import { useAuthStore } from 'store/authStore';

import Logotype from 'assets/logo.svg?react';

import AuthModal from './Modal/AuthModal';

const StickyBox = styled(Box)`
    background-color: hsl(var(--accent-2) / 0.6);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    position: sticky;
    top: 0;
    width: 100%;
`;

const StyledLogotype = styled(Logotype)`
    width: 40px;
    height: 40px;
`;

const Header = () => {
    const { isLoggedIn } = useAuthStore();

    return (
        <StickyBox>
            <Flex justify="between" align="center" p="4">
                <Flex gap="4" align="center" justify="center">
                    <Link to={isLoggedIn ? ROUTES.BALANCES : ROUTES.HOME}>
                        <StyledLogotype />
                    </Link>
                    <Text size="6" weight="bold">
                        {PROJECT_NAME}
                    </Text>
                </Flex>
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
                                <Button size="3" variant="outline">
                                    Sign in
                                    <LucideLogIn />
                                </Button>
                            }
                        />
                    )}
                </Flex>
            </Flex>
        </StickyBox>
    );
};

export default Header;
