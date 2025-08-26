import { LucideLogIn, LucideUserRoundPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import { Avatar, Box, Button, Card, Flex, IconButton, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';
import { ROUTES } from 'constants/routes';
import { useAuthStore } from 'store/authStore';

import favicon from 'assets/favicon.png';

import AuthModal from './Modal/AuthModal';

const StickyBox = styled(Box)`
    background-color: var(--accent-2);
    position: sticky;
    top: 0;
    width: 100%;
`;

const Header = () => {
    const { isLoggedIn } = useAuthStore();

    return (
        <StickyBox>
            <Card>
                <Flex justify="between" align="center" p="4">
                    <Flex gap="4" align="center">
                        <Link to={isLoggedIn ? ROUTES.BALANCES : ROUTES.HOME}>
                            <Avatar src={favicon} fallback="C" radius="full" />
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
                                        Get started
                                        <LucideLogIn />
                                    </Button>
                                }
                            />
                        )}
                    </Flex>
                </Flex>
            </Card>
        </StickyBox>
    );
};

export default Header;
