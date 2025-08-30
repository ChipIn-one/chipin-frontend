// HomePage.tsx
import {
    LucideDownload,
    LucideLogIn,
    LucideReceipt,
    LucideStar,
    LucideUserCheck,
    LucideUsers2,
} from 'lucide-react';
import styled from 'styled-components';

import { blueDark, greenDark, violetDark } from '@radix-ui/colors';
import {
    Badge,
    Box,
    Button,
    Card,
    Container,
    Flex,
    Grid,
    Heading,
    Section,
    Text,
} from '@radix-ui/themes';

import { hexToRgba } from 'helpers/colors';
import { usePwaStore } from 'store/pwaStore';

import Footer from 'components/Footer';
import Header from 'components/Header';
import { AuthModal } from 'components/Modal';

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

const StyledBox = styled(Box)`
    background-image: radial-gradient(
            circle at 20% 20%,
            ${hexToRgba(blueDark.blue9, 0.18)},
            transparent 40%
        ),
        radial-gradient(circle at 80% 30%, ${hexToRgba(greenDark.green9, 0.18)}, transparent 40%),
        radial-gradient(circle at 40% 80%, ${hexToRgba(violetDark.violet9, 0.14)}, transparent 40%);
`;

// const HeroSection = styled(Section)`
//     background: radial-gradient(ellipse at top, rgba(99, 102, 241, 0.2), transparent),
//         radial-gradient(ellipse at bottom, rgba(16, 185, 129, 0.2), transparent), #0f172a;

//     background: repeating-linear-gradient(
//             45deg,
//             rgba(139, 92, 246, 0.1) 0 2px,
//             transparent 2px 40px
//         ),
//         linear-gradient(to bottom, #0f172a, #1e293b);

//     background: repeating-linear-gradient(
//             -45deg,
//             rgba(16, 185, 129, 0.1) 0 4px,
//             transparent 4px 40px
//         ),
//         linear-gradient(to top, #0f172a, #1e293b);

//     background: radial-gradient(circle at 10% 20%, rgba(244, 63, 94, 0.12), transparent 30%),
//         radial-gradient(circle at 80% 70%, rgba(16, 185, 129, 0.12), transparent 40%),
//         radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.1), transparent 45%), #0f172a;

//     background: radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.2), transparent 50%),
//         radial-gradient(circle at 70% 80%, rgba(16, 185, 129, 0.15), transparent 50%),
//         linear-gradient(to bottom, #0f172a, #111827);
// `;

const HomePage = () => {
    const { isPwaCanBeInstalled, callPWAInstall } = usePwaStore();

    const benefits = [
        {
            title: '50K+',
            description: 'Active users',
            icon: <LucideUserCheck />,
        },
        {
            title: '2M+',
            description: 'Expenses tracked',
            icon: <LucideReceipt />,
        },
        {
            title: '15K+',
            description: 'Groups created',
            icon: <LucideUsers2 />,
        },
        {
            title: '4.9',
            description: 'User rating',
            icon: <LucideStar />,
        },
    ];

    return (
        <StyledBox>
            <Header />
            <Section px="4">
                <Container size="4">
                    <Flex direction="column" align="center" gap="5">
                        <Badge
                            size={{
                                initial: '1',
                                sm: '2',
                                md: '3',
                            }}
                            color="green"
                            variant="solid"
                        >
                            Share expenses without stress
                        </Badge>
                        <Heading
                            size={{
                                initial: '8',
                                md: '9',
                            }}
                        >
                            Split bills with
                        </Heading>
                        <Heading
                            size={{
                                initial: '8',
                                md: '9',
                            }}
                            color="green"
                        >
                            friends & family
                        </Heading>
                    </Flex>
                </Container>

                <Container size="2" align="center" py="8">
                    <Flex direction="column" align="center" gap="6">
                        <Text
                            align="center"
                            size={{
                                initial: '3',
                                sm: '4',
                                md: '6',
                            }}
                        >
                            Create groups, add expenses, and see who owes whom — fast and fair.
                            Perfect for trips, roommates, and group activities.
                        </Text>

                        <Flex gap="4">
                            <AuthModal
                                triggerElement={
                                    <Button
                                        size={{
                                            initial: '2',
                                            sm: '3',
                                        }}
                                        variant="soft"
                                    >
                                        Get started
                                        <LucideLogIn />
                                    </Button>
                                }
                            />

                            {!isPwaCanBeInstalled && (
                                <Button
                                    size={{
                                        initial: '2',
                                        sm: '3',
                                    }}
                                    variant="outline"
                                    onClick={callPWAInstall}
                                >
                                    Install app
                                    <LucideDownload />
                                </Button>
                            )}
                        </Flex>
                    </Flex>
                </Container>

                <Container size="3" px="6" py="2">
                    <Flex wrap="wrap" gap="6" justify="between" align="center">
                        {benefits.map(({ title, description, icon }, index) => (
                            <Flex key={index} direction="column" align="center" flexGrow="1">
                                <Text size="6" weight="bold" color="green">
                                    <Flex align="center" gap="1">
                                        {icon}
                                        {title}
                                    </Flex>
                                </Text>
                                <Text size="3" color="gray">
                                    {description}
                                </Text>
                            </Flex>
                        ))}{' '}
                    </Flex>
                </Container>
            </Section>

            {/* Hero */}
            {/* <Background /> */}

            {/* Features overview */}

            <Box py="8" px="4">
                <Container size="4">
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
                <Container size="4">
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
                <Container size="4">
                    <Grid columns={{ initial: '1', md: '2' }} gap="6" align="center">
                        <Placeholder aria-label="Expenses screenshot placeholder">
                            Expenses screenshot
                        </Placeholder>
                        <Flex direction="column" gap="3">
                            <Heading size="7">Fast expense entry</Heading>
                            <Text size="4">
                                Attach expenses to people and groups, split evenly or by custom
                                shares. Edit anytime.
                            </Text>
                        </Flex>
                    </Grid>
                </Container>
            </Box>

            {/* Balances section */}
            <Section py="8" px="4">
                <Container size="4">
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
            </Section>

            <Footer />
        </StyledBox>
    );
};

export default HomePage;
