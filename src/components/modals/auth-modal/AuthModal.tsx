import { LucideLock, LucideReceiptText, LucideUser } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Flex, Text } from '@radix-ui/themes';

import AuthButtons from 'components/AuthButtons';

import { BaseModal } from '../base-modal';

import {
    AccentLine,
    ActionSection,
    AuthBody,
    AuthHeadline,
    AuthLayout,
    ConnectionLeft,
    ConnectionRight,
    ConnectionTop,
    GoogleAction,
    HeroIllustration,
    LeftAvatar,
    ReceiptNode,
    RightAvatar,
    TopAvatar,
} from './styled';

interface Props {
    children: React.ReactNode;
}

const AuthModal = ({ children }: Props) => {
    const { t } = useTranslation('auth');

    const content = (
        <AuthBody>
            <AuthLayout>
                <HeroIllustration>
                    <ConnectionTop />
                    <ConnectionLeft />
                    <ConnectionRight />

                    <ReceiptNode>
                        <LucideReceiptText size={34} strokeWidth={1.8} />
                    </ReceiptNode>

                    <TopAvatar>
                        <Avatar
                            size="4"
                            variant="soft"
                            color="grass"
                            radius="full"
                            fallback={<LucideUser size={17} />}
                        />
                    </TopAvatar>
                    <LeftAvatar>
                        <Avatar
                            size="4"
                            variant="soft"
                            color="blue"
                            radius="full"
                            fallback={<LucideUser size={17} />}
                        />
                    </LeftAvatar>
                    <RightAvatar>
                        <Avatar
                            size="4"
                            variant="soft"
                            color="violet"
                            radius="full"
                            fallback={<LucideUser size={17} />}
                        />
                    </RightAvatar>
                </HeroIllustration>

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
                            <LucideLock size={14} />
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
