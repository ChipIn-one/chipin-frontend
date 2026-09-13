import { LucideCrown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Dialog, Flex, Text } from '@radix-ui/themes';

import { formatActivityAbsoluteDate } from 'helpers/time';
import { useUsersStore } from 'store/users-store';

import { BaseModal } from '../base-modal';

const PremiumLaunchPromoModal = () => {
    const { i18n, t } = useTranslation('common');
    const user = useUsersStore(state => state.user);
    const [isDismissed, setIsDismissed] = useState(false);

    if (
        !user ||
        user.isPremium !== true ||
        typeof user.premiumExpiresAt !== 'number'
    ) {
        return null;
    }

    const expirationDate = formatActivityAbsoluteDate(
        user.premiumExpiresAt,
        i18n.resolvedLanguage || i18n.language,
    );

    return (
        <BaseModal
            title={t('premiumLaunchPromo.title')}
            accessibleDescription={t('premiumLaunchPromo.accessibleDescription')}
            isOpened={!isDismissed}
            setIsOpened={isOpen => {
                if (!isOpen) {
                    setIsDismissed(true);
                }
            }}
            content={
                <Flex direction="column" gap="4">
                    <Flex align="center" gap="2">
                        <LucideCrown aria-hidden="true" />
                        <Text size="4" weight="medium">
                            {t('premiumLaunchPromo.earlyUser')}
                        </Text>
                    </Flex>
                    <Text size="5" weight="bold">
                        {t('premiumLaunchPromo.reward')}
                    </Text>
                    <Text color="gray">
                        {t('premiumLaunchPromo.expires', { date: expirationDate })}
                    </Text>
                    <Dialog.Close>
                        <Button size="3">{t('premiumLaunchPromo.continue')}</Button>
                    </Dialog.Close>
                </Flex>
            }
        />
    );
};

export default PremiumLaunchPromoModal;
