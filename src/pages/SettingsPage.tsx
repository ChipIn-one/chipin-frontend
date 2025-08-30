import {
    Box,
    Button,
    Card,
    Container,
    Flex,
    Grid,
    Heading,
    Section,
    Text,
    TextArea,
    TextField,
} from '@radix-ui/themes';

import { useAuthStore } from 'store/authStore';

import BottomNavMobile from 'components/BottomNavMobile';
import Header from 'components/Header';

const SettingsPage = () => {
    const { isLoggedIn } = useAuthStore();

    return (
        <>
            <Header />
            {isLoggedIn ? 'settings page' : 'Please log in to view your settings.'}

            <Section>
                <Container size="4">
                    <Flex direction="column" gap="1" mb="5">
                        <Heading
                            size={{
                                initial: '8',
                                md: '9',
                            }}
                        >
                            Settings
                        </Heading>
                        <Text color="gray" size={{ initial: '3', md: '4' }}>
                            Manage your account preferences and settings
                        </Text>
                    </Flex>

                    <Card>
                        <Accordion.Root type="single" collapsible defaultValue="account">
                            <Accordion.Item value="account">
                                <Accordion.Header asChild>
                                    <Flex align="center" justify="between" px="3" py="3">
                                        <Flex align="center" gap="3">
                                            <Box
                                                width="40px"
                                                height="40px"
                                                style={{
                                                    borderRadius: 10,
                                                    background: 'var(--gray-4)',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                }}
                                            >
                                                {/* <User size={20} /> */}
                                            </Box>
                                            <Box>
                                                <Text size="5" weight="bold">
                                                    Account
                                                </Text>
                                                <Text size="2" color="gray">
                                                    Personal information and profile settings
                                                </Text>
                                            </Box>
                                        </Flex>

                                        <Accordion.Trigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="1"
                                                radius="full"
                                                aria-label="Toggle section"
                                            >
                                                <ChevronDown />
                                            </Button>
                                        </Accordion.Trigger>
                                    </Flex>
                                </Accordion.Header>

                                <Accordion.Content asChild>
                                    <Box px="3" pb="4">
                                        <form onSubmit={e => e.preventDefault()}>
                                            <Flex direction="column" gap="4">
                                                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                                                    <Box>
                                                        <Text
                                                            as="label"
                                                            htmlFor="firstName"
                                                            size="2"
                                                            color="gray"
                                                        >
                                                            First Name
                                                        </Text>
                                                        <TextField.Root
                                                            id="firstName"
                                                            placeholder="John"
                                                            defaultValue="John"
                                                            size="3"
                                                        />
                                                    </Box>

                                                    <Box>
                                                        <Text
                                                            as="label"
                                                            htmlFor="lastName"
                                                            size="2"
                                                            color="gray"
                                                        >
                                                            Last Name
                                                        </Text>
                                                        <TextField.Root
                                                            id="lastName"
                                                            placeholder="Doe"
                                                            defaultValue="Doe"
                                                            size="3"
                                                        />
                                                    </Box>
                                                </Grid>

                                                <Box>
                                                    <Text
                                                        as="label"
                                                        htmlFor="email"
                                                        size="2"
                                                        color="gray"
                                                    >
                                                        Email Address
                                                    </Text>
                                                    <TextField.Root
                                                        id="email"
                                                        type="email"
                                                        placeholder="john.doe@example.com"
                                                        defaultValue="john.doe@example.com"
                                                        size="3"
                                                    />
                                                </Box>

                                                <Box>
                                                    <Text
                                                        as="label"
                                                        htmlFor="bio"
                                                        size="2"
                                                        color="gray"
                                                    >
                                                        Bio
                                                    </Text>
                                                    <TextArea
                                                        id="bio"
                                                        rows={6}
                                                        placeholder="Tell us about yourself..."
                                                        size="3"
                                                    />
                                                </Box>

                                                <Flex>
                                                    <Button type="submit" variant="soft">
                                                        Save Changes
                                                    </Button>
                                                </Flex>
                                            </Flex>
                                        </form>
                                    </Box>
                                </Accordion.Content>
                            </Accordion.Item>
                        </Accordion.Root>
                    </Card>
                </Container>
            </Section>

            <BottomNavMobile />
        </>
    );
};

export default SettingsPage;
