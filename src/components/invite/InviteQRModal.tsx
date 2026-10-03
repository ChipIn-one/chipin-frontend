import { LucideQrCode } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Button, Card, Dialog, Flex, Text } from '@radix-ui/themes';

import type { InviteQrContent } from 'hooks/pwaHooks';

import OfflineQRCode from 'components/OfflineQRCode';
import { BaseModal, OverlayBody, OverlayFooter } from 'components/modals';

interface Props {
    children?: ReactNode;
    content: InviteQrContent;
    qrLink: string;
}

const InviteQRModal = ({ children, content, qrLink }: Props) => {
    const { t } = useTranslation('common');

    return (
        <BaseModal
            title={content.title}
            accessibleDescription={content.accessibleDescription}
            triggerElement={children ?? (
                <Box width="100%" asChild>
                    <Button variant="soft" size="3">
                        <LucideQrCode />
                        {t('buttons.showQRCode')}
                    </Button>
                </Box>
            )}
            content={
                <>
                    <OverlayBody>
                        <Flex direction="column" gap="4">
                            <Card size="1" variant="surface">
                                <Text size="2" color="gray">
                                    {content.description}
                                </Text>
                            </Card>

                            <Flex justify="center">
                                <OfflineQRCode url={qrLink} size="large" />
                            </Flex>
                        </Flex>
                    </OverlayBody>

                    <OverlayFooter
                        cancelAction={
                            <Dialog.Close>
                                <Button
                                    type="button"
                                    size="3"
                                    variant="soft"
                                    color="gray"
                                >
                                    {t('buttons.close')}
                                </Button>
                            </Dialog.Close>
                        }
                        primaryAction={null}
                    />
                </>
            }
        />
    );
};

export default InviteQRModal;
