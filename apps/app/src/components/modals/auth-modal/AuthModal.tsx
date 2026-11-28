import { PROP_COLOR } from '@chipin/tokens/theme';
import { Flex, Heading, Text } from '@radix-ui/themes';
import { ShieldLockIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Image } from 'basics/Image';
import { AuthButtons } from 'components/AuthButtons';

import SharedExpensesIllustration from 'assets/auth-shared-expenses.webp';

import { BaseModal } from '../base-modal';
import { OverlayBody } from '../components';

import styles from './AuthModal.module.css';

interface Props {
    children?: React.ReactNode;
    isOpened?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
}

const AuthModal = ({ children, isOpened, onOpenChange }: Props) => {
    const { t } = useTranslation('auth');

    const content = (
        <OverlayBody fillHeight>
            <Flex direction="column" align="center" gap="5" height="100%">
                <Flex direction="column" align="center" gap="2" width="100%">
                    <Flex
                        className={styles.illustrationPanel}
                        align="center"
                        justify="center"
                        width="100%"
                        p={{ initial: '2', sm: '3' }}
                        aria-hidden="true"
                    >
                        <Image
                            className={styles.illustration}
                            src={SharedExpensesIllustration}
                            alt=""
                            width="100%"
                            height="auto"
                            decoding="async"
                        />
                    </Flex>

                    <Heading as="h2" size={{ initial: '7', sm: '8' }} align="center">
                        {t('modal.headlinePrimary')} <br />
                        <Text as="span" color={PROP_COLOR.accent}>
                            {t('modal.headlineAccent')}
                        </Text>
                    </Heading>
                </Flex>

                <Flex
                    direction="column"
                    gap="3"
                    width="100%"
                    maxWidth="360px"
                    mt={{ initial: 'auto', sm: '5' }}
                    pt={{ initial: '5', sm: '0' }}
                >
                    <AuthButtons />
                    <Flex align="center" justify="center" gap="2">
                        <Text color={PROP_COLOR.neutral}>
                            <ShieldLockIcon size={14} />
                        </Text>
                        <Text size="1" color={PROP_COLOR.neutral} align="center">
                            {t('modal.trust')}
                        </Text>
                    </Flex>
                </Flex>
            </Flex>
        </OverlayBody>
    );

    return (
        <BaseModal
            triggerElement={children}
            title={t('modal.title')}
            accessibleDescription={t('modal.trust')}
            content={content}
            isOpened={isOpened}
            setIsOpened={onOpenChange}
        />
    );
};

export { AuthModal };
