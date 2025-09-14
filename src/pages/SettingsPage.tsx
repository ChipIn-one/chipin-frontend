import { LucideBell, LucideShield, LucideUser } from 'lucide-react';
import { styled } from 'styled-components';

import { Avatar, Box, Card, Container, Flex, Separator, Switch, Text } from '@radix-ui/themes';

import BottomNavMobile from 'components/BottomNavMobile';
import Breadcrumbs from 'components/Breadcrumbs';

const SectionCard = styled(Card)`
    background-color: var(--color-panel);
    border: 1px solid var(--gray-6);
    border-radius: var(--radius-3);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
`;

const HeaderFlex = styled(Flex)`
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
`;

const RowFlex = styled(Flex)`
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-3);
`;

const SettingsPage = () => {
    return (
        <Box py="4">
            <Container size="4">
                <Breadcrumbs />

                <Flex direction="column" gap="4">
                    {/* Account */}
                    <Card>
                        <Flex direction="row" align="center" gap="3">
                            <Avatar
                                variant="soft"
                                size="3"
                                color="mint"
                                fallback={<LucideUser size={20} />}
                            />
                            <Box>
                                <Text weight="medium">Account</Text>
                                <Text size="2" color="gray" as="p">
                                    Personal information and profile settings
                                </Text>
                            </Box>
                        </Flex>
                        <Separator orientation="horizontal" size="4" decorative my="4" />
                        <Box mt="3">
                            <Text size="2" color="gray">
                                Account settings content...
                            </Text>
                        </Box>
                    </Card>

                    {/* Privacy */}
                    <Card>
                        <HeaderFlex>
                            <Avatar
                                variant="soft"
                                size="3"
                                color="mint"
                                fallback={<LucideShield size={20} />}
                            />

                            <Box>
                                <Text weight="medium">Privacy & Security</Text>
                                <Text size="2" color="gray" as="p">
                                    Control your privacy and security settings
                                </Text>
                            </Box>
                        </HeaderFlex>
                        <Separator orientation="horizontal" size="4" decorative my="4" />
                        <Box mt="3">
                            <Text size="2" color="gray">
                                Privacy settings content...
                            </Text>
                        </Box>
                    </Card>

                    {/* Notifications */}
                    <Card>
                        <HeaderFlex>
                            <Avatar
                                variant="soft"
                                size="3"
                                color="mint"
                                fallback={<LucideBell size={20} />}
                            />

                            <Box>
                                <Text weight="medium">Notifications</Text>
                                <Text size="2" color="gray" as="p">
                                    Manage how you receive notifications
                                </Text>
                            </Box>
                        </HeaderFlex>
                        <Separator orientation="horizontal" size="4" decorative my="4" />
                        <Box mt="3">
                            <RowFlex>
                                <Box>
                                    <Text weight="medium">Push Notifications</Text>
                                    <Text size="2" color="gray" as="p">
                                        Receive notifications on your device
                                    </Text>
                                </Box>
                                <Switch />
                            </RowFlex>
                            <RowFlex>
                                <Box>
                                    <Text weight="medium">Email Updates</Text>
                                    <Text size="2" color="gray" as="p">
                                        Get updates and news via email
                                    </Text>
                                </Box>
                                <Switch />
                            </RowFlex>
                        </Box>
                    </Card>
                </Flex>
                <BottomNavMobile />
            </Container>
        </Box>
    );
};

export default SettingsPage;
