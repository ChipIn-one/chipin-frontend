import { LucideAlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button, Flex, Heading, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';

const Page404 = () => {
    return (
        <Flex direction="column" align="center" justify="center" height="100vh" p="4" gap="4">
            <LucideAlertTriangle size={64} strokeWidth={1.5} />
            <Heading size="8" mb="2">
                Oops!
            </Heading>
            <Text size="4" mb="4" weight="medium">
                Looks like you’re lost
            </Text>
            <Link to={ROUTES.HOME}>
                <Button size="4" variant="solid">
                    Back to Home
                </Button>
            </Link>
        </Flex>
    );
};

export default Page404;
