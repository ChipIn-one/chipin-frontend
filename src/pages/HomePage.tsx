// HomePage.tsx
import styled from 'styled-components';

import { Box, Button, Card, Container, Flex, Grid, Heading, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';

import Footer from 'components/Footer';
import Header from 'components/Header';

const Placeholder = styled.div`
    width: 100%;
    min-height: 280px;
    border-radius: 16px;
    background: var(--gray-3);
    border: 1px solid var(--gray-6);
    display: grid;
    place-items: center;
    color: var(--gray-11);
    font-size: 14px;
`;

const HomePage = () => {
    return (
        <>
            <Header />

            {/* Hero */}
            <Box py="8" px="4">
                <Container size="3">
                    <Flex direction="column" align="center" gap="5">
                        <Heading size="9" align="center">
                            {PROJECT_NAME} — share expenses without stress
                        </Heading>
                        <Text align="center" size="5" color="gray">
                            Create groups, add expenses, and see who owes whom — fast and fair.
                            Perfect for trips, roommates and friends.
                        </Text>
                        <Button size="3" radius="full">
                            Get started
                        </Button>
                        <Placeholder aria-label="App preview placeholder">App preview</Placeholder>
                    </Flex>
                </Container>
            </Box>

            {/* Features overview */}
            <Box py="8" px="4">
                <Container size="3">
                    <Heading size="7" align="center" mb="6">
                        Core features
                    </Heading>

                    <Grid columns={{ initial: '1', md: '3' }} gap="6">
                        <Card>
                            <Flex direction="column" gap="3">
                                <Text size="5" weight="bold">
                                    Groups
                                </Text>
                                <Text color="gray">
                                    Create / edit / delete groups. Invite members via link. Shared
                                    group page with balances.
                                </Text>
                            </Flex>
                        </Card>

                        <Card>
                            <Flex direction="column" gap="3">
                                <Text size="5" weight="bold">
                                    Expenses
                                </Text>
                                <Text color="gray">
                                    Add / edit / delete expenses. Attach to group & users. Split
                                    equally or by fixed shares.
                                </Text>
                            </Flex>
                        </Card>

                        <Card>
                            <Flex direction="column" gap="3">
                                <Text size="5" weight="bold">
                                    Balances & Settlements
                                </Text>
                                <Text color="gray">
                                    Auto-calculate who owes whom. Summary page of totals. One-tap
                                    debt “cleanup”.
                                </Text>
                            </Flex>
                        </Card>
                    </Grid>
                </Container>
            </Box>

            {/* Groups section */}
            <Box py="8" px="4">
                <Container size="3">
                    <Grid columns={{ initial: '1', md: '2' }} gap="6" align="center">
                        <Flex direction="column" gap="3">
                            <Heading size="7">Manage groups with links</Heading>
                            <Text size="4" color="gray">
                                Organize trips, households, or events. Share an invite link, and
                                keep balances visible to everyone.
                            </Text>
                        </Flex>
                        <Placeholder aria-label="Groups screenshot placeholder">
                            Groups screenshot
                        </Placeholder>
                    </Grid>
                </Container>
            </Box>

            {/* Expenses section */}
            <Box py="8" px="4">
                <Container size="3">
                    <Grid columns={{ initial: '1', md: '2' }} gap="6" align="center">
                        <Placeholder aria-label="Expenses screenshot placeholder">
                            Expenses screenshot
                        </Placeholder>
                        <Flex direction="column" gap="3">
                            <Heading size="7">Fast expense entry</Heading>
                            <Text size="4" color="gray">
                                Attach expenses to people and groups, split evenly or by custom
                                shares. Edit anytime.
                            </Text>
                        </Flex>
                    </Grid>
                </Container>
            </Box>

            {/* Balances section */}
            <Box py="8" px="4">
                <Container size="3">
                    <Grid columns={{ initial: '1', md: '2' }} gap="6" align="center">
                        <Flex direction="column" gap="3">
                            <Heading size="7">Clear & settle balances</Heading>
                            <Text size="4" color="gray">
                                See who owes whom across all expenses, then settle up and keep the
                                slate clean. Multi-currency support included.
                            </Text>
                        </Flex>
                        <Placeholder aria-label="Balances screenshot placeholder">
                            Balances screenshot
                        </Placeholder>
                    </Grid>
                </Container>
            </Box>

            <Footer />
        </>
    );
};

export default HomePage;
