import { LucideDownload, LucideLogOut, LucideShield, LucideTrash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Avatar, Box, Button, Card, Flex, Grid, Separator, Skeleton, Text } from '@radix-ui/themes';

import { useAuthStore } from 'store/authStore';

interface Props {
    isLoading: boolean;
}

const PrivacySecuritySection = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');
    const { signOut } = useAuthStore();

    const handleLogoutAllDevices = () => {
        toast.info(t('toasts:settings.logoutAllDevicesSoon'));
    };

    const handleDeleteAccount = () => {
        toast.info(t('toasts:settings.deleteAccountSoon'));
    };

    return (
        <Card size="3">
            <Flex direction="column" gap="4">
                <Flex align="center" gap="3">
                    <Skeleton loading={isLoading}>
                        <Avatar
                            variant="soft"
                            size="3"
                            color="mint"
                            fallback={<LucideShield size={20} />}
                        />
                    </Skeleton>
                    <Box>
                        <Skeleton loading={isLoading}>
                            <Text weight="medium">{t('security.title')}</Text>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray" as="p">
                                {t('security.description')}
                            </Text>
                        </Skeleton>
                    </Box>
                </Flex>

                <Separator size="4" />

                <Grid columns={{ initial: '1', sm: '3' }} gap="3">
                    <Skeleton loading={isLoading}>
                        <Card asChild>
                            <button onClick={handleLogoutAllDevices}>
                                <Flex gap="3" align="start">
                                    <LucideLogOut size={20} />
                                    <Box>
                                        <Text weight="medium" as="p">
                                            {t('security.logoutAllDevicesTitle')}
                                        </Text>
                                        <Text size="2" color="gray" as="p">
                                            {t('security.logoutAllDevicesDescription')}
                                        </Text>
                                    </Box>
                                </Flex>
                            </button>
                        </Card>
                    </Skeleton>

                    <Skeleton loading={isLoading}>
                        <Card>
                            <Flex gap="3" align="start">
                                <LucideDownload size={20} />
                                <Box>
                                    <Text weight="medium" as="p">
                                        {t('security.exportDataTitle')}
                                    </Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('security.exportDataDescription')}
                                    </Text>
                                </Box>
                            </Flex>
                        </Card>
                    </Skeleton>

                    <Skeleton loading={isLoading}>
                        <Card asChild>
                            <button onClick={handleDeleteAccount}>
                                <Flex gap="3" align="start">
                                    <LucideTrash2 size={20} color="var(--red-11)" />
                                    <Box>
                                        <Text weight="medium" color="red" as="p">
                                            {t('security.deleteAccountTitle')}
                                        </Text>
                                        <Text size="2" color="gray" as="p">
                                            {t('security.deleteAccountDescription')}
                                        </Text>
                                    </Box>
                                </Flex>
                            </button>
                        </Card>
                    </Skeleton>
                </Grid>

                <Separator size="4" />

                <Flex justify="between" align="center" gap="3">
                    <Box>
                        <Skeleton loading={isLoading}>
                            <Text weight="medium">{t('security.signOutTitle')}</Text>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray" as="p">
                                {t('security.signOutDescription')}
                            </Text>
                        </Skeleton>
                    </Box>
                    <Skeleton loading={isLoading}>
                        <Button onClick={signOut} variant="soft" color="gray">
                            <LucideLogOut size={16} />
                            {t('common:buttons.signOut')}
                        </Button>
                    </Skeleton>
                </Flex>
            </Flex>
        </Card>
    );
};

export default PrivacySecuritySection;
