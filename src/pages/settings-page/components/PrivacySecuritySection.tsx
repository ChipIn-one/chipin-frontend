import { LucideDownload, LucideLogOut, LucideShield, LucideTrash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Avatar, Box, Button, Card, Flex, Grid, Separator, Skeleton, Text } from '@radix-ui/themes';

import { resolveApiErrorMessageFromError } from 'helpers/errors';
import { useAuthStore } from 'store/authStore';
import {
    selectAuthLogoutOtherDevicesLoading,
    selectAuthSignOutLoading,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

interface Props {
    isLoading: boolean;
}

const PrivacySecuritySection = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');
    const logoutOtherDevices = useAuthStore(s => s.logoutOtherDevices);
    const signOut = useAuthStore(s => s.signOut);
    const isSigningOut = useLoadingStore(selectAuthSignOutLoading);
    const isLoggingOutOtherDevices = useLoadingStore(
        selectAuthLogoutOtherDevicesLoading,
    );

    const onDeleteAccount = () => {
        toast.info(t('toasts:settings.deleteAccountSoon'));
    };

    const onLogoutOtherDevices = () => {
        if (isLoggingOutOtherDevices) {
            return;
        }

        logoutOtherDevices()
            .then(() => {
                toast.success(t('toasts:settings.logoutOtherDevicesSuccess'));
            })
            .catch((error: unknown) => {
                toast.error(resolveApiErrorMessageFromError(
                    error,
                    t('toasts:common.requestFailed'),
                ));
            });
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
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('security.title')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('security.description')}
                            </Skeleton>
                        </Text>
                    </Flex>
                </Flex>

                <Separator size="4" />

                <Grid columns={{ initial: '1', sm: '3' }} gap="3">
                    <Skeleton loading={isLoading}>
                        <Card asChild>
                            <button
                                onClick={onLogoutOtherDevices}
                                disabled={isLoggingOutOtherDevices}
                                aria-busy={isLoggingOutOtherDevices}
                            >
                                <Flex gap="3" align="start">
                                    <LucideLogOut size={20} />
                                    <Box>
                                        <Text weight="medium" as="p">
                                            {t('security.logoutOtherDevicesTitle')}
                                        </Text>
                                        <Text size="2" color="gray" as="p">
                                            {t(
                                                isLoggingOutOtherDevices
                                                    ? 'security.logoutOtherDevicesLoading'
                                                    : 'security.logoutOtherDevicesDescription',
                                            )}
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
                            <button onClick={onDeleteAccount}>
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
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('security.signOutTitle')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('security.signOutDescription')}
                            </Skeleton>
                        </Text>
                    </Flex>
                    <Skeleton loading={isLoading}>
                        <Button
                            onClick={signOut}
                            variant="soft"
                            color="gray"
                            loading={isSigningOut}
                        >
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
