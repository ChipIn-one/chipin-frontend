import { Link } from 'react-router-dom';

import { Avatar, Box, Flex, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';
import { ROUTES } from 'constants/routes';

import favicon from 'assets/favicon.png';

import AuthModal from './Modal/components/AuthModal';

const Header = () => {
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
                    <AuthModal />
                </Flex>
            </Flex>
        </Box>
    );
};

export default Header;
