import { useState } from 'react';
import { Button, Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { getSocialAuthUrl } from 'helpers/url';

import GoogleIconSvg from 'assets/google-icon.svg?react';

const AuthButtons = () => {
    const { t } = useTranslation('auth');
    // Set while the browser leaves for the provider; the page unloads, nothing resets it.
    const [isGoogleLoginLoading, setIsGoogleLoginLoading] = useState(false);

    const handleGoogleSignIn = () => {
        const authUrl = getSocialAuthUrl('google');

        setIsGoogleLoginLoading(true);
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
        </Flex>
    );
};

export default AuthButtons;
