import { LucideShieldLock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Flex, Heading, Text } from '@radix-ui/themes';

import AuthButtons from 'components/AuthButtons';

import SharedExpensesIllustration from 'assets/auth-shared-expenses.webp';

import { BaseModal } from '../base-modal';
import { OverlayBody } from '../components';

import { IllustrationPanel, SharedExpensesImage } from './styled';

interface Props {
    children?: React.ReactNode;
    isOpened?: boolean;
    isCloseDisabled?: boolean;
}

const AuthModal = ({ children, isOpened, isCloseDisabled = false }: Props) => {
    const { t } = useTranslation('auth');

    const content = (
        <OverlayBody fillHeight>
            <Flex direction="column" align="center" gap="5" height="100%">
                <Flex direction="column" align="center" gap="2" width="100%">
                    <IllustrationPanel
                        align="center"
                        justify="center"
                        width="100%"
                        p={{ initial: '2', sm: '3' }}
                        aria-hidden="true"
                    >
                        <SharedExpensesImage
                            src={SharedExpensesIllustration}
                            alt=""
                            width="100%"
                            height="auto"
                            decoding="async"
                        />
                    </IllustrationPanel>

                    <Heading as="h2" size={{ initial: '7', sm: '8' }} align="center">
                        {t('modal.headlinePrimary')} <br />
                        <Text as="span" color="grass">
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
                        <Text color="gray">
                            <LucideShieldLock size={14} />
                        </Text>
                        <Text size="1" color="gray" align="center">
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
            isCloseDisabled={isCloseDisabled}
        />
    );
};

export default AuthModal;
