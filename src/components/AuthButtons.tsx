import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button, Flex } from '@radix-ui/themes';

import { getSocialAuthUrl } from 'helpers/url';

import AppleIconSvg from 'assets/apple-icon.svg?react';
import GoogleIconSvg from 'assets/google-icon.svg?react';

const AuthButtons = () => {
    const { t } = useTranslation();

    return (
        <Flex direction="column" gap="3">
            <Button size="4" variant="classic" color="blue" radius="full" asChild>
                <Link to={getSocialAuthUrl('google')}>
                    <GoogleIconSvg width={18} height={18} />
                    {t('auth.button.google')}
                </Link>
            </Button>

            <Button size="4" variant="classic" color="gray" radius="full" disabled>
                <AppleIconSvg width={18} height={18} />
                {t('auth.button.apple')}
            </Button>
        </Flex>
    );
};

export default AuthButtons;
