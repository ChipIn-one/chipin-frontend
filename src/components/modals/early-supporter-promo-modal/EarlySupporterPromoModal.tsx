import { LucideClock3, LucideCrown, LucideSparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, Badge, Button, Flex, Heading, Text } from '@radix-ui/themes';

import { SECOND } from 'constants/time';

import { BaseModal } from '../base-modal';
import { MODAL_SIZES, OverlayBody, OverlayFooter } from '../components';

import { useConnect } from './internal';

const EarlySupporterPromoModal = () => {
    const { t, i18n } = useTranslation('landing');
    const { isNewUser, subscriptionUntil, userId } = useConnect();
    const [dismissedUserId, setDismissedUserId] = useState<string | null>(null);

    if (
        isNewUser !== true ||
        userId === null ||
        subscriptionUntil === null ||
        dismissedUserId === userId
    ) {
        return null;
    }

    const expiryDate = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(new Date(subscriptionUntil * SECOND));

    const onOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            setDismissedUserId(userId);
        }
    };

    const thankYouAction = (
        <Button size="3" color="amber" highContrast onClick={() => onOpenChange(false)}>
            {t('promo.button')}
        </Button>
    );

    const content = (
        <>
            <OverlayBody>
                <Flex
                    direction="column"
                    align="center"
                    justify="center"
                    gap="4"
                    height="100%"
                    py={{ initial: '2', sm: '0' }}
                >
                    <Flex align="center" justify="center" gap="3">
                        <Text color="amber">
                            <LucideSparkles size={20} />
                        </Text>
                        <Avatar
                            size="8"
                            color="amber"
                            variant="soft"
                            radius="full"
                            fallback={<LucideCrown size={36} />}
                        />
                        <Text color="amber">
                            <LucideSparkles size={22} />
                        </Text>
                    </Flex>

                    <Flex direction="column" align="center" gap="2">
                        <Text
                            color="amber"
                            size={{ initial: '2', sm: '3' }}
                            weight="bold"
                            align="center"
                        >
                            {t('promo.label')}
                        </Text>
                        <Heading
                            as="h2"
                            size={{ initial: '7', sm: '8' }}
                            weight="bold"
                            align="center"
                        >
                            {t('promo.title')}
                        </Heading>
                    </Flex>

                    <Flex direction="column" align="center" gap="1">
                        <Text color="gray" size={{ initial: '3', sm: '4' }} align="center">
                            {t('promo.intro')}
                        </Text>
                        <Text color="gray" size={{ initial: '3', sm: '4' }} align="center">
                            {t('promo.benefit')}
                        </Text>
                    </Flex>

                    <Badge size="3" color="gray" variant="surface" radius="full">
                        <Flex align="center" gap="2">
                            <LucideClock3 size={16} />
                            {t('promo.expires', { date: expiryDate })}
                        </Flex>
                    </Badge>
                </Flex>
            </OverlayBody>

            <OverlayFooter cancelAction={null} primaryAction={thankYouAction} />
        </>
    );

    return (
        <BaseModal
            title={t('promo.modalTitle')}
            accessibleDescription={t('promo.benefit')}
            maxWidth={MODAL_SIZES.desktop}
            content={content}
            isOpened
            setIsOpened={onOpenChange}
        />
    );
};

export { EarlySupporterPromoModal };
