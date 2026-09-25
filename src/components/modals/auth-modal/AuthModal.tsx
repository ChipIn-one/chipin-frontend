import { LucideShieldLock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Flex, Text } from '@radix-ui/themes';

import AuthButtons from 'components/AuthButtons';

import SharedExpensesIllustration from 'assets/auth-shared-expenses.webp';

import { BaseModal } from '../base-modal';

import {
    AccentLine,
    ActionSection,
    AuthBody,
    AuthHeadline,
    AuthLayout,
    GoogleAction,
    HeroImage,
    IllustrationPanel,
} from './styled';

interface Props {
    children: React.ReactNode;
}

const AuthModal = ({ children }: Props) => {
    const { t } = useTranslation('auth');

    const content = (
        <AuthBody>
            <AuthLayout>
                <IllustrationPanel aria-hidden="true">
                    <HeroImage src={SharedExpensesIllustration} alt="" decoding="async" />
                </IllustrationPanel>

                <AuthHeadline as="h2" size={{ initial: '7', sm: '8' }} align="center">
                    <span>{t('modal.headlinePrimary')}</span>
                    <AccentLine>{t('modal.headlineAccent')}</AccentLine>
                </AuthHeadline>

                <ActionSection>
                    <GoogleAction>
                        <AuthButtons />
                    </GoogleAction>
                    <Flex align="center" justify="center" gap="2">
                        <Text color="gray">
                            <LucideShieldLock size={14} />
                        </Text>
                        <Text size="1" color="gray" align="center">
                            {t('modal.trust')}
                        </Text>
                    </Flex>
                </ActionSection>
            </AuthLayout>
        </AuthBody>
    );

    return (
        <BaseModal
            triggerElement={children}
            title={t('modal.title')}
            accessibleDescription={t('modal.trust')}
            content={content}
        />
    );
};

export default AuthModal;
