import { LucideBell, LucideShield, LucideUser } from 'lucide-react';
import { styled } from 'styled-components';

import { Box, Card, Container, Flex, Separator, Switch, Text } from '@radix-ui/themes';

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
        <Box p="4">
            <Container size="4">
                <Breadcrumbs />
                {/* Account */}
                <SectionCard>
                    <HeaderFlex>
                        <LucideUser size={20} />
                        <Box>
                            <Text weight="medium">Account</Text>
                            <Text size="2" color="gray" as="p">
                                Personal information and profile settings
                            </Text>
                        </Box>
                    </HeaderFlex>
                    <Separator />
                    <Box mt="3">
                        <Text size="2" color="gray">
                            Account settings content...
                        </Text>
                    </Box>
                </SectionCard>

                {/* Privacy */}
                <SectionCard>
                    <HeaderFlex>
                        <LucideShield size={20} />
                        <Box>
                            <Text weight="medium">Privacy & Security</Text>
                            <Text size="2" color="gray" as="p">
                                Control your privacy and security settings
                            </Text>
                        </Box>
                    </HeaderFlex>
                    <Separator />
                    <Box mt="3">
                        <Text size="2" color="gray">
                            Privacy settings content...
                        </Text>
                    </Box>
                </SectionCard>

                {/* Notifications */}
                <SectionCard>
                    <HeaderFlex>
                        <LucideBell size={20} />
                        <Box>
                            <Text weight="medium">Notifications</Text>
                            <Text size="2" color="gray" as="p">
                                Manage how you receive notifications
                            </Text>
                        </Box>
                    </HeaderFlex>
                    <Separator />
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
                </SectionCard>
                <BottomNavMobile />
            </Container>
        </Box>
    );
};

export default SettingsPage;
