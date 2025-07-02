import { Box, Card, Container, Flex, Grid, Heading, Text } from '@radix-ui/themes';

import Header from 'components/Header';

const HomePage = () => {
    return (
        <>
            <Header />
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
        </>
    );
};

export default HomePage;
