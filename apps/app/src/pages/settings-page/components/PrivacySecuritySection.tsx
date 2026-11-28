import { useState } from 'react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Avatar, Box, Button, Card, Flex, Grid, Separator, Skeleton, Text } from '@radix-ui/themes';
import { LogOutIcon, ShieldIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ONLINE_ONLY_ACTIONS } from 'constants/onlineOnlyActions';
import { resolveApiErrorMessageFromError } from 'helpers/errors';
import { useRequiresOnline } from 'hooks/useRequiresOnline';
import { useAuthStore } from 'store/authStore';

import { useSignOutConfirm } from 'components/sign-out-confirm';

interface Props {
    isLoading: boolean;
}

const PrivacySecuritySection = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');
    const logoutOtherDevices = useAuthStore(s => s.logoutOtherDevices);
    const { requestSignOut, dialog: signOutDialog } = useSignOutConfirm();
    const [isLoggingOutOtherDevices, setIsLoggingOutOtherDevices] = useState(false);
    // §2.9: a menu-like card button, so the flag is read here instead of an `<OnlineOnly>` wrapper.
    const isLogoutOtherDevicesBlocked = useRequiresOnline(ONLINE_ONLY_ACTIONS.logoutOtherDevices);

    const onLogoutOtherDevices = () => {
        if (isLoggingOutOtherDevices || isLogoutOtherDevicesBlocked) {
            return;
        }
        setIsLoggingOutOtherDevices(true);

        logoutOtherDevices()
            .then(() => {
                toast.success(t('toasts:settings.logoutOtherDevicesSuccess'));
            })
            .catch((error: unknown) => {
                toast.error(
                    resolveApiErrorMessageFromError(error, t('toasts:common.requestFailed')),
                );
            })
            .finally(() => {
                setIsLoggingOutOtherDevices(false);
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
                            color={PROP_COLOR.neutral}
                            fallback={<ShieldIcon size={20} />}
                        />
                    </Skeleton>
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('security.title')}</Skeleton>
                        </Text>
                        <Text size="2" color={PROP_COLOR.neutral}>
                            <Skeleton loading={isLoading}>{t('security.description')}</Skeleton>
                        </Text>
                    </Flex>
                </Flex>

                <Separator size="4" />

                <Grid columns={{ initial: '1', sm: '1' }} gap="3">
                    <Skeleton loading={isLoading}>
                        <Card asChild>
                            <button
                                onClick={onLogoutOtherDevices}
                                disabled={isLoggingOutOtherDevices || isLogoutOtherDevicesBlocked}
                                aria-busy={isLoggingOutOtherDevices}
                            >
                                <Flex gap="3" align="start">
                                    <LogOutIcon size={20} />
                                    <Box>
                                        <Text weight="medium" as="p">
                                            {t('security.logoutOtherDevicesTitle')}
                                        </Text>
                                        <Text size="2" color={PROP_COLOR.neutral} as="p">
                                            {isLogoutOtherDevicesBlocked
                                                ? t('common:outbox.onlineRequired')
                                                : t(
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
                </Grid>

                <Separator size="4" />

                <Flex justify="between" align="center" gap="3">
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('security.signOutTitle')}</Skeleton>
                        </Text>
                        <Text size="2" color={PROP_COLOR.neutral}>
                            <Skeleton loading={isLoading}>
                                {t('security.signOutDescription')}
                            </Skeleton>
                        </Text>
                    </Flex>
                    <Skeleton loading={isLoading}>
                        <Button onClick={requestSignOut} variant="soft" color={PROP_COLOR.neutral}>
                            <LogOutIcon size={16} />
                            {t('common:buttons.signOut')}
                        </Button>
                    </Skeleton>
                </Flex>
            </Flex>
            {signOutDialog}
        </Card>
    );
};

export default PrivacySecuritySection;
