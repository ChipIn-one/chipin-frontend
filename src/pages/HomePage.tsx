import { Link } from 'react-router-dom';

import { Box, Button, Card, Container, Flex, Grid, Heading, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';
import { ROUTES } from 'constants/routes';

import PWABadge from 'basics/PWABadge';

const HomePage = () => {
    return (
        <>
            <Box position="sticky" top="0" width="100%">
                <Flex justify="between" align="center" p="4">
                    <Text size="4" weight="bold">
                        {PROJECT_NAME}
                    </Text>
                    <Flex gap="4" align="center">
                        <Button variant="ghost" asChild>
                            <Link to={ROUTES.LOG_IN}>Log in</Link>
                        </Button>
                        <Button variant="solid">Sign up</Button>
                    </Flex>
                </Flex>
            </Box>
            <Box py="8">
                <Container size="3">
                    <Flex direction="column" align="center" gap="4">
                        <Heading size="8" align="center">
                            Less stress when
                            <br />
                            sharing expenses
                        </Heading>
                        <Text align="center" size="4" color="gray">
                            Keep track of your shared expenses with housemates, friends and more.
                        </Text>
                        <Button size="4">Sign up</Button>
                    </Flex>
                </Container>
            </Box>
            <Box py="8">
                <Container size="3">
                    <Flex direction="column" align="center" gap="4">
                        <Heading size="8" align="center">
                            Less stress when
                            <br />
                            sharing expenses
                        </Heading>
                        <Text align="center" size="4" color="gray">
                            Keep track of your shared expenses with housemates, friends and more.
                        </Text>
                        <Button size="4">Sign up</Button>
                    </Flex>
                </Container>
            </Box>
            <Box py="8">
                <Container size="3">
                    <Flex direction="column" align="center" gap="4">
                        <Heading size="8" align="center">
                            Less stress when
                            <br />
                            sharing expenses
                        </Heading>
                        <Text align="center" size="4" color="gray">
                            Keep track of your shared expenses with housemates, friends and more.
                        </Text>
                        <Button size="4">Sign up</Button>
                    </Flex>
                </Container>
            </Box>

            <Box py="6" px="4">
                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                    <Card>
                        <Text size="5" weight="bold">
                            Track balances
                        </Text>
                        <Text color="gray">Keep track of who owes whom.</Text>
                    </Card>
                    <Card>
                        <Text size="5" weight="bold">
                            Organize expenses
                        </Text>
                        <Text color="gray">Split costs by trips, friends, or housemates.</Text>
                    </Card>
                </Grid>
            </Box>
            <PWABadge />
        </>
    );
};

export default HomePage;
