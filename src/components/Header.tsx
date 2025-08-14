import { Link } from 'react-router-dom';

import { Avatar, Box, Card, Flex, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';
import { ROUTES } from 'constants/routes';
import { useAuthStore } from 'store/authStore';

import favicon from 'assets/favicon.png';

import AuthModal from './Modal/AuthModal';

const Header = () => {
    const { isLoggedIn } = useAuthStore();

    return (
        <Box position="sticky" top="0" width="100%">
            <Flex justify="between" align="center" p="4">
                <Flex gap="4" align="center">
                    <Link to={ROUTES.HOME}>
                        <Avatar src={favicon} fallback="C" radius="full" />
                    </Link>
                    <Text size="6" weight="bold">
                        {PROJECT_NAME}
                    </Text>
                </Flex>
                <Flex gap="4" align="center">
                    {isLoggedIn ? (
                        <Link to={ROUTES.BALANCES}>
                            <Card>
                                <Flex gap="4" align="center">
                                    <Avatar
                                        size="3"
                                        src="https://images.unsplash.com/photo-1607346256330-dee7af15f7c5?&w=64&h=64&dpr=2&q=70&crop=focalpoint&fp-x=0.67&fp-y=0.5&fp-z=1.4&fit=crop"
                                        radius="full"
                                        fallback="A"
                                    />
                                    <Box>
                                        <Text as="div" size="2" weight="bold">
                                            Name
                                        </Text>
                                    </Box>
                                </Flex>
                            </Card>
                        </Link>
                    ) : (
                        <AuthModal />
                    )}
                </Flex>
            </Flex>
        </Box>
    );
};

export default Header;
