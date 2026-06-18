import { useTranslation } from 'react-i18next';

import { Button, Flex } from '@radix-ui/themes';

import { getSocialAuthUrl } from 'helpers/url';
import { selectAuthLoginLoading, selectSetLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import AppleIconSvg from 'assets/apple-icon.svg?react';
import GoogleIconSvg from 'assets/google-icon.svg?react';

const AuthButtons = () => {
    const { t } = useTranslation('auth');
    const isGoogleLoginLoading = useLoadingStore(selectAuthLoginLoading);
    const setLoading = useLoadingStore(selectSetLoading);

    const handleGoogleSignIn = () => {
        const authUrl = getSocialAuthUrl('google');

        setLoading('auth', 'login', 'loading');
        window.location.assign(authUrl);
    };

    return (
        <Flex direction="column" gap="4">
            <Button
                size="4"
                variant="soft"
                color="blue"
                radius="full"
                loading={isGoogleLoginLoading}
                disabled={isGoogleLoginLoading}
                onClick={handleGoogleSignIn}
            >
                <GoogleIconSvg width={18} height={18} />
                {t('button.google')}
            </Button>

            <Button size="4" variant="soft" color="gray" radius="full" disabled>
                <AppleIconSvg width={18} height={18} />
                {t('button.apple')}
            </Button>
        </Flex>
    );
};

export default AuthButtons;
