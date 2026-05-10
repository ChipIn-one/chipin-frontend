import { LucideReceiptText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Flex, Text } from '@radix-ui/themes';

import AuthButtons from 'components/AuthButtons';

import BaseModal from './BaseModal';

interface Props {
    children: React.ReactNode;
}

const AuthModal = ({ children }: Props) => {
    const { t } = useTranslation('auth');

    const modalTitle = (
        <Flex align="center" gap="3">
            <Avatar
                size="4"
                variant="soft"
                color="jade"
                fallback={<LucideReceiptText size={20} />}
            />
            <Text size="2" color="gray">
                {t('modal.subtitle')}
            </Text>
        </Flex>
    );

    const content = (
        <Flex direction="column" gap="5">
            {modalTitle}
            <AuthButtons />
        </Flex>
    );

    return <BaseModal triggerElement={children} title={t('modal.title')} content={content} />;
};

export default AuthModal;
